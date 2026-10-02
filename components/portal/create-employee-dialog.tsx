"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthPhoneInput } from "@/components/auth/auth-phone-input";
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
  type PortalEmployeeRole,
} from "@/lib/data/portal";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuth } from "@/store/authSlice";
import { createTeamMember, fetchTeam } from "@/store/teamSlice";

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
  const [saving, setSaving] = useState(false);

  function reset() {
    setFirstName("");
    setLastName("");
    setRole(defaultRole);
    setEmail("");
    setPhone("");
    setTrade("");
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
    };
    if (!input.firstName || !input.lastName) {
      toast.error("First and last name are required.");
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
      <DialogContent className="sm:max-w-md" data-lenis-prevent>
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
