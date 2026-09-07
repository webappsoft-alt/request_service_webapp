import {
  Bath,
  Bug,
  Droplets,
  House,
  PaintRoller,
  Sparkles,
  Thermometer,
  Trees,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ServiceCategorySlug } from "@/lib/types";

export const serviceIcons: Record<ServiceCategorySlug, LucideIcon> = {
  plumbing: Droplets,
  hvac: Thermometer,
  electrical: Zap,
  handyman: Wrench,
  "house-cleaning": Sparkles,
  roofing: House,
  landscaping: Trees,
  painting: PaintRoller,
  "bathroom-remodeling": Bath,
  "pest-control": Bug,
};

/**
 * Accent classes per category, drawn from the tonal accent tokens in globals.css.
 * Class strings are written in full so Tailwind can detect them at build time.
 */
export const serviceAccents: Record<ServiceCategorySlug, string> = {
  plumbing: "bg-accent-blue/10 text-accent-blue",
  hvac: "bg-accent-teal/10 text-accent-teal",
  electrical: "bg-accent-amber/10 text-accent-amber",
  handyman: "bg-accent-violet/10 text-accent-violet",
  "house-cleaning": "bg-accent-green/10 text-accent-green",
  roofing: "bg-accent-blue/10 text-accent-blue",
  landscaping: "bg-accent-green/10 text-accent-green",
  painting: "bg-accent-violet/10 text-accent-violet",
  "bathroom-remodeling": "bg-accent-teal/10 text-accent-teal",
  "pest-control": "bg-accent-amber/10 text-accent-amber",
};

/**
 * Card call-to-action styling, matched to each category's icon accent so the
 * button and the icon read as one element. Tinted at rest, solid on card hover.
 */
export const serviceButtonAccents: Record<ServiceCategorySlug, string> = {
  plumbing:
    "border-accent-blue/20 bg-accent-blue/10 text-accent-blue group-hover:border-accent-blue group-hover:bg-accent-blue group-hover:text-white",
  hvac: "border-accent-teal/20 bg-accent-teal/10 text-accent-teal group-hover:border-accent-teal group-hover:bg-accent-teal group-hover:text-white",
  electrical:
    "border-accent-amber/20 bg-accent-amber/10 text-accent-amber group-hover:border-accent-amber group-hover:bg-accent-amber group-hover:text-white",
  handyman:
    "border-accent-violet/20 bg-accent-violet/10 text-accent-violet group-hover:border-accent-violet group-hover:bg-accent-violet group-hover:text-white",
  "house-cleaning":
    "border-accent-green/20 bg-accent-green/10 text-accent-green group-hover:border-accent-green group-hover:bg-accent-green group-hover:text-white",
  roofing:
    "border-accent-blue/20 bg-accent-blue/10 text-accent-blue group-hover:border-accent-blue group-hover:bg-accent-blue group-hover:text-white",
  landscaping:
    "border-accent-green/20 bg-accent-green/10 text-accent-green group-hover:border-accent-green group-hover:bg-accent-green group-hover:text-white",
  painting:
    "border-accent-violet/20 bg-accent-violet/10 text-accent-violet group-hover:border-accent-violet group-hover:bg-accent-violet group-hover:text-white",
  "bathroom-remodeling":
    "border-accent-teal/20 bg-accent-teal/10 text-accent-teal group-hover:border-accent-teal group-hover:bg-accent-teal group-hover:text-white",
  "pest-control":
    "border-accent-amber/20 bg-accent-amber/10 text-accent-amber group-hover:border-accent-amber group-hover:bg-accent-amber group-hover:text-white",
};
