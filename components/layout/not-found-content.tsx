import Link from "next/link";
import { Button } from "@/components/ui/button";

/** 404 body only — the caller decides whether header/footer are needed. */
export function NotFoundContent() {
  return (
    <div className="container-site flex min-h-[70vh] flex-col items-start justify-center gap-4">
      <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">404</p>
      <h1 className="text-4xl">Page not found</h1>
      <p className="max-w-md text-muted-foreground">
        That URL is not part of the public site. Return home or search for a local professional.
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/find-a-professional">Find a professional</Link>
        </Button>
      </div>
    </div>
  );
}
