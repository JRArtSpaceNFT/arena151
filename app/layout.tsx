import type { Metadata, Viewport } from "next";
import "./globals.css";
import MusicToggle from "@/components/MusicToggle";
import RotatePrompt from "@/components/RotatePrompt";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://arena151.xyz';

export const metadata: Metadata = {
  title: "Arena 151 — Pokémon Draft Battles",
  description: "The premier competitive Pokémon Draft Mode platform. Enter the arena. Face real rivals. Write your destiny.",
  
  // Open Graph for social sharing
  openGraph: {
    title: 'Arena 151 — Build Your Legend',
    description: 'Competitive Pokémon Draft Mode battles. Real stakes. Real rivals. Real glory.',
    url: baseUrl,
    siteName: 'Arena 151',
    images: [
      {
        url: `${baseUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Arena 151 — Pokémon Draft Battles',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  
  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: 'Arena 151 — Pokémon Draft Battles',
    description: 'Build your team. Face real rivals. Claim your legend.',
    images: [`${baseUrl}/og-image.png`],
    creator: '@arena151xyz',
  },
  
  // PWA & Mobile
  manifest: '/manifest.json',
  
  // Icons
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/* Preconnect to external resources */}
        <link rel="preconnect" href="https://raw.githubusercontent.com" />
        <link rel="dns-prefetch" href="https://raw.githubusercontent.com" />
      </head>
      <body 
        className="bg-slate-950 text-white antialiased"
        style={{
          background: `
            radial-gradient(circle at 50% 0%, rgba(59, 130, 246, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 0% 100%, rgba(147, 51, 234, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 100% 100%, rgba(220, 38, 38, 0.1) 0%, transparent 50%),
            linear-gradient(180deg, #0f172a 0%, #020617 100%)
          `
        }}
      >
        <ErrorBoundary>
          <RotatePrompt />
          <MusicToggle />
          <main style={{height:'100%',overflow:'hidden'}}>
            {children}
          </main>
        </ErrorBoundary>
      </body>
    </html>
  );
}
