import type { Metadata, Viewport } from "next";
import "./globals.css";
import MusicToggle from "@/components/MusicToggle";
import RotatePrompt from "@/components/RotatePrompt";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: "Arena 151 - Build Your Legend",
  description: "The premier Pokémon Draft Mode competitive platform. Enter the arena. Face real rivals. Write your destiny.",
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
        <RotatePrompt />
        <MusicToggle />
        <main style={{height:'100%',overflow:'hidden'}}>
          {children}
        </main>
      </body>
    </html>
  );
}
