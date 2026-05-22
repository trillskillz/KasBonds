import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'KSB',
  description: 'Kaspa Service Bond Protocol reference implementation',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body
        style={{
          margin: 0,
          background: '#0a0b0f',
          color: '#f5f7fb',
          fontFamily: '"Plus Jakarta Sans", sans-serif',
        }}
      >
        {children}
      </body>
    </html>
  );
}
