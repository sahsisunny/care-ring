'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

export const LATEST_APK_URL =
  'https://github.com/sahsisunny/care-ring/releases/download/v1.0.5/CareRing-latest.apk';

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    try {
      const current = document.documentElement.getAttribute('data-theme') as 'dark' | 'light';
      if (current === 'light' || current === 'dark') {
        setTheme(current);
      } else {
        const stored = localStorage.getItem('care-ring-theme') as 'dark' | 'light';
        if (stored) {
          setTheme(stored);
          document.documentElement.setAttribute('data-theme', stored);
        }
      }
    } catch (e) {}
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    try {
      localStorage.setItem('care-ring-theme', nextTheme);
    } catch (e) {}
  };

  const isActive = (path: string) => {
    if (path === '/' && pathname === '/') return true;
    if (path !== '/' && pathname?.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="navbar-wrapper">
      <nav className="navbar" aria-label="Main Navigation">
        {/* Brand Logo (Links to Home) */}
        <Link href="/" className="logo-brand" aria-label="CareRing Home">
          <Image
            src="/icon.png"
            alt="CareRing Logo"
            width={36}
            height={36}
            priority
            className="logo-image"
          />
          <span className="brand-text-title">CareRing</span>
          <span className="brand-text-badge">v1.0.5</span>
        </Link>

        {/* Clean, essential desktop navigation links */}
        <div className="nav-links">
          <Link
            href="/features"
            style={{
              color: isActive('/features') ? 'var(--primary)' : undefined,
              fontWeight: isActive('/features') ? 800 : 600,
            }}
          >
            Features
          </Link>
          <Link
            href="/developers"
            style={{
              color: isActive('/developers') ? 'var(--primary)' : undefined,
              fontWeight: isActive('/developers') ? 800 : 600,
            }}
          >
            Developers
          </Link>
          <Link
            href="/download"
            style={{
              color: isActive('/download') ? 'var(--primary)' : undefined,
              fontWeight: isActive('/download') ? 800 : 600,
            }}
          >
            Download
          </Link>
          <a
            href="https://github.com/sahsisunny/care-ring"
            target="_blank"
            rel="noopener noreferrer"
            title="View open-source GitHub repository"
          >
            GitHub ↗
          </a>
        </div>

        {/* Action Buttons */}
        <div className="nav-actions">
          <div className="live-pill" title="Real-time WebSocket & PostGIS cluster active">
            <span className="live-dot" />
            <span className="live-pill-text">Live Sync</span>
          </div>

          <a
            href={LATEST_APK_URL}
            className="btn-primary nav-cta-btn"
            download
            title="Download latest CareRing release APK"
          >
            <span>Get APK</span>
            <svg
              width="15"
              height="15"
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

          {/* Theme Mode Switcher (Light / Dark) */}
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          {/* Mobile hamburger toggle (visible on small screens) */}
          <button
            type="button"
            className="mobile-hamburger-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              {mobileMenuOpen ? (
                <path d="M18 6L6 18M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="mobile-nav-menu">
          <Link
            href="/features"
            onClick={() => setMobileMenuOpen(false)}
            className="mobile-nav-item"
            style={{ color: isActive('/features') ? 'var(--primary)' : undefined }}
          >
            <span>Features &amp; Capabilities</span>
            <span style={{ fontSize: '11px', color: 'var(--emerald)', fontWeight: 700 }}>16 Tools →</span>
          </Link>
          <Link
            href="/developers"
            onClick={() => setMobileMenuOpen(false)}
            className="mobile-nav-item"
            style={{ color: isActive('/developers') ? 'var(--primary)' : undefined }}
          >
            <span>Developers &amp; Self-Hosting</span>
            <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700 }}>Docker &amp; API →</span>
          </Link>
          <Link
            href="/download"
            onClick={() => setMobileMenuOpen(false)}
            className="mobile-nav-item"
            style={{ color: isActive('/download') ? 'var(--primary)' : undefined }}
          >
            <span>Download CareRing APK</span>
            <span style={{ fontSize: '11px', color: '#0284C7', fontWeight: 700 }}>v1.0.5 Release →</span>
          </Link>
          <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '6px 0' }} />
          <button
            type="button"
            onClick={toggleTheme}
            className="mobile-nav-subitem"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
              fontFamily: 'inherit',
            }}
          >
            <span>Theme Mode</span>
            <span style={{ fontWeight: 700, color: 'var(--primary)', textTransform: 'capitalize' }}>
              {theme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}
            </span>
          </button>
          <Link
            href="/privacy"
            onClick={() => setMobileMenuOpen(false)}
            className="mobile-nav-subitem"
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            onClick={() => setMobileMenuOpen(false)}
            className="mobile-nav-subitem"
          >
            Terms and Conditions
          </Link>
          <a
            href="https://github.com/sahsisunny/care-ring"
            target="_blank"
            rel="noopener noreferrer"
            className="mobile-nav-subitem"
          >
            GitHub Repository ↗
          </a>
        </div>
      )}
    </header>
  );
}
