import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#070A12",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.URL ||
  "https://care-ring.netlify.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "CareRing — Open-Source Family Safety Tracker",
    template: "%s | CareRing",
  },
  description:
    "The private, open-source family safety platform. Real-time GPS telemetry, geofence alerts, battery stats, and zero data selling.",
  keywords: [
    "private family safety platform",
    "open source family safety",
    "real-time GPS tracking",
    "private family locator",
    "geofencing alerts",
    "self hosted location tracker",
    "CareRing",
    "React Native family GPS",
    "end to end private safety app",
  ],
  authors: [{ name: "Sunny Sahsi", url: "https://github.com/sahsisunny" }],
  creator: "CareRing Open Source",
  publisher: "CareRing",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "CareRing",
    title: "CareRing — Open-Source Family Safety Tracker",
    description:
      "Private, battery-optimized real-time family location tracking and instant circle safety alerts. 100% open source.",
    images: [
      {
        url: "/og-image.jpg",
        secureUrl: `${SITE_URL}/og-image.jpg`,
        width: 1200,
        height: 630,
        type: "image/jpeg",
        alt: "CareRing — Open-Source Family Safety Tracker",
      },
      {
        url: "/og-image.png",
        secureUrl: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        type: "image/png",
        alt: "CareRing — Open-Source Family Safety Tracker",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@sahsisunny",
    creator: "@sahsisunny",
    title: "CareRing — Open-Source Family Safety Tracker",
    description:
      "The private, open-source family safety app. Live GPS telemetry, geofence alerts, battery stats, and zero tracking.",
    images: [`${SITE_URL}/og-image.jpg`],
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon.png", sizes: "180x180", type: "image/png" }],
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "CareRing",
    operatingSystem: "Android, iOS, Web",
    applicationCategory: "SafetyApplication",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description:
      "CareRing is a high-performance, open-source family safety and location sharing platform with real-time GPS telemetry, geofences, and privacy-first architecture.",
    image: `${SITE_URL}/og-image.jpg`,
    downloadUrl:
      "https://github.com/sahsisunny/care-ring/releases/download/v1.0.4/CareRing-v1.0.4-production.apk",
    author: {
      "@type": "Person",
      name: "Sunny Sahsi",
      url: "https://github.com/sahsisunny",
    },
  };

  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <head>
        <meta property="og:site_name" content="CareRing" />
        <meta property="og:title" content="CareRing — Open-Source Family Safety & Real-Time Location Tracker" />
        <meta property="og:description" content="Private, battery-optimized, real-time family location tracking, smart geofencing, and instant safety alerts." />
        <meta property="og:image" content={`${SITE_URL}/og-image.jpg`} />
        <meta property="og:image:secure_url" content={`${SITE_URL}/og-image.jpg`} />
        <meta property="og:image:type" content="image/jpeg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="CareRing — Open-Source Family Safety Platform" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@sahsisunny" />
        <meta name="twitter:creator" content="@sahsisunny" />
        <meta name="twitter:title" content="CareRing — Open-Source Family Safety & Real-Time Location Tracker" />
        <meta name="twitter:description" content="Private, battery-optimized, real-time family location tracking, smart geofencing, and instant safety alerts." />
        <meta name="twitter:image" content={`${SITE_URL}/og-image.jpg`} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <div className="ambient-glow-container" aria-hidden="true">
          <div className="ambient-glow-top" />
          <div className="ambient-glow-bottom" />
        </div>

        {/* Global Navigation Bar */}
        <header className="navbar-wrapper">
          <nav className="navbar" aria-label="Main Navigation">
            <Link href="/" className="logo-brand" aria-label="CareRing Home">
              <Image
                src="/icon.png"
                alt="CareRing Logo"
                width={38}
                height={38}
                priority
                className="logo-image"
              />
              <span className="brand-text-title">
                CareRing
                <span className="brand-text-badge">v1.0.4</span>
              </span>
            </Link>

            <div className="nav-links">
              <a href="#features">Features</a>
              <a href="#maps">Map Styles</a>
              <a href="#pipeline">Roadmap</a>
              <a href="#comparison">Comparison</a>
              <a href="#architecture">Architecture</a>
              <a href="#download">Download APK</a>
              <a
                href="https://github.com/sahsisunny/care-ring"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
            </div>

            <div className="nav-actions">
              <div className="live-pill" title="Live WebSocket & API cluster active">
                <span className="live-dot" />
                <span className="live-pill-text">Cloud Online</span>
              </div>
              <a
                href="https://github.com/sahsisunny/care-ring/releases/download/v1.0.4/CareRing-v1.0.4-production.apk"
                className="btn-primary nav-cta-btn"
                download
              >
                <span>Get App</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </a>
            </div>
          </nav>
        </header>

        {children}

        {/* Global Footer */}
        <footer className="footer-wrapper">
          <div className="footer">
            <div className="logo-brand">
              <Image
                src="/icon.png"
                alt="CareRing Logo"
                width={32}
                height={32}
                className="logo-image"
              />
              <span className="brand-text-title">CareRing</span>
            </div>

            <div className="footer-nav">
              <a href="#features">Features</a>
              <a href="#maps">Map Styles</a>
              <a href="#comparison">Comparison</a>
              <a href="#architecture">Privacy &amp; Security</a>
              <a href="#download">Releases</a>
              <a
                href="https://github.com/sahsisunny/care-ring/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
              >
                MIT License
              </a>
              <a
                href="https://care-ring.onrender.com/health"
                target="_blank"
                rel="noopener noreferrer"
              >
                API Health
              </a>
              <a
                href="https://github.com/sahsisunny/care-ring"
                target="_blank"
                rel="noopener noreferrer"
              >
                Source Code
              </a>
            </div>

            <p className="footer-credit">
              CareRing is completely open source under{" "}
              <a
                href="https://github.com/sahsisunny/care-ring/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
              >
                MIT License
              </a>
              . Crafted with Next.js Server Components, React Native, Fastify &amp; PostgreSQL (PostGIS). Designed &amp; maintained by{" "}
              <a
                href="https://github.com/sahsisunny"
                target="_blank"
                rel="noopener noreferrer"
              >
                Sunny Sahsi
              </a>
              .
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
