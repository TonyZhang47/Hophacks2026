import type { Config } from "tailwindcss";

// Tokens from DESIGN_SYSTEM.md (Material You, purple seed). No raw hex in components.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        md: {
          background: "#FFFBFE",
          "on-background": "#1C1B1F",
          primary: "#6750A4",
          "on-primary": "#FFFFFF",
          "secondary-container": "#E8DEF8",
          "on-secondary-container": "#1D192B",
          tertiary: "#7D5260",
          "on-tertiary": "#FFFFFF",
          "surface-container": "#F3EDF7",
          "surface-container-low": "#E7E0EC",
          outline: "#79747E",
          "on-surface-variant": "#49454F",
          error: "#B3261E",
        },
        sev: {
          major: "#B3261E",
          moderate: "#7D5260",
          minor: "#6750A4",
          unknown: "#79747E",
        },
      },
      fontFamily: {
        sans: ["var(--font-roboto)", "Roboto", "system-ui", "sans-serif"],
      },
      fontSize: {
        display: ["3.5rem", { lineHeight: "1.2", fontWeight: "500" }],
        headline: ["2rem", { lineHeight: "1.25", fontWeight: "500" }],
        title: ["1.5rem", { lineHeight: "1.3", fontWeight: "500" }],
        body: ["1.25rem", { lineHeight: "1.55" }],
        label: ["1rem", { lineHeight: "1.4", fontWeight: "500", letterSpacing: "0.01em" }],
        meta: ["0.875rem", { lineHeight: "1.4" }],
      },
      borderRadius: {
        "4xl": "2rem",
        hero: "3rem",
      },
      transitionTimingFunction: {
        md: "cubic-bezier(0.2, 0, 0, 1)",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(28,27,31,0.06), 0 1px 3px rgba(28,27,31,0.08)",
        md: "0 4px 12px rgba(28,27,31,0.10), 0 2px 4px rgba(28,27,31,0.06)",
        lg: "0 12px 32px rgba(28,27,31,0.12), 0 4px 8px rgba(28,27,31,0.06)",
        xl: "0 24px 48px rgba(28,27,31,0.16)",
      },
    },
  },
  plugins: [],
};

export default config;
