"use client";

import { useMemo } from "react";
import { SearchableMultiSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { getServiceCategoryById } from "@/lib/data/services";
import { useAppSelector } from "@/store/hooks";
import { selectAuthProvider } from "@/store/authSlice";

/** Stored in `trade` when no expertise is picked (the label older records already use). */
const NO_EXPERTISE = "General";

/** The member's picked sub-services, else their legacy free-text trade split on commas. */
export function initialExpertise(employee?: { expertise?: string[]; trade?: string } | null) {
  if (employee?.expertise?.length) return employee.expertise;
  return String(employee?.trade || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item && item !== NO_EXPERTISE);
}

/** `trade` label kept in step with the picked sub-services (lists and cards show it). */
export function tradeFromExpertise(expertise: string[]) {
  return expertise.join(", ") || NO_EXPERTISE;
}

/**
 * Searchable multi-select of the business's own sub-services (Business Profile → services),
 * each labelled with its category. Values already on the member that the business no longer
 * lists stay selectable, so editing never silently drops them.
 */
export function ExpertisePicker({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const provider = useAppSelector(selectAuthProvider);

  const options = useMemo<SearchableSelectOption[]>(() => {
    const services = provider?.services;
    const categories = (Array.isArray(services?.categoryIds) ? services.categoryIds : [])
      .map((categoryId) => getServiceCategoryById(categoryId))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const categoryOf = (job: string) =>
      categories.find((category) =>
        category.commonServices.some((service) => service.toLowerCase() === job.toLowerCase()),
      )?.name;
    const offered = (Array.isArray(services?.offeredJobs) ? services.offeredJobs : [])
      .filter((job): job is string => typeof job === "string" && Boolean(job.trim()))
      .map((job) => job.trim());
    const seen = new Set<string>();
    const rows: SearchableSelectOption[] = [];
    for (const job of offered) {
      if (seen.has(job.toLowerCase())) continue;
      seen.add(job.toLowerCase());
      rows.push({ value: job, label: job, description: categoryOf(job) });
    }
    rows.sort((a, b) => (a.description || "").localeCompare(b.description || "") || a.label.localeCompare(b.label));
    for (const item of value) {
      if (seen.has(item.toLowerCase())) continue;
      seen.add(item.toLowerCase());
      rows.push({ value: item, label: item, description: "Not in your listed services" });
    }
    return rows;
  }, [provider?.services, value]);

  return (
    <SearchableMultiSelect
      id={id}
      options={options}
      value={value}
      onChange={onChange}
      keepOpen
      placeholder="Search your services…"
      emptyMessage="No matching services. Add sub-services under Business Profile → Services."
    />
  );
}
