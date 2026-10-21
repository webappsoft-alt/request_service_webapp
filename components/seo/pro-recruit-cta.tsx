import { CtaBanner } from "@/components/shared/cta-banner";
import { proPaths } from "@/lib/pro-paths";

/** Customer page → Pro acquisition cross-link ("Are you a professional contractor in Denver?"). */
export function ProRecruitCta({
  place,
  trade,
  learnMoreHref = proPaths.home,
}: {
  /** "Denver" / "Colorado". Omit for a site-wide variant. */
  place?: string;
  /** Plural trade noun, e.g. "plumbers". */
  trade?: string;
  learnMoreHref?: string;
}) {
  const who = trade ? `one of the ${trade}` : "a professional contractor";
  return (
    <CtaBanner
      tone="muted"
      density="tight"
      eyebrow="For professionals"
      title={
        place
          ? `Are you a professional contractor in ${place}? Join Request Service today`
          : "Are you a professional contractor? Join Request Service today"
      }
      description={`Homeowners${place ? ` in ${place}` : ""} search here for ${who} they can hire. Get listed, send written estimates, and pay no commission on the work you win.`}
      primary={{ href: proPaths.join, label: "Join as a Pro" }}
      secondary={{ href: learnMoreHref, label: "How it works for Pros" }}
    />
  );
}
