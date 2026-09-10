import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  extractErrorMessage,
  postData,
} from "@/components/api/apiFuntions";
import { publicApi } from "@/components/api/ApiRoutesFile";

export type ContactUsPayload = {
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  message: string;
};

export type ContactUsResult = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  status: string;
  createdAt?: string;
  message: string;
};

type ContactUsState = {
  submitting: boolean;
  error: string | null;
  lastSubmittedId: string | null;
};

const initialState: ContactUsState = {
  submitting: false,
  error: null,
  lastSubmittedId: null,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseContactUsResponse(response: unknown): ContactUsResult {
  const root = asRecord(response) ?? {};
  const data = asRecord(root.data) ?? {};
  const id =
    (typeof data.id === "string" && data.id) ||
    (typeof data._id === "string" && data._id) ||
    "";
  const apiMessage =
    (typeof root.message === "string" && root.message.trim()) ||
    "Thank you for contacting us. Your message has been received.";

  return {
    id,
    firstName: typeof data.firstName === "string" ? data.firstName : "",
    lastName: typeof data.lastName === "string" ? data.lastName : "",
    email: typeof data.email === "string" ? data.email : "",
    subject: typeof data.subject === "string" ? data.subject : "",
    status: typeof data.status === "string" ? data.status : "NEW",
    createdAt: typeof data.createdAt === "string" ? data.createdAt : undefined,
    message: apiMessage,
  };
}

export const submitContactUs = createAsyncThunk<
  ContactUsResult,
  ContactUsPayload,
  { rejectValue: string }
>("contactUs/submit", async (payload, { rejectWithValue }) => {
  try {
    const response = await postData(publicApi.contactUs, payload, {
      silent: true,
      skipLogoutOn401: true,
      token: null,
    });
    return parseContactUsResponse(response);
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

const contactUsSlice = createSlice({
  name: "contactUs",
  initialState,
  reducers: {
    clearContactUsError(state) {
      state.error = null;
    },
    resetContactUs() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(submitContactUs.pending, (state) => {
        state.submitting = true;
        state.error = null;
      })
      .addCase(submitContactUs.fulfilled, (state, action) => {
        state.submitting = false;
        state.lastSubmittedId = action.payload.id || null;
        state.error = null;
      })
      .addCase(submitContactUs.rejected, (state, action) => {
        state.submitting = false;
        state.error =
          action.payload ||
          action.error.message ||
          "Failed to send your message.";
      });
  },
});

export const { clearContactUsError, resetContactUs } = contactUsSlice.actions;

export default contactUsSlice.reducer;
