import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { DisclaimerBanner } from "@/components/layout/DisclaimerBanner";
import { Footer } from "@/components/layout/Footer";
import { LanguageProvider } from "@/components/LanguageContext";
import { ReadSelection } from "@/components/ui/ReadSelection";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RxPlain — understand your medicines in plain language",
  description:
    "A free public-good tool that turns dense medication labels into plain language you can read, hear, and share. Educational only, not medical advice.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen flex flex-col">
        <LanguageProvider>
          <Header />
          <DisclaimerBanner />
          <main id="main" className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-16">
            {children}
          </main>
          <Footer />
          <ReadSelection />
        </LanguageProvider>
      </body>
    </html>
  );
}
