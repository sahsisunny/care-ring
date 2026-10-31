'use client';

import React, { useState, useMemo } from 'react';
import { FAQS, FaqItem } from '@/data/faqs';
import { Info, X } from 'lucide-react';

export function FaqSection() {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredFaqs = useMemo(() => {
    return FAQS.filter((faq) => {
      const matchesCategory = activeCategory === 'all' || faq.category === activeCategory;
      const matchesSearch =
        searchQuery.trim() === '' ||
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  return (
    <section className="faq-section" id="faq" aria-labelledby="faq-heading">
      <div className="section-header-clean">
        <div className="clean-pill-badge">
          <Info size={14} />
          <span>Got Questions? We Have Answers</span>
        </div>
        <h2 id="faq-heading" className="clean-heading">
          Frequently Asked Questions
        </h2>
        <p className="clean-subheading">
          Everything you need to know about CareRing, family safety, battery life, and complete privacy.
        </p>
      </div>

      {/* Search and Category Filter Toolbar */}
      <div className="faq-filter-bar">
        <div className="faq-search-input-wrap">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="faq-search-icon">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search questions (e.g. battery, crash detection, privacy, free)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="faq-search-input"
            aria-label="Search frequently asked questions"
          />
          {searchQuery && (
            <button
              type="button"
              className="faq-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search query"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="faq-category-pills">
          <button
            type="button"
            className={`category-pill ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            All Questions
          </button>
          <button
            type="button"
            className={`category-pill ${activeCategory === 'start' ? 'active' : ''}`}
            onClick={() => setActiveCategory('start')}
          >
            Getting Started
          </button>
          <button
            type="button"
            className={`category-pill ${activeCategory === 'privacy' ? 'active' : ''}`}
            onClick={() => setActiveCategory('privacy')}
          >
            Privacy &amp; Safety
          </button>
          <button
            type="button"
            className={`category-pill ${activeCategory === 'battery' ? 'active' : ''}`}
            onClick={() => setActiveCategory('battery')}
          >
            Battery &amp; Speed
          </button>
          <button
            type="button"
            className={`category-pill ${activeCategory === 'comparison' ? 'active' : ''}`}
            onClick={() => setActiveCategory('comparison')}
          >
            Comparison vs Others
          </button>
        </div>
      </div>

      {/* Accordion List */}
      <div className="faq-list">
        {filteredFaqs.length > 0 ? (
          filteredFaqs.map((faq, index) => (
            <details
              key={faq.id}
              className="faq-item"
              open={index === 0 && searchQuery === ''}
            >
              <summary className="faq-question-btn">
                <span className="faq-question-text">{faq.question}</span>
                <span className="faq-icon-wrapper" aria-hidden="true">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </summary>
              <div className="faq-answer-content">
                <p>{faq.answer}</p>
              </div>
            </details>
          ))
        ) : (
          <div className="faq-no-results">
            <Info size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
            <h4>No matching questions found</h4>
            <p>Try searching for a different keyword or browse through our categories above.</p>
          </div>
        )}
      </div>
    </section>
  );
}
