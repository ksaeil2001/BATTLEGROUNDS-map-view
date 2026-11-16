import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BATTLEGROUNDS Map View · 태이고 샘플 지도 뷰어',
  description:
    '비공식 PUBG 태이고 지도 탐색 뷰어 — 8192×8192 Canonical Pixel Space 기반 정적 샘플 지도',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
