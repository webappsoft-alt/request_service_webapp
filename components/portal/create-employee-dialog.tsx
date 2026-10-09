"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthPhoneInput } from "@/components/auth/auth-phone-input";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  employeeRoleLabel,
  type PortalEmployee,
  type PortalEmployeeRole, emptyPersonAddress, type PortalPersonAddress } from "@/lib/data/portal";
import { PersonAddressFields } from "@/components/shared/person-address-fields";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuth } from "@/store/authSlice";
import { createTeamMember, fetchTeam } from "@/store/teamSlice";

/** Matches the API rule for technician usernames. */
export const TECHNICIAN_USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;

/** Returns an error message, or null when the credential pair is valid (or both empty). */
export function validateTechnicianCredentials(username: string, password: string, { requirePassword = true } = {}) {
  const handle = username.trim().toLowerCase();
  if (!handle && !password) return null;
  if (!handle) return "Enter a username for the technician login.";
  if (!TECHNICIAN_USERNAME_PATTERN.test(handle)) {
    return "Username must be 3-30 characters: letters, numbers, dot, underscore, or dash.";
  }
  if (requirePassword && !password) return "Enter a password for the technician login.";
  if (password && password.length < 8) return "Password must be at least 8 characters.";
  return null;
}

const ROLES: PortalEmployeeRole[] = ["technician", "estimator", "dispatcher", "owner"];

type CreateEmployeeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (employee: PortalEmployee) => void;
  defaultRole?: PortalEmployeeRole;
  title?: string;
  description?: string;
};

export function CreateEmployeeDialog({
  open,
  onOpenChange,
  onCreated,
  defaultRole = "technician",
  title = "Add technician",
  description = "They will appear in the assign list for site visits, jobs, and the calendar.",
}: CreateEmployeeDialogProps) {
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<PortalEmployeeRole>(defaultRole);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [trade, setTrade] = useState("");
  const [payRate, setPayRate] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [address, setAddress] = useState<PortalPersonAddress>(emptyPersonAddress);
  const [saving, setSaving] = useState(false);

  function reset() {
    setFirstName("");
    setLastName("");
    setRole(defaultRole);
    setEmail("");
    setPhone("");
    setTrade("");
    setPayRate("");
    setUsername("");
    setPassword("");
    setAddress(emptyPersonAddress());
    setSaving(false);
  }

  useEffect(() => {
    if (!open) return;
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when dialog opens
  }, [open, defaultRole]);

  async function save() {
    if (saving) return;
    if (!auth.token) {
      toast.error("Sign in to create a technician.");
      return;
    }

    const input = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role,
      email: email.trim(),
      phone: phone.trim(),
      trade: trade.trim() || "General",
      active: true as const,
      hourlyRate: Math.max(0, Number(payRate) || 0),
      address,
      ...(username.trim() ? { username: username.trim().toLowerCase(), password } : {}),
    };
    if (!input.firstName || !input.lastName) {
      toast.error("First and last name are required.");
      return;
    }
    const credentialError = validateTechnicianCredentials(username, password);
    if (credentialError) {
      toast.error(credentialError);
      return;
    }

    setSaving(true);
    try {
      // Always create via provider team API — never local/fake ids.
      const created = await dispatch(createTeamMember(input)).unwrap();
      if (!created?.id) {
        throw new Error("Technician was created but the server response was incomplete.");
      }
      await dispatch(fetchTeam({ force: true, limit: 100 }));
      toast.success(`${created.firstName} ${created.lastName} added.`);
      onCreated?.(created);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(
        typeof err === "string"
          ? err
          : err instanceof Error
            ? err.message
            : "Could not create technician.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md" data-lenis-prevent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="create-emp-first">First name</Label>
              <Input
                id="create-emp-first"
                value={firstName}
                placeholder="Marcus"
                onChange={(e) => setFirstName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-emp-last">Last name</Label>
              <Input
                id="create-emp-last"
                value={lastName}
                placeholder="Lee"
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-emp-role">Role</Label>
            <Select value={role} onValueChange={(value) => setRole(value as PortalEmployeeRole)}>
              <SelectTrigger id="create-emp-role" className="w-full">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {employeeRoleLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-emp-trade">Expertise</Label>
            <Input
              id="create-emp-trade"
              value={trade}
              placeholder="Plumbing, HVAC, Electrical…"
              onChange={(e) => setTrade(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-emp-email">Email</Label>
            <Input
              id="create-emp-email"
              type="email"
              value={email}
              placeholder="marcus@company.com"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-emp-phone">Phone</Label>
            <AuthPhoneInput
              id="create-emp-phone"
              value={phone}
              onChange={setPhone}
              placeholder="(555) 123-4567"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-emp-rate">Pay rate (per hour)</Label>
            <Input
              id="create-emp-rate"
              type="number"
              min="0"
              step="0.5"
              value={payRate}
              placeholder="0.00"
              onChange={(e) => setPayRate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Used to calculate pay from tracked clock-in hours.</p>
          </div>
          <PersonAddressFields idPrefix="create-emp-address" value={address} onChange={setAddress} />
          <div className="space-y-3 rounded-md border border-border-soft bg-secondary/40 p-3">
            <div>
              <p className="text-sm font-semibold">Technician portal login</p>
              <p className="text-xs text-muted-foreground">
                Optional. They sign in at /technical/login with this username to see only their own jobs, schedule, and time.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="create-emp-username">Username</Label>
                <Input
                  id="create-emp-username"
                  value={username}
                  autoComplete="off"
                  autoCapitalize="none"
                  placeholder="marcus.lee"
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-emp-password">Password</Label>
                <PasswordInput
                  id="create-emp-password"
                  value={password}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            disabled={saving || !firstName.trim() || !lastName.trim()}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Add technician"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
