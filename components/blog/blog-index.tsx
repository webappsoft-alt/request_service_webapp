import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BlogCard } from "@/components/shared/blog-card";
import { blogCategories, blogPosts } from "@/lib/data/blog";

export function BlogIndex() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" asChild>
          <Link href="/blog#articles">All</Link>
        </Button>
        {blogCategories.map((item) => (
          <Button key={item.id} variant="outline" size="sm" asChild>
            <Link href={`/blog/category/${item.slug}`}>{item.name}</Link>
          </Button>
        ))}
      </div>
      <div className="grid gap-x-8 gap-y-12 md:grid-cols-2 xl:grid-cols-3">
        {blogPosts.map((post) => (
          <BlogCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}
