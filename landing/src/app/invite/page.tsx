import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import InviteLookupCard from "./InviteLookupCard";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.URL ||
  "https://care-ring.netlify.app";

export const metadata: Metadata = {
  title: "Join a Family Circle — CareRing",
  description: "Enter your 6-character CareRing circle invite code to join your family's private safety circle.",
  openGraph: {
    type: "website",
    url: `${SITE_URL}/invite`,
    siteName: "CareRing",
    title: "Join a Family Circle — CareRing",
    description: "Enter your circle invite code to connect with your family on CareRing. 100% private, zero commercial data selling.",
    images: [
      {
        url: "/og-image.jpg",
        secureUrl: `${SITE_URL}/og-image.jpg`,
        width: 1200,
        height: 630,
        type: "image/jpeg",
        alt: "CareRing Family Safety Circle Invitation",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Join a Family Circle — CareRing",
    description: "Enter your circle invite code to connect with your family on CareRing.",
    images: [`${SITE_URL}/og-image.jpg`],
  },
};

export default function InviteDefaultPage() {
  return (
    <main className="invite-page-wrapper">
      <div className="ambient-glow-container" aria-hidden="true">
        <div className="ambient-glow-top" />
        <div className="ambient-glow-bottom" />
      </div>

      <header className="invite-header">
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
            <span className="brand-text-badge">v1.0</span>
          </span>
        </Link>
      </header>

      <section className="invite-hero-section">
        <InviteLookupCard />
      </section>

      <footer className="invite-footer">
        <p className="invite-footer-text">
          CareRing — Open-Source Family Safety Platform • Licensed under MIT{`\n`}
          <Link href="/" className="invite-footer-link">
            Explore 6 map styles, telemetry &amp; self-hosting
          </Link>
        </p>
      </footer>
    </main>
  );
}
