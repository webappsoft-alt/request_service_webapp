import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import {
  reverseGeocodeCoordinates,
  type PlaceAddress,
} from "@/lib/google-places";

export type CustomerLocation = {
  address: string;
  zip: string;
  city: string;
  state: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
};

type LocationState = CustomerLocation & {
  /** True after an auto-detect attempt finishes (success or failure). */
  detectAttempted: boolean;
  detecting: boolean;
  detectError: string | null;
};

const emptyLocation: CustomerLocation = {
  address: "",
  zip: "",
  city: "",
  state: "",
  country: "",
  latitude: null,
  longitude: null,
};

const initialState: LocationState = {
  ...emptyLocation,
  detectAttempted: false,
  detecting: false,
  detectError: null,
};

export function locationFromPlace(place: PlaceAddress): CustomerLocation {
  return {
    address: place.formattedAddress || place.streetAddress || "",
    zip: place.zipCode || "",
    city: place.city || "",
    state: place.state || "",
    country: place.country || "",
    latitude: place.latitude,
    longitude: place.longitude,
  };
}

/** Preferred label for search UI / filter chips. */
export function locationDisplayLabel(location: CustomerLocation): string {
  const city = location.city.split(",")[0]?.trim() ?? "";
  if (city && !/^\d{5}$/.test(city)) return city;
  if (location.address.trim()) return location.address.trim();
  if (location.zip.trim()) return location.zip.trim();
  return "";
}

export function hasLocation(location: CustomerLocation): boolean {
  return Boolean(
    location.address.trim() ||
      location.city.trim() ||
      location.zip.trim() ||
      (location.latitude != null && location.longitude != null),
  );
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 600_000,
    });
  });
}

/**
 * Resolve the browser's current position into a structured location.
 * Skips work when a location is already selected.
 */
export const detectCurrentLocation = createAsyncThunk<
  CustomerLocation,
  void,
  { rejectValue: string; state: { location: LocationState } }
>("location/detectCurrent", async (_, { getState, rejectWithValue }) => {
  const current = getState().location;
  if (hasLocation(current)) {
    return {
      address: current.address,
      zip: current.zip,
      city: current.city,
      state: current.state,
      country: current.country,
      latitude: current.latitude,
      longitude: current.longitude,
    };
  }

  try {
    const position = await getCurrentPosition();
    const place = await reverseGeocodeCoordinates(
      position.coords.latitude,
      position.coords.longitude,
    );
    return locationFromPlace(place);
  } catch (err) {
    const message =
      err && typeof err === "object" && "code" in err
        ? (err as GeolocationPositionError).code === 1
          ? "Location permission denied."
          : (err as GeolocationPositionError).code === 3
            ? "Timed out while getting your location."
            : "Could not get your current location."
        : err instanceof Error
          ? err.message
          : "Could not get your current location.";
    return rejectWithValue(message);
  }
});

const locationSlice = createSlice({
  name: "location",
  initialState,
  reducers: {
    setLocation(state, action: PayloadAction<CustomerLocation>) {
      const next = action.payload;
      state.address = next.address;
      state.zip = next.zip;
      state.city = next.city;
      state.state = next.state;
      state.country = next.country;
      state.latitude = next.latitude;
      state.longitude = next.longitude;
      state.detectError = null;
    },
    setLocationFromPlace(state, action: PayloadAction<PlaceAddress>) {
      const next = locationFromPlace(action.payload);
      state.address = next.address;
      state.zip = next.zip;
      state.city = next.city;
      state.state = next.state;
      state.country = next.country;
      state.latitude = next.latitude;
      state.longitude = next.longitude;
      state.detectAttempted = true;
      state.detectError = null;
    },
    /** Keep the input controlled while the user types (before a place is selected). */
    setLocationAddress(state, action: PayloadAction<string>) {
      const next = action.payload;
      state.address = next;
      // Typing/editing invalidates structured fields until a place is selected.
      // Prevents sending a previous zip/lat/lng with a newly typed address.
      state.zip = "";
      state.city = "";
      state.state = "";
      state.country = "";
      state.latitude = null;
      state.longitude = null;
    },
    /** Partial hydrate from URL/search defaults when Redux is still empty. */
    hydrateLocationIfEmpty(
      state,
      action: PayloadAction<{ address?: string; city?: string; zip?: string }>,
    ) {
      if (hasLocation(state)) return;
      const address = action.payload.address?.trim() ?? "";
      const city = action.payload.city?.trim() ?? "";
      const zip = action.payload.zip?.trim() ?? "";
      if (!address && !city && !zip) return;
      state.address = address || city || zip;
      state.city = city || (address && !/^\d{5}$/.test(address) ? address : "");
      state.zip = zip;
      state.detectAttempted = true;
    },
    clearLocation(state) {
      state.address = "";
      state.zip = "";
      state.city = "";
      state.state = "";
      state.country = "";
      state.latitude = null;
      state.longitude = null;
      state.detectError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(detectCurrentLocation.pending, (state) => {
        state.detecting = true;
        state.detectError = null;
      })
      .addCase(detectCurrentLocation.fulfilled, (state, action) => {
        state.detecting = false;
        state.detectAttempted = true;
        state.address = action.payload.address;
        state.zip = action.payload.zip;
        state.city = action.payload.city;
        state.state = action.payload.state;
        state.country = action.payload.country;
        state.latitude = action.payload.latitude;
        state.longitude = action.payload.longitude;
        state.detectError = null;
      })
      .addCase(detectCurrentLocation.rejected, (state, action) => {
        state.detecting = false;
        state.detectAttempted = true;
        state.detectError = action.payload ?? "Could not get your current location.";
      });
  },
});

export const {
  setLocation,
  setLocationFromPlace,
  setLocationAddress,
  hydrateLocationIfEmpty,
  clearLocation,
} = locationSlice.actions;

export default locationSlice.reducer;
