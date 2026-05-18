import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PriceBD - Best Price Comparison in Bangladesh",
  description: "Compare product prices across all Bangladeshi online stores. Find the lowest price and save money on every purchase.",
  keywords: ["price comparison", "Bangladesh", "BDT", "online shopping", "daraz", "startech", "best price", "save money"],
  authors: [{ name: "PriceBD" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "PriceBD - Best Price Comparison in Bangladesh",
    description: "Compare product prices across all Bangladeshi online stores and find the best deals.",
    siteName: "PriceBD",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PriceBD - Best Price Comparison in Bangladesh",
    description: "Compare product prices across all Bangladeshi online stores and find the best deals.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
