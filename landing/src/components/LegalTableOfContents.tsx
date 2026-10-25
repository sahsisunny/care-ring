'use client';

import React, { useEffect, useState, useRef } from 'react';

export interface TocItem {
  id: string;
  title: string;
  number?: string;
}

interface LegalTableOfContentsProps {
  title: string;
  items: TocItem[];
}

export function LegalTableOfContents({ title, items }: LegalTableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id || '');
  const isClickingRef = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      if (isClickingRef.current) return;

      const scrollPosition = window.scrollY + 130;
      let currentSectionId = items[0]?.id || '';

      for (const item of items) {
        const el = document.getElementById(item.id);
        if (el) {
          const top = el.offsetTop;
          if (scrollPosition >= top) {
            currentSectionId = item.id;
          }
        }
      }

      setActiveId(currentSectionId);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [items]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;

    isClickingRef.current = true;
    setActiveId(id);

    const yOffset = -90; // offset for sticky navbar
    const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;

    window.scrollTo({
      top: y,
      behavior: 'smooth',
    });

    // Update URL hash without causing instant jump
    if (window.history.pushState) {
      window.history.pushState(null, '', `#${id}`);
    }

    setTimeout(() => {
      isClickingRef.current = false;
    }, 700);
  };

  return (
    <>
      {/* ─── Mobile Sticky Horizontal Bar (visible <= 900px) ─── */}
      <div className="legal-mobile-toc-bar">
        <span className="legal-mobile-toc-label">{title}:</span>
        <div className="legal-mobile-chips">
          {items.map((item, index) => {
            const isActive = activeId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className={`legal-mobile-chip ${isActive ? 'active' : ''}`}
              >
                <span>{item.number || `${index + 1}.`}</span>
                <span>{item.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Desktop Sticky Sidebar (visible > 900px) ─── */}
      <aside className="legal-sidebar">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span className="legal-sidebar-title">{title}</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>
            {items.length} sections
          </span>
        </div>

        <ul className="legal-toc-list">
          {items.map((item, index) => {
            const isActive = activeId === item.id;
            return (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection(item.id);
                  }}
                  className={`legal-toc-link ${isActive ? 'active' : ''}`}
                >
                  <span className="toc-number">{item.number || `${index + 1}.`}</span>
                  <span className="toc-text">{item.title}</span>
                  {isActive && <span className="toc-active-dot" />}
                </a>
              </li>
            );
          })}
        </ul>

        {/* Quick Back to Top helper */}
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            marginTop: '16px',
            paddingTop: '14px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'transparent',
            borderLeft: 'none',
            borderRight: 'none',
            borderBottom: 'none',
            color: 'var(--text-muted)',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'color 0.2s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <span>↑</span>
          <span>Back to Top</span>
        </button>
      </aside>
    </>
  );
}
