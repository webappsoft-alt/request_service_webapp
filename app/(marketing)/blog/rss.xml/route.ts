import { blogPosts } from "@/lib/data/blog";
import { getBlogAuthorById } from "@/lib/data/blog";
import { siteConfig, absoluteUrl } from "@/lib/site";

export async function GET() {
  const items = blogPosts
    .map((post) => {
      const author = getBlogAuthorById(post.authorId);
      return `
        <item>
          <title><![CDATA[${post.title}]]></title>
          <link>${absoluteUrl(`/blog/${post.slug}`)}</link>
          <guid>${absoluteUrl(`/blog/${post.slug}`)}</guid>
          <pubDate>${new Date(`${post.publishedAt}T00:00:00Z`).toUTCString()}</pubDate>
          <description><![CDATA[${post.description}]]></description>
          <author>${author?.name ?? siteConfig.name}</author>
        </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
  <rss version="2.0">
    <channel>
      <title>${siteConfig.name} Journal</title>
      <link>${absoluteUrl("/blog")}</link>
      <description>Guides for homeowners and service businesses.</description>
      <language>en-us</language>
      ${items}
    </channel>
  </rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
