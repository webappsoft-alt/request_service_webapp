import { getPortalServices, type PortalFixedService } from "@/lib/data/portal";
import type { Provider } from "@/lib/types";

type ServicePatchStore = {
  services?: PortalFixedService[];
  servicePatches?: Record<string, Partial<PortalFixedService>>;
  deleted?: string[];
  status?: Record<string, string>;
};

export function readPublicFixedServices(provider: Provider): PortalFixedService[] {
  const seeded = getPortalServices(provider);
  if (typeof window === "undefined") {
    return seeded.filter((item) => item.active);
  }

  try {
    const raw = window.localStorage.getItem(`rs-portal-records:${provider.email}`) ?? "";
    if (!raw) return seeded.filter((item) => item.active);
    const parsed = JSON.parse(raw) as ServicePatchStore;
    const deleted = new Set(parsed.deleted ?? []);
    const extras = parsed.services ?? [];
    const patches = parsed.servicePatches ?? {};
    const status = parsed.status ?? {};

    return [...seeded, ...extras]
      .filter((item) => !deleted.has(`service:${item.id}`))
      .map((item) => {
        const patched = { ...item, ...patches[item.id] };
        const active = (status[`service:${item.id}`] ?? (patched.active ? "active" : "hidden")) === "active";
        return {
          ...patched,
          images: patched.images ?? [],
          coverage: patched.coverage ?? [],
          areaZips: patched.areaZips ?? [],
          availabilityMode: patched.availabilityMode ?? "office",
          customHours: patched.customHours ?? [],
          active,
        };
      })
      .filter((item) => item.active);
  } catch {
    return seeded.filter((item) => item.active);
  }
}

export function findPublicFixedService(provider: Provider, serviceId: string) {
  return readPublicFixedServices(provider).find((item) => item.id === serviceId);
}
