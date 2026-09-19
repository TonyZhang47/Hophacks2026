import type { Config } from "tailwindcss";

// Tokens from DESIGN_SYSTEM.md rev 3 (analytics-dashboard style: white panels on a soft
// gray canvas, charcoal primary, thin borders, status pills). Token NAMES are kept from
// rev 2 so components keep working; only the VALUES changed. No raw hex in components.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        md: {
          background: "#F4F5F7", // page canvas
          "on-background": "#111318", // primary text
          primary: "#111318", // charcoal buttons / active states
          "on-primary": "#FFFFFF",
          "secondary-container": "#F1F2F4", // chips, tonal buttons
          "on-secondary-container": "#111318",
          tertiary: "#2563EB", // accent (charts, links, FAB)
          "on-tertiary": "#FFFFFF",
          "surface-container": "#FFFFFF", // panels / cards
          "surface-container-low": "#F8F9FB", // inputs, nested wells
          outline: "#E4E6EA", // hairline borders
          "outline-strong": "#C9CCD2",
          "on-surface-variant": "#6B7280", // secondary text, icons
          error: "#DC2626",
          success: "#16A34A",
          warning: "#D97706",
        },
        sev: {
          major: "#DC2626",
          moderate: "#D97706",
          minor: "#2563EB",
          unknown: "#6B7280",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        display: ["2.25rem", { lineHeight: "1.15", fontWeight: "600", letterSpacing: "-0.02em" }],
        headline: ["1.5rem", { lineHeight: "1.25", fontWeight: "600", letterSpacing: "-0.01em" }],
        title: ["1.125rem", { lineHeight: "1.35", fontWeight: "600" }],
        kpi: ["2rem", { lineHeight: "1.1", fontWeight: "600", letterSpacing: "-0.02em" }],
        body: ["1.0625rem", { lineHeight: "1.55" }],
        label: ["0.9375rem", { lineHeight: "1.4", fontWeight: "500" }],
        meta: ["0.8125rem", { lineHeight: "1.4" }],
        eyebrow: ["0.75rem", { lineHeight: "1.2", fontWeight: "600", letterSpacing: "0.08em" }],
      },
      borderRadius: {
        // Cards and panels: 16px. Keep 3xl/hero mapped so older class names still look right.
        "2xl": "1rem",
        "3xl": "1rem",
        "4xl": "1.25rem",
        hero: "1.25rem",
      },
      transitionTimingFunction: {
        md: "cubic-bezier(0.2, 0, 0, 1)",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(17,19,24,0.04)",
        md: "0 4px 16px rgba(17,19,24,0.06), 0 1px 2px rgba(17,19,24,0.04)",
        lg: "0 12px 32px rgba(17,19,24,0.10)",
        xl: "0 20px 48px rgba(17,19,24,0.14)",
      },
    },
  },
  plugins: [],
};

export default config;
