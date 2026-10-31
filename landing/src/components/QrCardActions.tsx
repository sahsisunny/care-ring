'use client';

import React, { useState } from 'react';
import { Download, Share2, Check, Loader2, Sparkles } from 'lucide-react';
import { downloadQrCard, shareQrCard } from '@/lib/qrCardGenerator';

export interface QrCardActionsProps {
  url?: string;
  title?: string;
  subtitle?: string;
  filename?: string;
  className?: string;
}

export function QrCardActions({
  url = 'https://github.com/sahsisunny/care-ring/releases/download/v1.0.5/CareRing-latest.apk',
  title = 'CareRing',
  subtitle = 'Private Family GPS Radar & Safety',
  filename = 'CareRing-Share-QR-Card.png',
  className = '',
}: QrCardActionsProps) {
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const showStatus = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => {
      setStatusMsg(null);
    }, 2800);
  };

  const handleDownload = async () => {
    if (downloading || sharing) return;
    try {
      setDownloading(true);
      await downloadQrCard({ url, title, subtitle, filename });
      showStatus('QR Card downloaded!');
    } catch (err) {
      console.error('Failed to download QR card:', err);
      showStatus('Failed to download');
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    if (downloading || sharing) return;
    try {
      setSharing(true);
      const res = await shareQrCard({ url, title, subtitle, filename });
      if (res === 'shared') {
        showStatus('Card shared!');
      } else {
        showStatus('Card downloaded!');
      }
    } catch (err) {
      console.error('Failed to share QR card:', err);
      showStatus('Download fallback used');
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className={`qr-card-actions-container ${className}`}>
      <div className="qr-card-actions-row">
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading || sharing}
          className="btn-qr-action primary"
          title="Download branded 800×960 HD QR share card (PNG) to send to family"
          aria-label="Download QR share card image"
        >
          {downloading ? (
            <>
              <Loader2 size={13} className="spin-icon" />
              <span>Saving...</span>
            </>
          ) : statusMsg && statusMsg.includes('downloaded') ? (
            <>
              <Check size={13} className="success-icon" />
              <span>Saved!</span>
            </>
          ) : (
            <>
              <Download size={13} />
              <span>Save Card</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleShare}
          disabled={downloading || sharing}
          className="btn-qr-action secondary"
          title="Share QR card directly via WhatsApp, Telegram, or messages"
          aria-label="Share QR card image"
        >
          {sharing ? (
            <>
              <Loader2 size={13} className="spin-icon" />
              <span>Sharing...</span>
            </>
          ) : statusMsg && statusMsg.includes('shared') ? (
            <>
              <Check size={13} className="success-icon" />
              <span>Shared!</span>
            </>
          ) : (
            <>
              <Share2 size={13} />
              <span>Share</span>
            </>
          )}
        </button>
      </div>

      <div className="qr-card-share-hint">
        <Sparkles size={11} className="sparkle-hint-icon" />
        <span>HD share card for WhatsApp &amp; SMS</span>
      </div>

      {statusMsg && (
        <div className="qr-status-pill" role="status" aria-live="polite">
          <Check size={12} />
          <span>{statusMsg}</span>
        </div>
      )}
    </div>
  );
}
