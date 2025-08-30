import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider"; // ✅ import ThemeProvider

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FPL Dashboard",
  description: "Fantasy Premier League Insights Dashboard",
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