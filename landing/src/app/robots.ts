import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.URL ||
    'https://care-ring.netlify.app';

  return {
    rules: [
      // Standard search engine crawlers
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/invoice', '/_next/'],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/invoice'],
      },
      {
        userAgent: 'Bingbot',
        allow: '/',
        disallow: ['/invoice'],
      },
      {
        userAgent: 'Applebot',
        allow: '/',
        disallow: ['/invoice'],
      },
      {
        userAgent: 'DuckDuckBot',
        allow: '/',
        disallow: ['/invoice'],
      },

      // AI Answer Engine & Retrieval Bots (AEO / GEO)
      {
        userAgent: 'GPTBot',
        allow: '/',
        disallow: ['/invoice'],
      },
      {
        userAgent: 'OAI-SearchBot',
        allow: '/',
        disallow: ['/invoice'],
      },
      {
        userAgent: 'ChatGPT-User',
        allow: '/',
        disallow: ['/invoice'],
      },
      {
        userAgent: 'PerplexityBot',
        allow: '/',
        disallow: ['/invoice'],
      },
      {
        userAgent: 'ClaudeBot',
        allow: '/',
        disallow: ['/invoice'],
      },
      {
        userAgent: 'anthropic-ai',
        allow: '/',
        disallow: ['/invoice'],
      },
      {
        userAgent: 'Google-Extended',
        allow: '/',
        disallow: ['/invoice'],
      },
      {
        userAgent: 'Applebot-Extended',
        allow: '/',
        disallow: ['/invoice'],
      },
      {
        userAgent: 'cohere-ai',
        allow: '/',
        disallow: ['/invoice'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
