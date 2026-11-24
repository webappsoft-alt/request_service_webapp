import { siteConfig } from "@/lib/site";

export async function GET() {
  const body = `# ${siteConfig.name}

> ${siteConfig.tagline}

${siteConfig.description}

## Primary pages
- [Home](${siteConfig.url}/)
- [Services](${siteConfig.url}/services)
- [Locations](${siteConfig.url}/locations)
- [Find a professional](${siteConfig.url}/find-a-professional)
- [Get a quote](${siteConfig.url}/get-a-quote)
- [For Pros](${siteConfig.url}/pros)
- [Join as a Pro](${siteConfig.url}/pros/join)
- [How it works](${siteConfig.url}/how-it-works)
- [Blog (homeowners)](${siteConfig.url}/blog)
- [Pro Blog (service businesses)](${siteConfig.url}/pros/blog)
- [FAQ](${siteConfig.url}/faq)
- [Contact](${siteConfig.url}/contact)

## Notes for crawlers
Request Service is a USA-focused home services marketplace. Customers request or book local professionals. Pros subscribe to a business portal. Pricing shown on the public site is placeholder data.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
