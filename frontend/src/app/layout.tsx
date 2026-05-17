import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PediaCare AI — Pediatric Clinic Management',
  description: 'AI-powered pediatric clinic management with smart charting, AI medical scribe, and intelligent triage.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-background antialiased">
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
