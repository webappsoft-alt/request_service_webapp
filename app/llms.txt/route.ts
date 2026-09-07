import { siteConfig } from "@/lib/site";

export async function GET() {
  const body = `# ${siteConfig.name}

> ${siteConfig.tagline}

${siteConfig.description}

## Primary pages
- [Home](${siteConfig.url}/)
- [Services](${siteConfig.url}/services)
- [Find a professional](${siteConfig.url}/find-a-professional)
- [Get a quote](${siteConfig.url}/get-a-quote)
- [For providers](${siteConfig.url}/pro)
- [How it works](${siteConfig.url}/how-it-works)
- [Blog](${siteConfig.url}/blog)
- [FAQ](${siteConfig.url}/faq)
- [Contact](${siteConfig.url}/contact)

## Notes for crawlers
Request Services is a USA-focused home services marketplace. Customers request or book local professionals. Service providers subscribe to a business portal. Pricing shown on the public site is placeholder data.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
