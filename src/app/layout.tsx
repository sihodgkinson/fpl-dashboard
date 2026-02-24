import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/common/ThemeProvider"; // ✅ import ThemeProvider

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://gameweekiq.com"),
  title: "GameweekIQ",
  description:
    "Mini-league standings, decoded. Every change explained with live FPL decision insights.",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [{ url: "/favicon.ico?v=2", sizes: "any" }],
    shortcut: ["/favicon.ico?v=2"],
    apple: [{ url: "/apple-touch-icon.png?v=2", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    url: "https://gameweekiq.com",
    siteName: "GameweekIQ",
    title: "GameweekIQ",
    description:
      "Mini-league standings, decoded. Every change explained with live FPL decision insights.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "GameweekIQ - FPL mini-league intelligence",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GameweekIQ",
    description:
      "Mini-league standings, decoded. Every change explained with live FPL decision insights.",
    images: ["/og-image.png"],
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
        <ThemeProvider
          attribute="class"              // ✅ toggles dark mode via class
          defaultTheme="system"          // ✅ default follows system preference
          enableSystem                   // ✅ allow system theme
          disableTransitionOnChange      // ✅ prevents flicker when toggling
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
