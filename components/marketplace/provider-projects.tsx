import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { Provider, ProviderProject } from "@/lib/types";

export function ProviderProjectCard({
  provider,
  project,
}: {
  provider: Provider;
  project: ProviderProject;
}) {
  return (
    <Link
      href={`/professionals/${provider.slug}/projects/${project.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-black/15 bg-card transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-black/25 hover:elevate focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        <Image
          src={project.cover}
          alt={project.title}
          fill
          sizes="(min-width: 1024px) 18rem, (min-width: 640px) 45vw, 92vw"
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          {project.categoryName}
        </p>
        <h3 className="text-lg font-semibold leading-snug">{project.title}</h3>
        <p className="text-sm leading-6 text-muted-foreground">{project.summary}</p>
        <p className="mt-auto pt-2 text-xs text-muted-foreground">
          {project.location}
          <span aria-hidden="true"> · </span>
          {formatDate(project.completedOn)}
        </p>
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-brand">
          View project
          <ArrowRight
            className="size-3.5 transition-transform duration-300 ease-out group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </div>
    </Link>
  );
}

export function ProviderProjects({
  provider,
  projects,
}: {
  provider: Provider;
  projects: ProviderProject[];
}) {
  if (!projects.length) return null;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <p className="eyebrow text-muted-foreground">Portfolio</p>
        <h2 className="mt-1 text-2xl font-semibold">About these projects</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Recent jobs {provider.companyName} completed in {provider.city}. Each one started from a
          written scope.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <ProviderProjectCard key={project.slug} provider={provider} project={project} />
        ))}
      </div>
    </section>
  );
}
