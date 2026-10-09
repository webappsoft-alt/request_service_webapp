"use client";

import { useRef, useState } from "react";
import { FileText, KeyRound, Loader2, Paperclip, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { extractUploadedUrl, uploadAnyFile } from "@/components/api/uploadFile";
import { AuthPhoneInput } from "@/components/auth/auth-phone-input";
import { PasswordInput } from "@/components/auth/password-input";
import { GoogleAddressAutocomplete } from "@/components/shared/google-address-autocomplete";
import { CityStateZipFields } from "@/components/shared/city-state-zip-fields";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { setContractorPortalAccess } from "@/lib/api/contractor-portal-client";
import { contractorPaths } from "@/lib/contractor-paths";
import type { PortalContractor } from "@/lib/data/crm-people";
import { normalizeUsStateCode } from "@/lib/data/us-states";
import type { PlaceAddress } from "@/lib/google-places";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuth, selectAuthUser } from "@/store/authSlice";
import {
  addContractorMemberAttachment,
  createContractorRecord,
  fetchContractorDetail,
  updateContractorRecord,
} from "@/store/contractorsSlice";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const W9_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";
const W9_MAX_BYTES = 15 * 1024 * 1024;

type W9File = { name: string; url: string; fileType: string; sizeBytes: number };

/** "Alex Rivera" → { first: "Alex", last: "Rivera" } (everything after the first word is the last name). */
function splitContact(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || "", last: parts.slice(1).join(" ") };
}

