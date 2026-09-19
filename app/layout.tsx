import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { DisclaimerBanner } from "@/components/layout/DisclaimerBanner";
import { Footer } from "@/components/layout/Footer";
import { LanguageProvider } from "@/components/LanguageContext";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RxPlain — understand your medicines in plain language",
  description:
    "A free public-good tool that turns dense medication labels into plain language you can read, hear, and share. Educational only, not medical advice.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={roboto.variable}>
      <body className="min-h-screen flex flex-col">
        <LanguageProvider>
          <Header />
          <DisclaimerBanner />
          <main id="main" className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pb-16">
            {children}
          </main>
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}
