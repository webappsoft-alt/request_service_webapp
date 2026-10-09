"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthPhoneInput } from "@/components/auth/auth-phone-input";
import { PasswordInput } from "@/components/auth/password-input";
import { PortalPage } from "@/components/portal/portal-page";
import { CityStateZipFields } from "@/components/shared/city-state-zip-fields";
import { GoogleAddressAutocomplete } from "@/components/shared/google-address-autocomplete";
import { DetailCard, KeyValue } from "@/components/technician/tech-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CenteredSpinner } from "@/components/ui/spinner";
import type { ContractorProfile } from "@/lib/api/contractor-portal-client";
import { normalizeUsStateCode } from "@/lib/data/us-states";
import { updateAuthUser } from "@/store/authSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchContractorProfile, saveContractorProfile, updateContractorPassword } from "@/store/contractorPortalSlice";

const STATUS_LABEL: Record<string, string> = { active: "Active", inactive: "Inactive", on_stop: "On stop" };

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className ? `space-y-1.5 ${className}` : "space-y-1.5"}>
      <Label className="text-xs font-semibold">{label}</Label>
      {children}
    </div>
  );
}

export function ContractorProfileView() {
  const dispatch = useAppDispatch();
  const { data, loading, error } = useAppSelector((state) => state.contractorPortal.profile);

  useEffect(() => {
    void dispatch(fetchContractorProfile());
  }, [dispatch]);

  if (!data) {
    return loading || !error ? (
      <div className="rounded-md border border-input bg-card">
        <CenteredSpinner label="Loading profile" className="min-h-[22rem]" />
      </div>
    ) : (
      <PortalPage eyebrow="Contractor" title="Profile">
        <p className="text-sm text-muted-foreground">{error}</p>
      </PortalPage>
    );
  }

  // Remount the form when the saved profile changes so drafts start from server values.
  return <ProfileForm key={JSON.stringify(data)} data={data} />;
}

function ProfileForm({ data }: { data: ContractorProfile }) {
  const dispatch = useAppDispatch();
  const saving = useAppSelector((state) => Boolean(state.contractorPortal.profile.saving));
  const [draft, setDraft] = useState({
    companyName: data.companyName || "",
    firstName: data.firstName || "",
    lastName: data.lastName || "",
    phone: data.phone || "",
    street: data.street || "",
    city: data.city || "",
    state: data.state || "",
    zip: data.zip || "",
  });
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [changingPassword, setChangingPassword] = useState(false);

  async function onSave() {
    if (!draft.companyName.trim() && !`${draft.firstName}${draft.lastName}`.trim()) {
      toast.error("Enter a company name or a contact person.");
      return;
    }
    const result = await dispatch(saveContractorProfile(draft));
    if (saveContractorProfile.rejected.match(result)) {
      toast.error(result.payload || "Could not save your profile.");
      return;
    }
    dispatch(updateAuthUser({ user: { firstName: draft.firstName, lastName: draft.lastName, phone: draft.phone } }));
    toast.success("Profile saved.");
  }

  async function onChangePassword() {
    if (passwords.newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (passwords.newPassword !== passwords.confirm) {
      toast.error("New passwords do not match.");
      return;
    }
    setChangingPassword(true);
    const result = await dispatch(
      updateContractorPassword({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword }),
    );
    setChangingPassword(false);
    if (updateContractorPassword.rejected.match(result)) {
      toast.error(result.payload || "Could not change your password.");
      return;
    }
    setPasswords({ currentPassword: "", newPassword: "", confirm: "" });
    toast.success("Password updated.");
  }

  return (
    <PortalPage
      eyebrow="Contractor / Profile"
      title={data.companyName || data.displayName}
      description={data.provider?.name ? `Contractor for ${data.provider.name}` : undefined}
      actions={
        <Button size="sm" className="h-8" disabled={saving} onClick={() => void onSave()}>
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Save profile
        </Button>
      }
    >
      <DetailCard title="Your details">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Company name" className="sm:col-span-2">
            <Input
              value={draft.companyName}
              placeholder="Rivera Contracting LLC"
              onChange={(e) => setDraft({ ...draft, companyName: e.target.value })}
            />
          </Field>
          <Field label="Contact first name">
            <Input value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} />
          </Field>
          <Field label="Contact last name">
            <Input value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} />
          </Field>
          <Field label="Phone">
            <AuthPhoneInput value={draft.phone} onChange={(phone) => setDraft({ ...draft, phone })} placeholder="(555) 123-4567" />
          </Field>
          <Field label="Street address">
            <GoogleAddressAutocomplete
              id="ct-profile-street"
              value={draft.street}
              onChange={(street) => setDraft((current) => ({ ...current, street }))}
              onSelect={(address) =>
                setDraft((current) => ({
                  ...current,
                  street: address.streetAddress.trim(),
                  city: address.city || current.city,
                  state: normalizeUsStateCode(address.state) || current.state,
                  zip: address.zipCode || current.zip,
                }))
              }
              placeholder="Start typing a street address…"
            />
          </Field>
          <div className="sm:col-span-2">
            <CityStateZipFields
              idPrefix="ct-profile"
              value={{ city: draft.city, state: draft.state, zip: draft.zip }}
              onChange={(next) => setDraft((current) => ({ ...current, ...next }))}
            />
          </div>
        </div>
      </DetailCard>

      <DetailCard title="Set by your company">
        <div className="grid gap-4 sm:grid-cols-3">
          <KeyValue label="Email (sign-in)" value={data.email} />
          <KeyValue label="Username (sign-in)" value={data.username ? `@${data.username}` : "—"} />
          <KeyValue label="Trade" value={data.trade} />
          <KeyValue label="License #" value={data.license} />
          <KeyValue label="Contractor #" value={data.number} />
          <KeyValue label="Status" value={STATUS_LABEL[data.status] || data.status} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          You can sign in with your email or username. Contact {data.provider?.name || "your company"} to change them, your trade, or license.
        </p>
      </DetailCard>

      {data.provider ? (
        <DetailCard title="Working with">
          <div className="grid gap-4 sm:grid-cols-3">
            <KeyValue label="Company" value={data.provider.name} />
            <KeyValue label="Phone" value={data.provider.phone} />
            <KeyValue label="Email" value={data.provider.email} />
          </div>
        </DetailCard>
      ) : null}

      <DetailCard title="Change password">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Current password">
            <PasswordInput
              value={passwords.currentPassword}
              autoComplete="current-password"
              onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
            />
          </Field>
          <Field label="New password">
            <PasswordInput
              value={passwords.newPassword}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
            />
          </Field>
          <Field label="Confirm new password">
            <PasswordInput
              value={passwords.confirm}
              autoComplete="new-password"
              onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
            />
          </Field>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="mt-3 h-8"
          disabled={changingPassword || !passwords.currentPassword || !passwords.newPassword}
          onClick={() => void onChangePassword()}
        >
          {changingPassword ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Update password
        </Button>
      </DetailCard>
    </PortalPage>
  );
}