/** Uploaded W-9: a thumbnail for images, a PDF badge + preview link for documents. */
function W9Preview({
  file,
  label,
  onRemove,
}: {
  file: { name: string; url: string; fileType?: string };
  label?: string;
  onRemove?: () => void;
}) {
  const kind = String(file.fileType || "").toLowerCase();
  const path = file.url.split("?")[0].toLowerCase();
  const isImage = kind.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/.test(path);
  const isPdf = kind === "application/pdf" || path.endsWith(".pdf");
  return (
    <div className="flex items-center gap-3 rounded-lg border border-input bg-muted/20 p-2 text-sm">
      {isImage ? (
        <a href={file.url} target="_blank" rel="noreferrer" className="shrink-0" aria-label="Open W-9 image">
          {/* eslint-disable-next-line @next/next/no-img-element -- uploaded file on the API host */}
          <img src={file.url} alt="W-9 preview" className="size-14 rounded-md border border-input object-cover" />
        </a>
      ) : (
        <span className="flex size-14 shrink-0 flex-col items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-700">
          <FileText className="size-5" aria-hidden />
          <span className="text-[10px] font-bold">{isPdf ? "PDF" : "FILE"}</span>
        </span>
      )}
      <div className="min-w-0 flex-1">
        {label ? <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p> : null}
        <p className="truncate font-medium text-foreground">{file.name || "W-9"}</p>
        <a href={file.url} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary hover:underline">
          {isImage ? "View full image" : "Preview document"}
        </a>
      </div>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Remove W-9"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

/** Readable, unambiguous temporary password the pro can pass on. */
function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("");
}

/**
 * Streamlined contractor create / edit: the essentials only (company, contact,
 * email, phone, trade, license, W-9) plus optional contractor portal access.
 * Rates, insurance, and availability live on the contractor's profile tabs.
 */
export function CreateContractorDialog({
  open,
  onOpenChange,
  contractor = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractor?: PortalContractor | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Mounted only while open, so every open starts from the contractor's current values. */}
      {open ? <ContractorForm key={contractor?.id ?? "new"} contractor={contractor} onOpenChange={onOpenChange} /> : null}
    </Dialog>
  );
}

function ContractorForm({
  contractor,
  onOpenChange,
}: {
  contractor: PortalContractor | null;
  onOpenChange: (open: boolean) => void;
}) {
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const useApi =
    auth.hydrated && Boolean(auth.token) && (user?.role === "provider" || auth.role === "provider");
  const { addContractor, updateContractor, provider, contractors } = useCrmDirectory();
  const isEdit = Boolean(contractor);
  const hasAccess = Boolean(contractor?.hasPortalAccess);

  const [companyName, setCompanyName] = useState(contractor?.companyName || "");
  const [contact, setContact] = useState(`${contractor?.firstName || ""} ${contractor?.lastName || ""}`.trim());
  const [email, setEmail] = useState(contractor?.email || "");
  const [phone, setPhone] = useState(contractor?.phone || "");
  const [trade, setTrade] = useState(contractor?.trade || "");
  const [license, setLicense] = useState(contractor?.license || "");
  const [street, setStreet] = useState(contractor?.street || "");
  const [city, setCity] = useState(contractor?.city || "");
  const [state, setState] = useState(contractor?.state || "");
  const [zip, setZip] = useState(contractor?.zip || "");
  const [latitude, setLatitude] = useState<number | null>(contractor?.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(contractor?.longitude ?? null);
  const [w9, setW9] = useState<W9File | null>(null);
  const [w9Uploading, setW9Uploading] = useState(false);
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState(contractor?.username || "");
  const [revoking, setRevoking] = useState(false);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const existingW9 = contractor?.attachments?.find((file) => file.category === "w9") || null;
  const wantsPassword = password.length > 0;
  const portalOn = wantsPassword;
  const errors = {
    company: !companyName.trim() && !contact.trim() ? "Enter a company name or contact person." : null,
    trade: !trade.trim() ? "Trade / specialty is required." : null,
    email:
      email.trim() && !EMAIL_RE.test(email.trim())
        ? "Enter a valid email."
        : wantsPassword && !email.trim()
          ? "Email is required for portal access. It's their sign-in."
          : null,
    password: wantsPassword && password.length < 8 ? "Use at least 8 characters." : null,
    username:
      username.trim() && !/^[a-z0-9._-]{3,30}$/.test(username.trim().toLowerCase())
        ? "Username: 3-30 letters, numbers, dot, underscore, or dash."
        : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  async function onPickW9(file: File | undefined) {
    if (!file) return;
    if (!W9_ACCEPT.split(",").includes(file.type)) {
      toast.error("Upload the W-9 as a PDF or image.");
      return;
    }
    if (file.size > W9_MAX_BYTES) {
      toast.error("W-9 file must be under 15 MB.");
      return;
    }
    setW9Uploading(true);
    try {
      const response = await uploadAnyFile(file);
      const url = extractUploadedUrl(response.data);
      if (!url) throw new Error("Upload did not return a URL");
      setW9({ name: file.name, url, fileType: file.type, sizeBytes: file.size });
    } catch (error) {
      const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
      toast.error(message || "Could not upload the W-9.");
    } finally {
      setW9Uploading(false);
    }
  }

  function applyAddress(address: PlaceAddress) {
    setStreet(address.streetAddress.trim());
    setCity(address.city || "");
    setState(normalizeUsStateCode(address.state) || "");
    if (address.zipCode) setZip(address.zipCode);
    setLatitude(address.latitude);
    setLongitude(address.longitude);
  }

  async function revokeAccess() {
    if (!contractor) return;
    setRevoking(true);
    try {
      await setContractorPortalAccess(contractor.id, { enabled: false });
      void dispatch(fetchContractorDetail(contractor.id));
      toast.success("Portal access revoked.");
      onOpenChange(false);
    } catch (error) {
      toast.error(typeof error === "string" ? error : "Could not revoke portal access.");
    } finally {
      setRevoking(false);
    }
  }

  async function save() {
    if (saving || w9Uploading) return;
    setTouched(true);
    if (hasErrors) return;

    const { first, last } = splitContact(contact);
    const patch = {
      firstName: first,
      lastName: last,
      companyName: companyName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      trade: trade.trim(),
      license: license.trim(),
      street: street.trim(),
      city: city.trim(),
      state: state.trim(),
      zip: zip.trim(),
      latitude,
      longitude,
      ...(portalOn && password ? { portalPassword: password } : {}),
      // Username rides along with a new login, or updates an existing one.
      ...((portalOn && password) || hasAccess ? { portalUsername: username.trim().toLowerCase() } : {}),
    };

    setSaving(true);
    try {
      let saved: PortalContractor;
      if (isEdit && contractor) {
        saved = useApi
          ? await dispatch(updateContractorRecord({ id: contractor.id, patch })).unwrap()
          : { ...contractor, ...patch };
        if (!useApi) await Promise.resolve(updateContractor(contractor.id, patch));
      } else {
        const next: PortalContractor = {
          id: `con_${provider.id}_new_${Date.now()}`,
          number: `CON-${220 + contractors.length}`,
          ...patch,
          status: "active",
          hourlyRate: 0,
          insuranceExpires: "",
          createdAt: new Date().toISOString().slice(0, 10),
        };
        if (useApi) {
          saved = await dispatch(createContractorRecord(next)).unwrap();
        } else {
          addContractor(next);
          saved = next;
        }
      }

      if (w9 && useApi) {
        try {
          await dispatch(
            addContractorMemberAttachment({ id: saved.id, attachment: { ...w9, name: w9.name || "W-9", category: "w9" } }),
          ).unwrap();
        } catch {
          toast.error("Contractor saved, but the W-9 didn't attach. Add it from the Attachments tab.");
        }
      }

      const name = saved.companyName || `${saved.firstName} ${saved.lastName}`.trim() || "Contractor";
      if (portalOn && password) {
        toast.success(`${name} ${isEdit ? "updated" : "added"} with portal access.`, {
          description: `They sign in at ${contractorPaths.login} with ${patch.email}.`,
          duration: 8000,
        });
      } else {
        toast.success(`${name} ${isEdit ? "updated" : "added"}.`);
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Could not save contractor.");
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || revoking;

  // Block outside-click / Escape / ✕ while a save or revoke is in flight.
  const blockWhileBusy = (event: Event) => {
    if (busy) event.preventDefault();
  };

  return (
    <DialogContent
      className="sm:max-w-lg"
      data-lenis-prevent
      showCloseButton={!busy}
      onInteractOutside={blockWhileBusy}
      onEscapeKeyDown={blockWhileBusy}
    >
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit contractor" : "Add contractor"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Update the contractor's business and contact details."
            : "Just the essentials. Rates, insurance, and availability can be added on their profile later."}
        </DialogDescription>
      </DialogHeader>

      <FieldGroup className="gap-4">
        <Field data-invalid={touched && errors.company ? true : undefined}>
          <FieldLabel htmlFor="con-company">Business / company name</FieldLabel>
          <Input
            id="con-company"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="Rivera Contracting LLC"
            autoFocus={!isEdit}
          />
          {touched && errors.company ? <FieldError>{errors.company}</FieldError> : null}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="con-contact">Contact person</FieldLabel>
            <Input id="con-contact" value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Alex Rivera" />
          </Field>
          <Field data-invalid={touched && errors.trade ? true : undefined}>
            <FieldLabel htmlFor="con-trade">
              Trade / specialty <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id="con-trade"
              value={trade}
              onChange={(event) => setTrade(event.target.value)}
              placeholder="Plumbing, HVAC, Electrical…"
              aria-invalid={touched && Boolean(errors.trade)}
            />
            {touched && errors.trade ? <FieldError>{errors.trade}</FieldError> : null}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={touched && errors.email ? true : undefined}>
            <FieldLabel htmlFor="con-email">Email</FieldLabel>
            <Input
              id="con-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="alex@riveracontracting.com"
              aria-invalid={touched && Boolean(errors.email)}
            />
            {touched && errors.email ? <FieldError>{errors.email}</FieldError> : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="con-phone">Phone</FieldLabel>
            <AuthPhoneInput id="con-phone" value={phone} onChange={setPhone} placeholder="(555) 123-4567" />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="con-license">License #</FieldLabel>
          <Input id="con-license" value={license} onChange={(event) => setLicense(event.target.value)} placeholder="LIC-12345" />
        </Field>

        <Field>
          <FieldLabel>W-9 Tax Form (Taxpayer Identification Document)</FieldLabel>
          {w9 ? (
            <W9Preview file={w9} onRemove={() => setW9(null)} />
          ) : existingW9 ? (
            <W9Preview file={{ name: existingW9.name, url: existingW9.url, fileType: existingW9.fileType }} label="On file" />
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="justify-start"
            onClick={() => fileRef.current?.click()}
            disabled={w9Uploading}
          >
            {w9Uploading ? <Loader2 className="animate-spin" /> : <Upload />}
            {w9Uploading ? "Uploading…" : w9 || existingW9 ? "Replace W-9" : "Upload W-9 (PDF, JPG or PNG)"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept={W9_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              void onPickW9(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="con-location">Location address</FieldLabel>
          <GoogleAddressAutocomplete
            id="con-location"
            value={street}
            onChange={setStreet}
            onSelect={applyAddress}
            placeholder="Start typing a street address…"
          />
        </Field>
        <CityStateZipFields
          idPrefix="con"
          value={{ city, state, zip }}
          onChange={(next) => {
            setCity(next.city);
            setState(next.state);
            setZip(next.zip);
          }}
        />

        {useApi ? (
          <div className="grid gap-4 rounded-md border border-border-soft bg-secondary/40 p-3 sm:grid-cols-2">
            <div className="flex items-start justify-between gap-2 sm:col-span-2">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Contractor Portal Login</span> — Optional. They sign in to
                view their assigned jobs and submit completion.
                {hasAccess ? <span className="mt-1 block font-medium text-emerald-700">Portal access is active.</span> : null}
              </p>
              {hasAccess ? (
                <Button type="button" size="sm" variant="ghost" className="h-7 shrink-0 text-destructive" onClick={revokeAccess} disabled={busy}>
                  {revoking ? <Loader2 className="animate-spin" /> : null}
                  Disable login
                </Button>
              ) : null}
            </div>
            <Field data-invalid={touched && errors.email && wantsPassword ? true : undefined}>
              <FieldLabel htmlFor="con-portal-username">Username</FieldLabel>
              <Input
                id="con-portal-username"
                name="contractor-portal-username"
                value={username}
                autoComplete="off"
                autoCapitalize="none"
                placeholder="alex.rivera (optional)"
                onChange={(event) => setUsername(event.target.value.toLowerCase())}
              />
            </Field>
            <Field data-invalid={touched && errors.password ? true : undefined}>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor="con-portal-password">{hasAccess ? "New password" : "Password"}</FieldLabel>
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() => setPassword(generatePassword())}
                >
                  Generate
                </button>
              </div>
              <PasswordInput
                id="con-portal-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                placeholder={hasAccess ? "Leave blank to keep" : "At least 8 characters"}
              />
            </Field>
            {touched && (errors.password || errors.username || (wantsPassword && errors.email)) ? (
              <FieldError className="sm:col-span-2">{errors.password || errors.username || errors.email}</FieldError>
            ) : (
              <FieldDescription className="text-xs sm:col-span-2">
                They sign in with their email{username.trim() ? ` or @${username.trim().toLowerCase()}` : " or the username above"}. Disable login stops them signing in; their jobs and history stay.
              </FieldDescription>
            )}
          </div>
        ) : null}
      </FieldGroup>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
          Cancel
        </Button>
        <Button disabled={busy || w9Uploading} onClick={() => void save()}>
          {saving ? <Loader2 className="animate-spin" /> : null}
          {saving ? "Saving…" : isEdit ? "Save changes" : "Add contractor"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
