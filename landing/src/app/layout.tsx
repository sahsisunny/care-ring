import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
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
    default: "CareRing — Free Private Family GPS Tracker & Radar (Official APK)",
    template: "%s | CareRing Family Safety",
  },
  description:
    "Download official CareRing APK v1.0.5. The private, 100% free family safety platform. Sub-50ms live GPS radar, intelligent crash detection, unlimited geofenced safe places, and Ghost Mode.",
  keywords: [
    "CareRing",
    "CareRing APK",
    "download CareRing APK",
    "CareRing-latest.apk",
    "CareRing Android",
    "CareRing features",
    "free Life360 alternative",
    "Life360 alternative APK",
    "open source Life360",
    "private family GPS tracker",
    "family safety radar APK",
    "automatic crash detection APK",
    "driving safety app Android",
    "unlimited geofence safe places",
    "Ghost Mode GPS tracker",
    "self hosted family locator",
    "private location sharing app",
    "zero tracking family radar",
  ],
  authors: [{ name: "Sunny Sahsi", url: "https://github.com/sahsisunny" }],
  creator: "Sunny Sahsi",
  publisher: "CareRing Open Source",
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
    siteName: "CareRing Family Safety",
    title: "CareRing — Free Private Family GPS Tracker & Radar (Official APK)",
    description:
      "Download CareRing APK v1.0.5. Real-time family GPS radar, automatic crash detection, and smart geofences with zero subscriptions and zero data selling.",
    images: [
      {
        url: "/og-image.jpg",
        secureUrl: `${SITE_URL}/og-image.jpg`,
        width: 1200,
        height: 630,
        type: "image/jpeg",
        alt: "CareRing — Free Private Family GPS Tracker & Radar",
      },
      {
        url: "/og-image.png",
        secureUrl: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        type: "image/png",
        alt: "CareRing — Free Private Family GPS Tracker & Radar",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@sahsisunny",
    creator: "@sahsisunny",
    title: "CareRing — Free Private Family GPS Tracker & Radar (Official APK)",
    description:
      "Download CareRing APK v1.0.5. Sub-50ms live family radar, crash detection, and zero subscriptions.",
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
  const jsonLdGraph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#application`,
        name: "CareRing",
        operatingSystem: "Android 8.0+",
        applicationCategory: "SafetyApplication",
        softwareVersion: "1.0.5",
        fileSize: "83.36 MB",
        downloadUrl:
          "https://github.com/sahsisunny/care-ring/releases/download/v1.0.5/CareRing-latest.apk",
        installUrl: `${SITE_URL}/download`,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: "4.9",
          ratingCount: "128",
          bestRating: "5",
          worstRating: "1",
        },
        description:
          "CareRing is a high-performance, open-source family safety and location sharing platform featuring sub-50ms live GPS radar, intelligent crash detection, unlimited geofenced places, and Ghost Mode.",
        image: `${SITE_URL}/og-image.jpg`,
        featureList: [
          "Sub-50ms live GPS family radar",
          "Automated vehicular crash impact detection",
          "Unlimited custom-radius geofenced safe places",
          "Ghost Mode location cloaking and privacy autonomy",
          "30-day complete location history replay",
          "Self-hosted Docker Compose deployment option",
          "Zero commercial location data monetization",
        ],
        author: {
          "@type": "Person",
          name: "Sunny Sahsi",
          url: "https://github.com/sahsisunny",
        },
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "CareRing Open Source",
        url: SITE_URL,
        logo: `${SITE_URL}/icon.png`,
        sameAs: [
          "https://github.com/sahsisunny/care-ring",
          "https://github.com/sahsisunny",
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: "CareRing",
        description: "The private, open-source family safety platform.",
        publisher: {
          "@id": `${SITE_URL}/#organization`,
        },
      },
    ],
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdGraph) }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('care-ring-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`,
          }}
        />
      </head>
      <body>
        <div className="ambient-glow-container" aria-hidden="true">
          <div className="ambient-glow-top" />
          <div className="ambient-glow-bottom" />
        </div>

        <Navbar />

        <main>{children}</main>

        <Footer />
      </body>
    </html>
  );
}
