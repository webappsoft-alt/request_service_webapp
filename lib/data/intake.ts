import { getJobStartingPrice, getCategoryStartingPrice } from "@/lib/data/provider-media";
import { getQualifyQuestions } from "@/lib/data/service-directory";
import { getServiceCategoryBySlug, serviceCategories } from "@/lib/data/services";
import { isValidZip } from "@/lib/format";

export type IntakeAnswers = {
  service?: string;
  job?: string;
  zip?: string;
  address?: string;
  street?: string;
  city?: string;
  state?: string;
  lat?: string;
  lng?: string;
  addressLabel?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  details?: string;
  urgency?: string;
  size?: string;
  timeline?: string;
  /** Optional job photos uploaded on the details step (URL strings). */
  photoUrls?: string[];
  [key: string]: string | string[] | undefined;
};

export type IntakeStep = {
  id: string;
  title: string;
  hint?: string;
  type: "choice" | "text" | "contact";
  options?: { value: string; label: string }[];
};

/**
 * Build intake steps.
 * `prefilledZip` skips the ZIP question only when it is already a valid 5-digit ZIP
 * (e.g. from `?zip=`). Do not pass the in-progress typed ZIP — that hid the field.
 */
export function getIntakeSteps(serviceSlug?: string, prefilledZip?: string): IntakeStep[] {
  const category = serviceSlug ? getServiceCategoryBySlug(serviceSlug) : undefined;
  const steps: IntakeStep[] = [
    {
      id: "service",
      title: "What service do you need?",
      hint: "Pick a category so we can ask the right follow-up questions.",
      type: "choice",
      options: serviceCategories.map((item) => ({
        value: item.slug,
        label: item.name,
      })),
    },
  ];

  steps.push({
    id: "job",
    title: category
      ? `What kind of ${category.shortName.toLowerCase()} work is this?`
      : "What kind of work is this?",
    hint: "This is a typical job, not a company. Matching pros write the estimate from these answers.",
    type: "choice",
    options: (category?.commonServices ?? []).map((job) => ({
      value: job,
      label: job,
    })),
  });

  if (serviceSlug) {
    for (const question of getQualifyQuestions(serviceSlug, { subService: true })) {
      if (question.id === "timeline") continue;
      steps.push({
        id: question.id,
        title: question.title,
        hint: question.hint,
        type: "choice",
        options: question.options.map((option) => ({
          value: option.value,
          label: option.label,
        })),
      });
    }
  }

  steps.push(
    {
      id: "property",
      title: "What type of property is it?",
      type: "choice",
      options: [
        { value: "house", label: "Single-family house" },
        { value: "townhouse", label: "Townhouse or condo" },
        { value: "apartment", label: "Apartment" },
        { value: "other", label: "Other / not sure" },
      ],
    },
    {
      id: "size",
      title: "About how large is the home?",
      type: "choice",
      options: [
        { value: "small", label: "Under 1,500 sq ft" },
        { value: "medium", label: "1,500 – 2,500 sq ft" },
        { value: "large", label: "Over 2,500 sq ft" },
        { value: "unsure", label: "Not sure" },
      ],
    },
    {
      id: "urgency",
      title: "When do you need someone there?",
      type: "choice",
      options: [
        { value: "emergency", label: "As soon as possible" },
        { value: "week", label: "This week" },
        { value: "flexible", label: "I’m flexible" },
        { value: "planning", label: "Just planning / getting a price" },
      ],
    },
    {
      id: "access",
      title: "Where is the work?",
      type: "choice",
      options: [
        { value: "inside", label: "Inside the home" },
        { value: "outside", label: "Outside / yard" },
        { value: "both", label: "Inside and outside" },
        { value: "unsure", label: "Not sure yet" },
      ],
    },
    {
      id: "presence",
      title: "Will someone be home for the visit?",
      type: "choice",
      options: [
        { value: "yes", label: "Yes, someone will be there" },
        { value: "lockbox", label: "I can arrange access" },
        { value: "unsure", label: "Not sure yet" },
      ],
    },
    {
      id: "details",
      title: "Anything else the pro should know?",
      hint: "Describe the work, access notes, or what you already tried. You can also add photos below.",
      type: "text",
    }
  );

  if (!isValidZip(String(prefilledZip || ""))) {
    steps.push({
      id: "address",
      title: "Where is the job located?",
      hint: "Select a service address so we can match licensed companies that cover that area.",
      type: "text",
    });
  }

  steps.push({
    id: "contact",
    title: "How should matching pros reach you?",
    hint: "Matching companies see these answers and can send a written estimate.",
    type: "contact",
  });

  return steps;
}

export function getIntakeEstimate(answers: IntakeAnswers) {
  const category = getServiceCategoryBySlug(answers.service ?? "");
  if (!category) return undefined;

  let price = answers.job
    ? getJobStartingPrice(category.id, answers.job)
    : getCategoryStartingPrice(category.id);

  if (answers.urgency === "emergency") price += 80;
  if (answers.urgency === "week") price += 30;
  if (answers.size === "large") price += 40;
  if (answers.size === "small") price -= 10;

  const low = Math.max(49, price);
  return {
    low,
    high: low + 90,
    category,
    job: answers.job,
  };
}
