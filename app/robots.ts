import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://arena151.xyz'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/reset-password/',
          '/_next/',
          '/special-preview/',
          '/victory-preview/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
