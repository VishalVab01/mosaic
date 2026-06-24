import type { Metadata } from "next";
import "lenis/dist/lenis.css";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Mosaic",
  description: "Mosaic converts Figma designs and natural-language prompts into production-ready frontend code.",
  icons: {
    icon: "/images/mosaic-mark-transparent.png",
    shortcut: "/images/mosaic-mark-transparent.png",
    apple: "/images/mosaic-mark-transparent.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
