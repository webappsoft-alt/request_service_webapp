import { fetchPublicBlogs } from "@/lib/data/public-blogs";
import { siteConfig, absoluteUrl } from "@/lib/site";

export async function GET() {
  let items = "";
  try {
    const res = await fetchPublicBlogs({ limit: 50 });
    if (res.data) {
      items = res.data
        .map((post) => {
          const author = post.authorName || siteConfig.name;
          return `
        <item>
          <title><![CDATA[${post.title}]]></title>
          <link>${absoluteUrl(`/blog/${post.slug}`)}</link>
          <guid>${absoluteUrl(`/blog/${post.slug}`)}</guid>
          <pubDate>${post.publishedAt ? new Date(post.publishedAt).toUTCString() : new Date().toUTCString()}</pubDate>
          <description><![CDATA[${post.description || ""}]]></description>
          <author>${author}</author>
        </item>`;
        })
        .join("");
    }
  } catch {
    items = "";
  }

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
