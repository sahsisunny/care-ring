'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Sun, Moon, Download, X } from 'lucide-react';

export const LATEST_APK_URL =
  'https://github.com/sahsisunny/care-ring/releases/download/v1.0.5/CareRing-latest.apk';

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const timer = setTimeout(() => {
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
      } catch {
        // Ignore storage access restrictions
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    try {
      localStorage.setItem('care-ring-theme', nextTheme);
    } catch {
      // Ignore storage access restrictions
    }
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
            href="/download"
            style={{
              color: isActive('/download') ? 'var(--primary)' : undefined,
              fontWeight: isActive('/download') ? 800 : 600,
            }}
          >
            Download
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
            <Download size={15} />
          </a>

          {/* Theme Mode Switcher (Light / Dark) */}
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Mobile hamburger toggle (visible on small screens) */}
          <button
            type="button"
            className="mobile-hamburger-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X size={20} />
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
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
            <span>Features &amp; Safety Tools</span>
            <span style={{ fontSize: '11px', color: 'var(--emerald)', fontWeight: 700 }}>12 Features →</span>
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
          <Link
            href="/developers"
            onClick={() => setMobileMenuOpen(false)}
            className="mobile-nav-item"
            style={{ color: isActive('/developers') ? 'var(--primary)' : undefined }}
          >
            <span>Developers &amp; Self-Hosting</span>
            <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700 }}>Docker &amp; API →</span>
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
            <span style={{ fontWeight: 700, color: 'var(--primary)', textTransform: 'capitalize', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
              <span>{theme === 'dark' ? 'Dark' : 'Light'} Mode</span>
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
