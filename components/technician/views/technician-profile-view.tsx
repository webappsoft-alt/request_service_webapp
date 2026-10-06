"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthPhoneInput } from "@/components/auth/auth-phone-input";
import { PasswordInput } from "@/components/auth/password-input";
import { PortalPage } from "@/components/portal/portal-page";
import { DetailCard, KeyValue } from "@/components/technician/tech-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CenteredSpinner } from "@/components/ui/spinner";
import { employeeRoleLabel, type PortalEmployeeRole } from "@/lib/data/portal";
import { formatDate, formatMoney } from "@/lib/format";
import { updateAuthUser } from "@/store/authSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { changeTechPassword, fetchTechProfile, saveTechProfile } from "@/store/technicianSlice";
import type { TechProfile } from "@/lib/api/technician-client";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold">{label}</Label>
      {children}
    </div>
  );
}

export function TechnicianProfileView() {
  const dispatch = useAppDispatch();
  const { data, loading, error } = useAppSelector((state) => state.technician.profile);

  useEffect(() => {
    void dispatch(fetchTechProfile());
  }, [dispatch]);

  if (!data) {
    return loading || !error ? (
      <div className="rounded-md border border-border-soft bg-card">
        <CenteredSpinner label="Loading profile" className="min-h-[22rem]" />
      </div>
    ) : (
      <PortalPage eyebrow="Technician" title="Profile">
        <p className="text-sm text-muted-foreground">{error}</p>
      </PortalPage>
    );
  }

  // Remount the form when the saved profile changes so drafts start from server values.
  return <ProfileForm key={String(data.employee.updatedAt ?? data.employee.id)} data={data} />;
}

function ProfileForm({ data }: { data: TechProfile }) {
  const dispatch = useAppDispatch();
  const saving = useAppSelector((state) => state.technician.profile.saving);
  const [draft, setDraft] = useState({
    firstName: data.employee.firstName || "",
    lastName: data.employee.lastName || "",
    phone: data.employee.phone || "",
    emergencyName: data.employee.emergencyName || "",
    emergencyPhone: data.employee.emergencyPhone || "",
  });
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [changingPassword, setChangingPassword] = useState(false);

  async function onSave() {
    if (!draft.firstName.trim() || !draft.lastName.trim()) {
      toast.error("First and last name are required.");
      return;
    }
    const result = await dispatch(saveTechProfile(draft));
    if (saveTechProfile.rejected.match(result)) {
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
      changeTechPassword({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword }),
    );
    setChangingPassword(false);
    if (changeTechPassword.rejected.match(result)) {
      toast.error(result.payload || "Could not change your password.");
      return;
    }
    setPasswords({ currentPassword: "", newPassword: "", confirm: "" });
    toast.success("Password updated.");
  }

  const { employee, user, provider } = data;

  return (
    <PortalPage
      eyebrow="Technician / Profile"
      title={`${employee.firstName} ${employee.lastName}`.trim()}
      description={provider?.name ? `Technician at ${provider.name}` : undefined}
      actions={
        <Button size="sm" className="h-8" disabled={saving} onClick={() => void onSave()}>
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Save profile
        </Button>
      }
    >
      <DetailCard title="Your details">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name">
            <Input value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} />
          </Field>
          <Field label="Last name">
            <Input value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} />
          </Field>
          <Field label="Phone">
            <AuthPhoneInput value={draft.phone} onChange={(phone) => setDraft({ ...draft, phone })} placeholder="(555) 123-4567" />
          </Field>
          <Field label="Emergency contact name">
            <Input value={draft.emergencyName} onChange={(e) => setDraft({ ...draft, emergencyName: e.target.value })} />
          </Field>
          <Field label="Emergency phone">
            <AuthPhoneInput
              value={draft.emergencyPhone}
              onChange={(emergencyPhone) => setDraft({ ...draft, emergencyPhone })}
              placeholder="(555) 123-4567"
            />
          </Field>
        </div>
      </DetailCard>

      <DetailCard title="Set by your company">
        <div className="grid gap-3 sm:grid-cols-3">
          <KeyValue label="Username" value={user.username ? `@${user.username}` : "—"} />
          <KeyValue label="Email" value={employee.email || (String(user.email || "").endsWith("@technician.local") ? "—" : user.email)} />
          <KeyValue label="Role" value={employeeRoleLabel(employee.role as PortalEmployeeRole)} />
          <KeyValue label="Expertise" value={employee.trade} />
          <KeyValue label="Pay rate" value={`${formatMoney(Number(employee.hourlyRate) || 0)}/hr`} />
          <KeyValue label="Hire date" value={employee.hireDate ? formatDate(employee.hireDate) : "—"} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Contact your office to change your username, role, or pay rate.</p>
      </DetailCard>

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
