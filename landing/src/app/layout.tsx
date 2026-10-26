import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
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
    default: "CareRing APK — Free Private Family GPS Tracker & Radar",
    template: "%s | CareRing",
  },
  description:
    "Download CareRing APK v1.0.5. Free private family GPS tracker & radar. Sub-50ms live sync, automatic crash detection, and unlimited geofenced safe places.",
  applicationName: "CareRing",
  category: "Family Safety & Navigation",
  keywords: [
    "CareRing",
    "CareRing APK",
    "CareRing APK download",
    "CareRing APK features",
    "CareRing-latest.apk",
    "CareRing Android APK",
    "CareRing features",
    "free Life360 alternative APK",
    "Life360 alternative APK features",
    "open source Life360 APK",
    "private family GPS tracker APK",
    "family safety radar APK",
    "automatic crash detection APK",
    "driving safety app Android APK",
    "unlimited geofence safe places",
    "Ghost Mode GPS tracker APK",
    "self hosted family locator",
    "private location sharing app Android",
    "zero tracking family radar APK",
    "battery optimized GPS tracker APK",
  ],
  authors: [{ name: "Sunny Sahsi", url: "https://github.com/sahsisunny" }],
  creator: "Sunny Sahsi",
  publisher: "CareRing Open Source",
  formatDetection: {
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CareRing",
  },
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
    title: "CareRing APK Download — Free Private Family GPS Tracker & Radar (Official APK)",
    description:
      "Download CareRing APK v1.0.5. Real-time sub-50ms family GPS radar, automatic crash detection, unlimited geofenced safe places, and Ghost Mode with zero subscriptions.",
    images: [
      {
        url: "/og-image.jpg",
        secureUrl: `${SITE_URL}/og-image.jpg`,
        width: 1200,
        height: 630,
        type: "image/jpeg",
        alt: "CareRing — Free Private Family GPS Tracker & Radar (Official APK)",
      },
      {
        url: "/og-image.png",
        secureUrl: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        type: "image/png",
        alt: "CareRing — Free Private Family GPS Tracker & Radar (Official APK)",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@sahsisunny",
    creator: "@sahsisunny",
    title: "CareRing APK Download — Free Private Family GPS Tracker & Radar (Official APK)",
    description:
      "Download CareRing APK v1.0.5. Sub-50ms live family radar, crash detection, unlimited places, and zero subscriptions.",
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
        operatingSystem: "Android 8.0, Android 9.0, Android 10, Android 11, Android 12, Android 13, Android 14, Android 15",
        applicationCategory: "SafetyApplication",
        applicationSubCategory: "Family Safety GPS Tracker & Radar",
        softwareVersion: "1.0.5",
        fileFormat: "application/vnd.android.package-archive",
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
          "CareRing is a high-performance, open-source family safety and location sharing platform featuring sub-50ms live GPS radar, intelligent crash detection, unlimited geofenced safe places, and Ghost Mode.",
        image: `${SITE_URL}/og-image.jpg`,
        permissions:
          "ACCESS_FINE_LOCATION, ACCESS_BACKGROUND_LOCATION, ACTIVITY_RECOGNITION, POST_NOTIFICATIONS",
        releaseNotes:
          "CareRing APK v1.0.5: Sub-50ms live family radar, automated crash detection, unlimited geofenced places, and Ghost Mode location cloaking.",
        featureList: [
          "Sub-50ms live GPS family radar",
          "Automated vehicular crash impact detection (>3.5G)",
          "Unlimited custom-radius geofenced safe places",
          "Ghost Mode location cloaking and privacy autonomy",
          "30-day complete location history replay",
          "Adaptive sensor-gated battery preserver (<1% drain/hr)",
          "Driving safety scores (0–100) and telemetry logs",
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
        potentialAction: {
          "@type": "SearchAction",
          target: `${SITE_URL}/features#{search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <head>
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
