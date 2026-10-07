import type { Metadata } from "next";
import SelfHostGuideClient from "./SelfHostGuideClient";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.URL ||
  "https://care-ring.netlify.app";

export const metadata: Metadata = {
  title: "Self-Hosting & APK Connection Guide — CareRing",
  description:
    "Complete step-by-step guide to self-hosting the CareRing real-time backend with Docker Compose, VPS, or Raspberry Pi, and connecting your Android APK in seconds.",
  keywords: [
    "self host Life360 alternative",
    "CareRing self hosting guide",
    "open source family tracking server",
    "Docker Compose family locator",
    "PostGIS location tracker server",
    "self host real time GPS",
    "private family safety cloud",
    "CareRing custom server setup",
  ],
  alternates: {
    canonical: `${SITE_URL}/self-host`,
  },
  openGraph: {
    type: "article",
    url: `${SITE_URL}/self-host`,
    siteName: "CareRing",
    title: "Self-Hosting & Mobile APK Connection Guide — CareRing",
    description:
      "Deploy your private CareRing telemetry stack with Docker Compose and PostGIS. Connect your APK with zero commercial cloud dependence.",
    images: [
      {
        url: "/og-image.jpg",
        secureUrl: `${SITE_URL}/og-image.jpg`,
        width: 1200,
        height: 630,
        type: "image/jpeg",
        alt: "CareRing Self-Hosting & Deployment Guide",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Self-Hosting & Mobile APK Connection Guide — CareRing",
    description:
      "Deploy your private family safety server with Docker and connect your CareRing APK in seconds.",
    images: [`${SITE_URL}/og-image.jpg`],
  },
};

export default function SelfHostPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to Self-Host CareRing Backend and Connect the Mobile APK",
    description:
      "Deploy your own private CareRing family safety server using Docker Compose and connect the Android APK directly.",
    totalTime: "PT5M",
    estimatedCost: {
      "@type": "MonetaryAmount",
      currency: "USD",
      value: "0",
    },
    step: [
      {
        "@type": "HowToStep",
        name: "Clone Repository",
        text: "Clone the official CareRing repository from GitHub.",
        url: `${SITE_URL}/self-host#deployment-guide`,
      },
      {
        "@type": "HowToStep",
        name: "Run Docker Compose",
        text: "Launch PostgreSQL 16 with PostGIS 3.4 and the Fastify gateway via docker compose up -d.",
        url: `${SITE_URL}/self-host#deployment-guide`,
      },
      {
        "@type": "HowToStep",
        name: "Configure CareRing Mobile APK",
        text: "Open the CareRing APK, tap the Server Configuration icon, enter your custom URL, and apply.",
        url: `${SITE_URL}/self-host#apk-connection`,
      },
    ],
  };

  return (
    <main className="self-host-page-wrapper">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SelfHostGuideClient />
    </main>
  );
}
