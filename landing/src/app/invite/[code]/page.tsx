import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import InviteClientCard from "./InviteClientCard";

interface InvitePageProps {
  params: Promise<{
    code: string;
  }>;
}

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.URL ||
  "https://care-ring.netlify.app";

export async function generateMetadata({ params }: InvitePageProps): Promise<Metadata> {
  const { code } = await params;
  const cleanCode = (code || "").toUpperCase();
  const inviteUrl = `${SITE_URL}/invite/${cleanCode}`;

  return {
    title: `Join Family Circle (${cleanCode}) — CareRing`,
    description: `You've been invited to join a private CareRing family circle with code ${cleanCode}. Download the app to view live GPS coordinates and safety alerts.`,
    alternates: {
      canonical: inviteUrl,
    },
    openGraph: {
      type: "website",
      url: inviteUrl,
      siteName: "CareRing",
      title: `💍 Join Family Circle on CareRing (Code: ${cleanCode})`,
      description: `You have an active invite to join a private family circle on CareRing. Use invite code ${cleanCode} in the app to connect.`,
      images: [
        {
          url: "/og-image.jpg",
          secureUrl: `${SITE_URL}/og-image.jpg`,
          width: 1200,
          height: 630,
          type: "image/jpeg",
          alt: `CareRing Circle Invite Code ${cleanCode}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@sahsisunny",
      creator: "@sahsisunny",
      title: `Join Family Circle on CareRing (Code: ${cleanCode})`,
      description: `You've been invited to join a private family circle. Download the free Android APK or open CareRing.`,
      images: [`${SITE_URL}/og-image.jpg`],
    },
  };
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { code } = await params;
  const cleanCode = (code || "").toUpperCase();

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
        <InviteClientCard inviteCode={cleanCode} />
      </section>

      <footer className="invite-footer">
        <p className="invite-footer-text">
          CareRing — Open-Source Family Safety Platform • Licensed under MIT{`\n`}
          <Link href="/" className="invite-footer-link">
            Learn more about 6 map styles, telemetry &amp; self-hosting
          </Link>
        </p>
      </footer>
    </main>
  );
}
