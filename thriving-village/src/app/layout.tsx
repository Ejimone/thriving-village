import type { Metadata } from "next";
import { Instrument_Sans, Libre_Baskerville } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/Toaster";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const libreBaskerville = Libre_Baskerville({
  variable: "--font-libre-baskerville",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Thriving Village — There's a place for everyone here.",
  description:
    "We connect African talent to real opportunities. Find work, win contests, learn the craft. Starting in Nigeria, across Africa.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${instrumentSans.variable} ${libreBaskerville.variable} h-full`}
    >
      {/* suppressHydrationWarning: browser extensions (e.g. Grammarly) inject
          attributes on <body> before hydration; this scopes the ignore to body. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
