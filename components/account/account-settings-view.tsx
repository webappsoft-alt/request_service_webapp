"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, KeyRound, Loader2, LogOut, UserRound } from "lucide-react";
import { toast } from "sonner";
import { PasswordInput } from "@/components/auth/password-input";
import {
  handleUserLogout,
  putData,
  showApiErrorToast,
} from "@/components/api/apiFuntions";
import { userApi } from "@/components/api/ApiRoutesFile";
import {
  extractUploadedUrl,
  uploadFile,
} from "@/components/api/uploadFile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Container, Section } from "@/components/layout/container";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  getUserAvatarSrc,
  selectAuth,
  selectAuthUser,
  selectIsAuthenticated,
  updateAuthUser,
  type AuthUser,
} from "@/store/authSlice";
import { cn } from "@/lib/utils";

function initialsFor(user: AuthUser): string {
  const first = String(user.firstName || "").trim();
  const last = String(user.lastName || "").trim();
  const email = String(user.email || "").trim();
  if (first || last) {
    return (
      `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() ||
      first.charAt(0).toUpperCase()
    );
  }
  return email.charAt(0).toUpperCase() || "U";
}

function zipFromUser(user: AuthUser): string {
  if (typeof user.zip === "string" && user.zip.trim()) return user.zip.trim();
  const fromLocation = user.location?.zip;
  return typeof fromLocation === "string" ? fromLocation.trim() : "";
}

export function AccountSettingsView() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [zip, setZip] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const formReadyRef = useRef(false);

  useEffect(() => {
    if (!auth.hydrated) return;
    if (!isAuthenticated || !user) {
      router.replace("/login");
    }
  }, [auth.hydrated, isAuthenticated, user, router]);

  // Hydrate editable fields once so /me refreshes don't overwrite in-progress edits.
  useEffect(() => {
    if (!user) {
      formReadyRef.current = false;
      return;
    }

    setEmail(String(user.email || ""));
    setAvatarUrl(getUserAvatarSrc(user));

    if (formReadyRef.current) return;

    setFirstName(String(user.firstName || ""));
    setLastName(String(user.lastName || ""));
    setPhone(typeof user.phone === "string" ? user.phone : "");
    setZip(zipFromUser(user));
    formReadyRef.current = true;
  }, [user]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!auth.hydrated) {
    return (
      <Section tone="muted">
        <Container>
          <p className="text-sm text-muted-foreground">Loading account…</p>
        </Container>
      </Section>
    );
  }

  if (!user) return null;

  const displayAvatar = previewUrl || avatarUrl;
  const displayName =
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    String(user.email || "Customer");

  function applyProfileUser(
    apiUser: (AuthUser & { _id?: string; name?: string }) | undefined,
    fallback: Partial<AuthUser> = {},
  ) {
    const userPayload: AuthUser & { _id?: string; name?: string } = {
      ...fallback,
      ...(apiUser || {}),
    };

    // Prefer values we just saved when the API only returns a combined `name`.
    if (!userPayload.firstName && fallback.firstName) {
      userPayload.firstName = fallback.firstName;
    }
    if (!userPayload.lastName && fallback.lastName) {
      userPayload.lastName = fallback.lastName;
    }
    if (!userPayload.phone && fallback.phone) {
      userPayload.phone = fallback.phone;
    }
    if (!userPayload.zip && fallback.zip) {
      userPayload.zip = fallback.zip;
    }
    if (!userPayload.avatarUrl && fallback.avatarUrl) {
      userPayload.avatarUrl = fallback.avatarUrl;
    }

    dispatch(updateAuthUser({ user: userPayload }));

    const next = {
      firstName: String(
        userPayload.firstName ||
          (typeof userPayload.name === "string"
            ? userPayload.name.split(/\s+/)[0]
            : "") ||
          firstName,
      ),
      lastName: String(
        userPayload.lastName ||
          (typeof userPayload.name === "string"
            ? userPayload.name.split(/\s+/).slice(1).join(" ")
            : "") ||
          lastName,
      ),
      phone:
        typeof userPayload.phone === "string" ? userPayload.phone : phone,
      zip: typeof userPayload.zip === "string" ? userPayload.zip : zip,
      avatarUrl:
        typeof userPayload.avatarUrl === "string"
          ? userPayload.avatarUrl
          : avatarUrl,
    };

    setFirstName(next.firstName);
    setLastName(next.lastName);
    setPhone(next.phone);
    setZip(next.zip);
    if (next.avatarUrl) setAvatarUrl(next.avatarUrl);
  }

  async function onImageSelected(file: File | undefined) {
    if (!file) return;

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setUploadingImage(true);

    try {
      const response = await uploadFile(file);
      const uploaded = extractUploadedUrl(response.data);
      if (!uploaded) {
        throw new Error("Upload succeeded but no image URL was returned.");
      }

      setAvatarUrl(uploaded);

      const res = await putData<{
        message?: string;
        user?: AuthUser & { _id?: string; name?: string };
        data?: AuthUser & { _id?: string; name?: string };
      }>(
        userApi.profile,
        {
          avatarUrl: uploaded,
        },
        { silent: true },
      );

      applyProfileUser(res?.user || res?.data, { avatarUrl: uploaded });
      setPreviewUrl(null);
      toast.success(res?.message || "Profile photo updated");
    } catch (error) {
      setPreviewUrl(null);
      showApiErrorToast(error, "Could not upload profile photo.");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function onSaveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextFirstName = firstName.trim();
    const nextLastName = lastName.trim();
    const nextPhone = phone.trim();
    const nextZip = zip.trim();

    if (!nextFirstName || !nextLastName) {
      toast.error("First and last name are required.");
      return;
    }

    // Email is read-only — never include it in the update payload.
    const payload: Record<string, unknown> = {
      firstName: nextFirstName,
      lastName: nextLastName,
      phone: nextPhone || undefined,
      zip: nextZip || undefined,
    };

    if (avatarUrl) {
      payload.avatarUrl = avatarUrl;
    }

    setSavingProfile(true);
    try {
      const res = await putData<{
        message?: string;
        user?: AuthUser & { _id?: string; name?: string };
        data?: AuthUser & { _id?: string; name?: string };
      }>(userApi.profile, payload, {
        silent: true,
      });

      applyProfileUser(res?.user || res?.data, {
        firstName: nextFirstName,
        lastName: nextLastName,
        phone: nextPhone || undefined,
        zip: nextZip || undefined,
        avatarUrl: avatarUrl || undefined,
      });
      setPreviewUrl(null);
      toast.success(res?.message || "Profile updated successfully");
    } catch (error) {
      showApiErrorToast(error, "Could not update your profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function onSavePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (oldPassword.length < 1) {
      toast.error("Enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    if (oldPassword === newPassword) {
      toast.error("New password must be different from your current password.");
      return;
    }

    setSavingPassword(true);
    try {
      const res = await putData<{ message?: string }>(
        userApi.updatePassword,
        {
          oldPassword,
          newPassword,
        },
        { silent: true },
      );
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success(res?.message || "Password updated successfully");
    } catch (error) {
      showApiErrorToast(error, "Could not update your password.");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <Section tone="muted" className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--brand)_18%,transparent),transparent_70%)]"
      />

      <Container className="relative max-w-3xl">
        <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <p className="eyebrow text-muted-foreground">Account</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Profile settings
            </h1>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              Update your customer details, photo, and password for Request
              Services.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-fit border-destructive/30 bg-background text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => handleUserLogout()}
          >
            <LogOut className="size-4" />
            Log out
          </Button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_1px_0_rgba(15,23,42,0.04),0_12px_40px_-24px_rgba(0,63,125,0.35)]">
          <div className="border-b border-border/70 bg-linear-to-br from-primary/6 via-card to-card px-5 py-6 sm:px-8">
            <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
              <div className="relative">
                <Avatar className="size-24 border-2 border-background shadow-md ring-1 ring-border">
                  {displayAvatar ? (
                    <AvatarImage src={displayAvatar} alt={displayName} />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-2xl font-semibold text-primary">
                    {initialsFor(user)}
                  </AvatarFallback>
                </Avatar>
                <label
                  htmlFor={fileInputId}
                  className={cn(
                    "absolute -right-1 -bottom-1 inline-flex size-9 cursor-pointer items-center justify-center rounded-full border border-border bg-background text-primary shadow-sm transition hover:bg-muted",
                    uploadingImage && "pointer-events-none opacity-70",
                  )}
                  title="Change profile photo"
                >
                  {uploadingImage ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Camera className="size-4" />
                  )}
                  <span className="sr-only">Upload profile photo</span>
                </label>
                <input
                  id={fileInputId}
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  className="sr-only"
                  disabled={uploadingImage || savingProfile}
                  onChange={(event) =>
                    void onImageSelected(event.target.files?.[0])
                  }
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-xl font-semibold tracking-tight">
                  {displayName}
                </p>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {String(user.email || "")}
                </p>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  JPG, PNG, or WebP up to a few MB. A new photo is saved to your
                  account as soon as the upload finishes.
                </p>
              </div>
            </div>
          </div>

          <div className="px-5 py-6 sm:px-8 sm:py-8">
            <Tabs defaultValue="profile" className="gap-6">
              <TabsList
                variant="line"
                className="h-auto w-full justify-start gap-0 border-b border-border/80 pb-0"
              >
                <TabsTrigger
                  value="profile"
                  className="h-10 flex-none rounded-none px-4 data-active:text-primary"
                >
                  <UserRound className="size-4" />
                  Profile
                </TabsTrigger>
                <TabsTrigger
                  value="password"
                  className="h-10 flex-none rounded-none px-4 data-active:text-primary"
                >
                  <KeyRound className="size-4" />
                  Password
                </TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="mt-2 outline-none">
                <form onSubmit={onSaveProfile} className="grid gap-6">
                  <FieldGroup>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="settings-first-name">
                          First name
                        </FieldLabel>
                        <Input
                          id="settings-first-name"
                          autoComplete="given-name"
                          value={firstName}
                          onChange={(event) => setFirstName(event.target.value)}
                          required
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="settings-last-name">
                          Last name
                        </FieldLabel>
                        <Input
                          id="settings-last-name"
                          autoComplete="family-name"
                          value={lastName}
                          onChange={(event) => setLastName(event.target.value)}
                          required
                        />
                      </Field>
                    </div>

                    <Field>
                      <FieldLabel htmlFor="settings-email">Email</FieldLabel>
                      <Input
                        id="settings-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        disabled
                        readOnly
                        className="cursor-not-allowed bg-muted/60 text-muted-foreground"
                      />
                      <p className="text-xs text-muted-foreground">
                        Email can’t be changed from your profile.
                      </p>
                    </Field>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="settings-phone">Phone</FieldLabel>
                        <Input
                          id="settings-phone"
                          type="tel"
                          autoComplete="tel"
                          value={phone}
                          onChange={(event) => setPhone(event.target.value)}
                          placeholder="(512) 555-0148"
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="settings-zip">ZIP code</FieldLabel>
                        <Input
                          id="settings-zip"
                          autoComplete="postal-code"
                          value={zip}
                          onChange={(event) => setZip(event.target.value)}
                          placeholder="78701"
                        />
                      </Field>
                    </div>
                  </FieldGroup>

                  <div className="flex flex-wrap items-center gap-3 border-t border-border/70 pt-5">
                    <Button
                      type="submit"
                      disabled={savingProfile || uploadingImage}
                    >
                      {savingProfile ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Saving…
                        </>
                      ) : (
                        "Save profile"
                      )}
                    </Button>
                    <Button asChild type="button" variant="ghost">
                      <Link href="/">Back to home</Link>
                    </Button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="password" className="mt-2 outline-none">
                <form onSubmit={onSavePassword} className="grid gap-6">
                  <div className="rounded-xl border border-border/70 bg-muted/40 px-4 py-3 text-sm leading-6 text-muted-foreground">
                    Choose a strong password you do not use elsewhere. You will
                    stay signed in after updating it.
                  </div>

                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="settings-old-password">
                        Current password
                      </FieldLabel>
                      <PasswordInput
                        id="settings-old-password"
                        autoComplete="current-password"
                        placeholder="Enter your current password"
                        value={oldPassword}
                        onChange={(event) => setOldPassword(event.target.value)}
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="settings-new-password">
                        New password
                      </FieldLabel>
                      <PasswordInput
                        id="settings-new-password"
                        autoComplete="new-password"
                        placeholder="At least 8 characters"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        required
                        minLength={8}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="settings-confirm-password">
                        Confirm new password
                      </FieldLabel>
                      <PasswordInput
                        id="settings-confirm-password"
                        autoComplete="new-password"
                        placeholder="Re-enter your new password"
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(event.target.value)
                        }
                        required
                        minLength={8}
                      />
                    </Field>
                  </FieldGroup>

                  <div className="flex flex-wrap items-center gap-3 border-t border-border/70 pt-5">
                    <Button type="submit" disabled={savingPassword}>
                      {savingPassword ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Updating…
                        </>
                      ) : (
                        "Update password"
                      )}
                    </Button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </Container>
    </Section>
  );
}
