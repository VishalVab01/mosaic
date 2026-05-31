import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MONO AI - AI & SaaS Template",
  description: "A responsive Next.js clone of the MONO AI Framer landing page.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
