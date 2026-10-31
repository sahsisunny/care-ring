'use client';

import React, { useState } from 'react';
import { DollarSign, Sparkles, Check, X } from 'lucide-react';

export function SavingsCalculator() {
  const [familyMembers, setFamilyMembers] = useState<number>(4);

  // Commercial subscriptions are typically $24.99/mo ($299.88/year)
  const monthlyFee = 24.99;
  const yearlyCommercialCost = Math.round(monthlyFee * 12);
  const threeYearCost = yearlyCommercialCost * 3;

  return (
    <div className="calculator-card-wrapper">
      <div className="calculator-inner">
        <div className="calculator-header">
          <div className="calc-badge">
            <DollarSign size={14} />
            <span>Interactive Family Savings Calculator</span>
          </div>
          <h3 className="calc-title">
            See how much your family saves with CareRing
          </h3>
          <p className="calc-subtitle">
            Commercial safety apps charge expensive monthly subscriptions while monetizing your location history. CareRing offers full safety with zero cost.
          </p>
        </div>

        <div className="calc-slider-box">
          <div className="slider-label-row">
            <span className="slider-question">How many family members in your circle?</span>
            <span className="slider-counter">
              <strong>{familyMembers}</strong> {familyMembers === 1 ? 'member' : 'members'}
            </span>
          </div>

          <input
            type="range"
            min="2"
            max="8"
            step="1"
            value={familyMembers}
            onChange={(e) => setFamilyMembers(Number(e.target.value))}
            className="calc-range-slider"
            aria-label="Family circle members"
          />

          <div className="slider-ticks">
            <span>2 members</span>
            <span>4 members</span>
            <span>6 members</span>
            <span>8 members</span>
          </div>
        </div>

        <div className="calc-comparison-grid">
          {/* CareRing Column */}
          <div className="calc-plan-card carering-highlight">
            <div className="plan-badge-pill">Recommended • 100% Free</div>
            <div className="plan-name">CareRing</div>
            <div className="plan-price-row">
              <span className="plan-price">$0</span>
              <span className="plan-period">/ month forever</span>
            </div>
            <div className="plan-yearly-sub">Total 3-Year Cost: <strong>$0.00</strong></div>

            <ul className="plan-features-list">
              <li>
                <span className="feat-check" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <Check size={13} />
                </span>
                <span><strong>Unlimited Safe Places</strong> (Home, School, Work, Sports)</span>
              </li>
              <li>
                <span className="feat-check" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <Check size={13} />
                </span>
                <span><strong>Automated Crash Detection</strong> included at zero cost</span>
              </li>
              <li>
                <span className="feat-check" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <Check size={13} />
                </span>
                <span><strong>30-Day Location Trails</strong> with speed analytics</span>
              </li>
              <li>
                <span className="feat-check" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <Check size={13} />
                </span>
                <span><strong>Ghost Mode Privacy</strong> to protect teen independence</span>
              </li>
              <li>
                <span className="feat-check" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <Check size={13} />
                </span>
                <span><strong>Strict Zero Data Selling</strong> (MIT open-source pledge)</span>
              </li>
            </ul>
          </div>

          {/* Other Apps Column */}
          <div className="calc-plan-card commercial-dim">
            <div className="plan-badge-pill gray">Other Apps</div>
            <div className="plan-name">Other Commercial Apps</div>
            <div className="plan-price-row">
              <span className="plan-price red">${monthlyFee}</span>
              <span className="plan-period">/ month</span>
            </div>
            <div className="plan-yearly-sub">
              Total 3-Year Cost: <strong>${threeYearCost.toLocaleString()}</strong>
            </div>

            <ul className="plan-features-list commercial-list">
              <li>
                <span className="feat-cross" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <X size={12} />
                </span>
                <span>Free tier locked to only 2 safe places</span>
              </li>
              <li>
                <span className="feat-cross" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <X size={12} />
                </span>
                <span>Crash dispatch locked behind $15-$25 paywalls</span>
              </li>
              <li>
                <span className="feat-cross" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <X size={12} />
                </span>
                <span>Free tier location history limited to 2 days</span>
              </li>
              <li>
                <span className="feat-cross" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <X size={12} />
                </span>
                <span>Location telemetry brokered to data &amp; insurance brokers</span>
              </li>
              <li>
                <span className="feat-cross" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <X size={12} />
                </span>
                <span>Closed proprietary cloud with zero self-hosting</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Savings summary banner */}
        <div className="calc-savings-banner">
          <div className="savings-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--amber)' }}>
            <Sparkles size={24} />
          </div>
          <div className="savings-text">
            <div className="savings-headline">
              Your family keeps <strong>${threeYearCost.toLocaleString()}</strong> in your pocket
            </div>
            <div className="savings-subline">
              Plus complete sovereignty over your coordinates. No subscriptions to cancel, no credit card required.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
