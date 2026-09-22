import Image from "next/image";
import Link from "next/link";
import type { Provider, ProviderProject } from "@/lib/types";

export function ProviderProjectCard({
  provider,
  project,
  onBeforeNavigate,
}: {
  provider: Provider;
  project: ProviderProject;
  onBeforeNavigate?: () => void;
}) {
  const extraCount = Math.max(0, project.images.length - 1);

  return (
    <Link
      href={`/professionals/${provider.slug}/projects/${project.slug}`}
      onClick={() => onBeforeNavigate?.()}
      className="group flex flex-col overflow-hidden rounded-xl border border-black/15 bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {project.cover ? (
          <Image
            src={project.cover}
            alt={project.title}
            fill
            sizes="(min-width: 1024px) 18rem, (min-width: 640px) 45vw, 92vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : null}
        {extraCount > 0 ? (
          <span className="absolute top-2 right-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
            +{extraCount}
          </span>
        ) : null}
      </div>
      <div className="px-3 py-2.5">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
          {project.title}
        </h3>
      </div>
    </Link>
  );
}

export function ProviderProjects({
  provider,
  projects,
  keepVisible = false,
  onBeforeNavigate,
}: {
  provider: Provider;
  projects: ProviderProject[];
  /** Keep the Portfolio section shell visible even when there are no projects. */
  keepVisible?: boolean;
  onBeforeNavigate?: () => void;
}) {
  if (!projects.length && !keepVisible) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-2xl font-semibold">Portfolio</h2>
      {projects.length ? (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProviderProjectCard
              key={project.slug}
              provider={provider}
              project={project}
              onBeforeNavigate={onBeforeNavigate}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-black/15 bg-card px-4 py-8 text-sm text-muted-foreground">
          Photos of completed work will appear here.
        </p>
      )}
    </section>
  );
}
