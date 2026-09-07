import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getBlogAuthorById, getBlogCategoryById } from "@/lib/data/blog";
import { formatDate } from "@/lib/format";
import type { BlogPost } from "@/lib/types";

export function BlogCard({ post }: { post: BlogPost }) {
  const category = getBlogCategoryById(post.categoryId);
  const author = getBlogAuthorById(post.authorId);

  return (
    <Card className="h-full gap-0 border-black/15 pt-0 transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:elevate">
      <Link href={`/blog/${post.slug}`} className="group flex h-full flex-col">
        <div className="relative aspect-[16/10] overflow-hidden bg-primary">
          {post.image ? (
            <Image
              src={post.image}
              alt={post.imageAlt}
              fill
              sizes="(min-width: 1024px) 20vw, (min-width: 640px) 40vw, 100vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            />
          ) : (
            <span className="absolute inset-0 flex items-end p-5">
              <span
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_12%,color-mix(in_oklab,white_16%,transparent),transparent_46%)]"
                aria-hidden="true"
              />
              <span className="relative text-sm font-medium text-primary-foreground/80">
                {category?.name ?? "Journal"}
              </span>
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-3 px-4 pt-4 pb-4">
          <p className="eyebrow text-primary">
            {category?.name ?? "Journal"}
            <span className="mx-2 text-primary/40" aria-hidden="true">
              ·
            </span>
            {post.readTimeMinutes} min
          </p>
          <h3 className="text-lg font-semibold tracking-tight text-balance">{post.title}</h3>
          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{post.description}</p>
          <p className="mt-auto text-xs text-muted-foreground">
            {author?.name} · {formatDate(post.publishedAt)}
          </p>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-brand transition-colors group-hover:text-foreground">
            Continue reading
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </span>
        </div>
      </Link>
    </Card>
  );
}
