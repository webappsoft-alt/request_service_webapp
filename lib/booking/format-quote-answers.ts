import { getIntakeSteps, type IntakeAnswers } from "@/lib/data/intake";
import { getServiceCategoryBySlug } from "@/lib/data/services";
import type { QuoteAnswer } from "@/lib/data/portal";

const SHORT_LABEL: Record<string, string> = {
  service: "Service",
  job: "Job",
  property: "Property",
  size: "Home size",
  urgency: "Timeline",
  access: "Work location",
  presence: "Site access",
  area: "Where",
  intent: "What they need",
  frequency: "Frequency",
  bedrooms: "Bedrooms",
  stories: "Stories",
  yard: "Yard size",
  rooms: "Rooms",
  ready: "Ready to start",
  plan: "Service plan",
  "job-type": "Job type",
  "sub-service": "Job",
  timeline: "Timeline",
};

function preferredWindow(urgency?: string) {
  switch (urgency) {
    case "emergency":
    case "48h":
      return "As soon as possible";
    case "week":
      return "This week";
    case "planning":
    case "specific":
      return "Planning";
    case "flexible":
      return "Flexible";
    default:
      return undefined;
  }
}

export function formatIntakeQuote(answers: IntakeAnswers) {
  const steps = getIntakeSteps(answers.service, answers.zip);
  const listed: QuoteAnswer[] = [];

  for (const step of steps) {
    if (step.type === "contact" || step.id === "zip" || step.id === "details") continue;
    const raw = answers[step.id]?.trim();
    if (!raw) continue;
    const value = step.options?.find((option) => option.value === raw)?.label ?? raw;
    listed.push({
      id: step.id,
      label: SHORT_LABEL[step.id] ?? step.title,
      value,
    });
  }

  const notes = answers.details?.trim();
  const lines = listed.map((item) => `• ${item.label}: ${item.value}`);
  const details = [notes, lines.length ? `Answers\n${lines.join("\n")}` : ""]
    .filter(Boolean)
    .join("\n\n");

  return {
    answers: listed,
    details: details || "Website quote request.",
    serviceSlug: answers.service ?? "",
    serviceName: answers.job || getServiceCategoryBySlug(answers.service ?? "")?.name || "Service request",
    zip: answers.zip ?? "",
    preferredTime: preferredWindow(answers.urgency ?? answers.timeline),
  };
}

const PENDING_KEY = "rs-pending-quote";

export type PendingQuote = IntakeAnswers;

export function readPendingQuote(): PendingQuote | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingQuote;
  } catch {
    return null;
  }
}

export function writePendingQuote(answers: IntakeAnswers) {
  window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(answers));
}

export function clearPendingQuote() {
  window.sessionStorage.removeItem(PENDING_KEY);
}
