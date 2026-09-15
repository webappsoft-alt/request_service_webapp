import {
  galleryIsReady,
  normalizeBusinessGallery,
} from "@/lib/business-gallery";
import { asAuthProvider, type AuthProviderRecord } from "@/lib/auth/provider-profile";
import type { AuthUser } from "@/store/authSlice";
import type { WorkingHours } from "@/lib/types";

export type ProfileSetupStepId =
  | "account"
  | "business"
  | "profile"
  | "gallery"
  | "hours"
  | "categories"
  | "subservices";

export type ProfileSetupItem = {
  id: ProfileSetupStepId;
  label: string;
  href: string;
  done: boolean;
};

function hasText(value: unknown) {
  return typeof value === "string" && Boolean(value.trim());
}

function hoursConfigured(hours: WorkingHours[] | undefined) {
  if (!Array.isArray(hours) || !hours.length) return false;
  return hours.some((item) => !item.closed && Boolean(item.open) && Boolean(item.close));
}

export function getProfileSetupItems(
  user: AuthUser | null | undefined,
  provider: AuthProviderRecord | null | undefined,
  hours?: WorkingHours[],
): ProfileSetupItem[] {
  const record = asAuthProvider(provider);
  const loc = record?.location;
  const gallery = normalizeBusinessGallery(record?.businessGallery);
  const categoryIds = Array.isArray(record?.services?.categoryIds)
    ? record.services.categoryIds
    : [];
  const jobs = Array.isArray(record?.services?.offeredJobs)
    ? record.services.offeredJobs
    : [];
  const neighborhoods = record?.coverage?.neighborhoods ?? [];
  const workingHours = hours ?? record?.settings?.workingHours;

  return [
    {
      id: "account",
      label: "Account",
      href: "/pro/dashboard/profile?step=account",
      done: Boolean(
        hasText(user?.firstName) &&
          hasText(user?.lastName) &&
          (hasText(user?.phone) || hasText(record?.phone)),
      ),
    },
    {
      id: "business",
      label: "Company",
      href: "/pro/dashboard/profile?step=business",
      done: Boolean(
        hasText(record?.companyName) &&
          (hasText(loc?.address) || hasText(loc?.city)) &&
          neighborhoods.length > 0,
      ),
    },
    {
      id: "profile",
      label: "About",
      href: "/pro/dashboard/profile?step=profile",
      done: hasText(record?.description),
    },
    {
      id: "gallery",
      label: "Main business gallery",
      href: "/pro/dashboard/profile?step=gallery",
      done: galleryIsReady(gallery),
    },
    {
      id: "hours",
      label: "Hours",
      href: "/pro/dashboard/profile?step=hours",
      done: hoursConfigured(workingHours),
    },
    {
      id: "categories",
      label: "Services",
      href: "/pro/dashboard/profile?step=categories",
      done: categoryIds.length > 0,
    },
    {
      id: "subservices",
      label: "Jobs you offer",
      href: "/pro/dashboard/profile?step=subservices",
      done: jobs.length > 0,
    },
  ];
}

export function profileSetupProgress(items: ProfileSetupItem[]) {
  const done = items.filter((item) => item.done).length;
  const percent = items.length ? Math.round((done / items.length) * 100) : 0;
  const next = items.find((item) => !item.done) ?? null;
  return { done, total: items.length, percent, next };
}
