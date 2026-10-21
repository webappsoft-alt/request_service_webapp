import { NotFoundContent } from "@/components/layout/not-found-content";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

/** Unmatched URLs render outside every route-group layout, so this one brings its own chrome. */
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <NotFoundContent />
      </main>
      <SiteFooter />
    </>
  );
}
