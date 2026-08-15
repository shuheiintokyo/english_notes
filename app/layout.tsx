
import './globals.css';
import type { Metadata, Viewport } from 'next';
export const metadata: Metadata = {
  title: '英語添削ノート',
  description: '書いて、後で学ぶ - オフライン対応英語添削アプリ',
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#4f46e5'
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-slate-100 text-slate-900 antialiased min-h-screen">{children}</body>
    </html>
  );
}
