'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { FEATURES_DATA, FeatureItem } from '@/data/features';
import {
  Radio,
  MapPin,
  Car,
  ShieldAlert,
  ShieldCheck,
  EyeOff,
  Battery,
  History,
  Users,
  Bell,
  Server,
  Smartphone,
  Sparkles,
  Check,
  Info,
  X,
} from 'lucide-react';

function FeatureIcon({ id }: { id: string }) {
  switch (id) {
    case 'radar':
      return <Radio size={22} />;
    case 'geofences':
      return <MapPin size={22} />;
    case 'driving':
      return <Car size={22} />;
    case 'crash-sos':
      return <ShieldAlert size={22} />;
    case 'ghost-mode':
      return <EyeOff size={22} />;
    case 'zero-broker':
      return <ShieldCheck size={22} />;
    case 'battery-saver':
      return <Battery size={22} />;
    case 'history-replay':
      return <History size={22} />;
    case 'circle-chat':
      return <Users size={22} />;
    case 'panic-siren':
      return <Bell size={22} />;
    case 'docker-cluster':
      return <Server size={22} />;
    case 'universal-apk':
      return <Smartphone size={22} />;
    default:
      return <Sparkles size={22} />;
  }
}

export function FeaturesClientView() {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredFeatures = useMemo(() => {
    return FEATURES_DATA.filter((feat) => {
      const matchesCategory = activeCategory === 'all' || feat.category === activeCategory;
      const matchesSearch =
        searchQuery.trim() === '' ||
        feat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        feat.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        feat.familyBenefit.toLowerCase().includes(searchQuery.toLowerCase()) ||
        feat.specs.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  return (
    <div className="features-container">
      {/* Search and Category Filter Toolbar */}
      <div className="features-filter-toolbar">
        <div className="features-search-box">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search capabilities (e.g. crash detection, ghost mode, battery, places)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="features-search-input"
            aria-label="Search features"
          />
          {searchQuery && (
            <button
              type="button"
              className="features-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search query"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="features-category-pills">
          <button
            type="button"
            className={`feat-category-btn ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            All Features ({FEATURES_DATA.length})
          </button>
          <button
            type="button"
            className={`feat-category-btn ${activeCategory === 'location' ? 'active' : ''}`}
            onClick={() => setActiveCategory('location')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <MapPin size={14} />
            <span>Location &amp; Maps</span>
          </button>
          <button
            type="button"
            className={`feat-category-btn ${activeCategory === 'driving' ? 'active' : ''}`}
            onClick={() => setActiveCategory('driving')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Car size={14} />
            <span>Driving Safety</span>
          </button>
          <button
            type="button"
            className={`feat-category-btn ${activeCategory === 'privacy' ? 'active' : ''}`}
            onClick={() => setActiveCategory('privacy')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ShieldCheck size={14} />
            <span>Privacy &amp; Ghost Mode</span>
          </button>
          <button
            type="button"
            className={`feat-category-btn ${activeCategory === 'family' ? 'active' : ''}`}
            onClick={() => setActiveCategory('family')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Users size={14} />
            <span>Family Connection</span>
          </button>
          <button
            type="button"
            className={`feat-category-btn ${activeCategory === 'dev' ? 'active' : ''}`}
            onClick={() => setActiveCategory('dev')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Server size={14} />
            <span>Open Source &amp; Self-Hosting</span>
          </button>
        </div>
      </div>

      {/* Feature Count & Status */}
      <div className="features-count-row">
        <span>
          Showing <strong>{filteredFeatures.length}</strong> of {FEATURES_DATA.length} capabilities
        </span>
        <span className="features-free-badge">
          <Check size={13} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
          100% Unlocked in Free APK
        </span>
      </div>

      {/* Features Grid */}
      <div className="features-card-grid">
        {filteredFeatures.map((feat) => (
          <div key={feat.id} className="feature-catalog-card" id={feat.id}>
            <div className="feat-card-header">
              <span className="feat-card-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                <FeatureIcon id={feat.id} />
              </span>
              <div className="feat-card-category-badge">{feat.categoryLabel}</div>
              <span className="feat-card-tag">{feat.badge}</span>
            </div>

            <h3 className="feat-card-title">{feat.title}</h3>
            <p className="feat-card-desc">{feat.description}</p>

            <div className="feat-benefit-box">
              <span className="benefit-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={14} style={{ color: 'var(--amber)' }} />
                <span>Why your family will love it:</span>
              </span>
              <p className="benefit-text">{feat.familyBenefit}</p>
            </div>

            <div className="feat-specs-list">
              {feat.specs.map((spec, i) => (
                <div key={i} className="spec-item">
                  <span className="spec-check" style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <Check size={12} />
                  </span>
                  <span>{spec}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {filteredFeatures.length === 0 && (
        <div className="features-empty-state">
          <Info size={36} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
          <h4>No matching features found</h4>
          <p>Try searching for a different keyword or reset the category filter.</p>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setSearchQuery('');
              setActiveCategory('all');
            }}
          >
            Reset All Filters
          </button>
        </div>
      )}

      {/* Honest Capabilities Matrix */}
      <div className="features-matrix-wrap">
        <div className="matrix-header">
          <h3>CareRing vs. Other Safety Apps</h3>
          <p>See what is included in CareRing for free compared to other $15–$25/mo apps.</p>
        </div>

        <div className="table-responsive-wrapper">
          <table className="comparison-table-clean">
            <thead>
              <tr>
                <th>SAFETY CAPABILITY</th>
                <th className="highlight-carering">CARERING FREE APK</th>
                <th className="commercial-alt">OTHERS (FREE TIER)</th>
                <th className="commercial-alt">OTHERS (PAID $25/MO)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Monthly Cost</td>
                <td className="highlight-carering"><strong>$0 / month</strong></td>
                <td className="commercial-alt">$0 (with ads)</td>
                <td className="commercial-alt">$24.99 / month</td>
              </tr>
              <tr>
                <td>Geofenced Safe Places</td>
                <td className="highlight-carering"><strong>Unlimited Places</strong></td>
                <td className="commercial-alt">Only 2 places</td>
                <td className="commercial-alt">Unlimited places</td>
              </tr>
              <tr>
                <td>Automatic Crash Detection &amp; SOS</td>
                <td className="highlight-carering"><strong>Included (Zero Paywall)</strong></td>
                <td className="commercial-alt">Not Included</td>
                <td className="commercial-alt">Included</td>
              </tr>
              <tr>
                <td>Location History Trails</td>
                <td className="highlight-carering"><strong>30 Days Full Replay</strong></td>
                <td className="commercial-alt">Only 2 Days</td>
                <td className="commercial-alt">30 Days</td>
              </tr>
              <tr>
                <td>Ghost Mode Privacy Blur</td>
                <td className="highlight-carering"><strong>Included (3 Levels)</strong></td>
                <td className="commercial-alt">Limited or locks circles</td>
                <td className="commercial-alt">Limited or locks circles</td>
              </tr>
              <tr>
                <td>Location Data Brokering</td>
                <td className="highlight-carering"><strong>Strict Zero (Never Sold)</strong></td>
                <td className="commercial-alt">Monetized to data brokers</td>
                <td className="commercial-alt">Monetized to data brokers</td>
              </tr>
              <tr>
                <td>Self-Hosting Sovereignty</td>
                <td className="highlight-carering"><strong>Docker Compose Included</strong></td>
                <td className="commercial-alt">Impossible</td>
                <td className="commercial-alt">Impossible</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
