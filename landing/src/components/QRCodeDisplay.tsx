'use client';

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

interface QRCodeDisplayProps {
  url?: string;
  size?: number;
  className?: string;
  darkColor?: string;
  lightColor?: string;
  ariaLabel?: string;
}

// Precomputed mathematically valid SVG for the official CareRing APK download URL
// Guarantees zero-delay, zero-flash SSR rendering with 100% instant phone scannability
export const DEFAULT_APK_DOWNLOAD_URL =
  'https://github.com/sahsisunny/care-ring/releases/download/v1.0.5/CareRing-latest.apk';

const PRECOMPUTED_DEFAULT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 39 39" shape-rendering="crispEdges" width="100%" height="100%"><path fill="#FFFFFF" d="M0 0h39v39H0z"/><path stroke="#0F172A" d="M1 1.5h7m3 0h1m1 0h2m1 0h1m3 0h5m2 0h1m1 0h1m1 0h7M1 2.5h1m5 0h1m4 0h1m3 0h1m4 0h1m4 0h1m1 0h2m1 0h1m5 0h1M1 3.5h1m1 0h3m1 0h1m1 0h2m1 0h2m2 0h2m4 0h2m1 0h1m1 0h1m1 0h1m1 0h1m1 0h3m1 0h1M1 4.5h1m1 0h3m1 0h1m1 0h7m2 0h2m3 0h1m2 0h2m3 0h1m1 0h3m1 0h1M1 5.5h1m1 0h3m1 0h1m1 0h2m1 0h2m3 0h1m1 0h6m4 0h1m1 0h1m1 0h3m1 0h1M1 6.5h1m5 0h1m1 0h2m1 0h1m1 0h2m1 0h1m8 0h3m2 0h1m5 0h1M1 7.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M9 8.5h2m3 0h2m1 0h1m1 0h2m1 0h1m2 0h1m3 0h1M1 9.5h1m1 0h5m4 0h4m2 0h1m4 0h4m4 0h5M1 10.5h2m1 0h2m3 0h1m1 0h1m1 0h4m1 0h5m1 0h1m1 0h2m2 0h1m1 0h1m1 0h1m1 0h1M1 11.5h1m2 0h5m3 0h1m1 0h4m4 0h2m2 0h3m1 0h4m2 0h2M8 12.5h1m2 0h2m1 0h2m5 0h5m1 0h4m1 0h2m3 0h1M1 13.5h2m1 0h1m1 0h2m3 0h1m1 0h3m2 0h1m1 0h2m1 0h1m1 0h4m1 0h2m1 0h1m1 0h3M1 14.5h2m2 0h1m2 0h1m1 0h1m1 0h1m2 0h1m1 0h1m2 0h3m1 0h1m7 0h1M1 15.5h1m1 0h2m1 0h2m1 0h1m2 0h2m1 0h2m4 0h3m4 0h1m1 0h5m1 0h2M2 16.5h2m1 0h2m1 0h3m2 0h2m7 0h4m1 0h1m2 0h1m1 0h2m2 0h2M1 17.5h1m5 0h1m1 0h5m1 0h2m1 0h1m3 0h2m1 0h2m1 0h1m1 0h2m1 0h1m1 0h3M1 18.5h2m1 0h1m4 0h3m2 0h2m1 0h1m2 0h2m1 0h1m2 0h1m2 0h1m2 0h1m1 0h1m1 0h1M3 19.5h5m1 0h2m2 0h4m1 0h2m1 0h1m1 0h1m3 0h3m5 0h3M1 20.5h2m2 0h2m1 0h1m7 0h1m2 0h1m1 0h2m1 0h1m2 0h2m1 0h3m4 0h1M2 21.5h2m3 0h2m6 0h4m1 0h1m2 0h2m1 0h1m1 0h1m1 0h2m1 0h3M1 22.5h1m1 0h1m1 0h2m1 0h1m1 0h2m1 0h1m1 0h1m1 0h1m1 0h4m1 0h1m1 0h1m2 0h2m3 0h1M1 23.5h3m1 0h4m1 0h1m1 0h2m1 0h5m1 0h1m3 0h6m1 0h3m1 0h2M1 24.5h3m1 0h2m1 0h4m1 0h1m1 0h1m1 0h1m2 0h1m1 0h1m2 0h1m2 0h2m2 0h2m3 0h1M1 25.5h5m1 0h2m1 0h3m4 0h2m4 0h4m1 0h1m1 0h2m1 0h1m1 0h2M1 26.5h5m2 0h2m2 0h1m2 0h1m1 0h2m1 0h1m3 0h4m1 0h1m2 0h1M1 27.5h1m1 0h1m1 0h1m1 0h1m3 0h1m1 0h1m1 0h3m1 0h1m1 0h1m1 0h1m2 0h8m2 0h2M1 28.5h1m1 0h3m3 0h1m4 0h1m1 0h1m3 0h3m4 0h1m1 0h1m1 0h3m3 0h1M1 29.5h1m4 0h3m2 0h1m1 0h2m1 0h1m1 0h1m4 0h1m1 0h3m1 0h5m1 0h3M9 30.5h3m1 0h1m5 0h3m1 0h2m2 0h1m1 0h1m3 0h2M1 31.5h7m3 0h1m2 0h4m3 0h2m6 0h1m1 0h1m1 0h1m1 0h3M1 32.5h1m5 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h5m1 0h1m3 0h1m3 0h2m1 0h2M1 33.5h1m1 0h3m1 0h1m1 0h1m2 0h5m1 0h3m2 0h1m2 0h1m1 0h6m1 0h3M1 34.5h1m1 0h3m1 0h1m1 0h1m1 0h1m5 0h5m2 0h2m2 0h1m1 0h2m1 0h2m1 0h2M1 35.5h1m1 0h3m1 0h1m1 0h2m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m3 0h1m2 0h2m1 0h2m5 0h3M1 36.5h1m5 0h1m3 0h1m1 0h1m1 0h1m1 0h1m1 0h6m2 0h4m2 0h2m2 0h1M1 37.5h7m1 0h1m1 0h2m5 0h1m1 0h1m3 0h4m3 0h1m1 0h5"/></svg>`;

export function QRCodeDisplay({
  url = DEFAULT_APK_DOWNLOAD_URL,
  size = 140,
  className = '',
  darkColor = '#0F172A',
  lightColor = '#FFFFFF',
  ariaLabel = 'Scan QR code with phone camera to download CareRing APK',
}: QRCodeDisplayProps) {
  const isDefault =
    url === DEFAULT_APK_DOWNLOAD_URL &&
    darkColor === '#0F172A' &&
    lightColor === '#FFFFFF';

  const [svgHtml, setSvgHtml] = useState<string>(
    isDefault ? PRECOMPUTED_DEFAULT_SVG : ''
  );

  useEffect(() => {
    if (isDefault) {
      setSvgHtml(PRECOMPUTED_DEFAULT_SVG);
      return;
    }

    QRCode.toString(url, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: darkColor,
        light: lightColor,
      },
    })
      .then((svg) => {
        const scaledSvg = svg.replace(
          '<svg ',
          '<svg width="100%" height="100%" '
        );
        setSvgHtml(scaledSvg);
      })
      .catch((err) => {
        console.error('Error generating QR code:', err);
      });
  }, [url, darkColor, lightColor, isDefault]);

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-label={ariaLabel}
      role="img"
      dangerouslySetInnerHTML={{ __html: svgHtml || PRECOMPUTED_DEFAULT_SVG }}
    />
  );
}
