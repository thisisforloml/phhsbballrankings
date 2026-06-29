import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Geist", "Arial", "Helvetica", "sans-serif"],
        sans: ["Geist", "Arial", "Helvetica", "sans-serif"],
        mono: ["Geist Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"]
      },
      colors: {
        court: { 900: "#111318", 800: "#1B1D23", 700: "#2B2E36", 600: "#464A55", 500: "#6B707D", 400: "#949AA6", 300: "#C0C4CC" },
        hardwood: { 700: "#B45309", 600: "#D97706", 500: "#E98A12" },
        gold: { 500: "#F5A524" },
        paper: { 500: "#F7F4EF", 400: "#EFE9DE" },
        line: { 500: "#D9D6CF" },
        amber: { 700: "#B85E00", 600: "#D06C00", 500: "#F5870A", 400: "#FF9E35" },
        surface: { 0: "#FFFFFF", 50: "#F9F9FA", 100: "#F2F3F5", 200: "#D8DBE3" },
        ink: { 900: "#1A1D2E", 800: "#2E3244", 700: "#2E3244", 600: "#484D5E", 500: "#636879" },
        win: { bg: "#E6F4ED", text: "#1A5C35", pill: "#1A5C35" },
        loss: { bg: "#FAE8EA", text: "#8B0C1A", pill: "#8B0C1A" }
      },
      fontSize: {
        display: ["3.25rem", { lineHeight: "1.04", fontWeight: "800" }],
        title: ["2rem", { lineHeight: "1.1", fontWeight: "700" }],
        heading: ["1.25rem", { lineHeight: "1.25", fontWeight: "700" }],
        label: ["0.7rem", { lineHeight: "1.1", letterSpacing: "0.08em", fontWeight: "600" }],
        "stat-xl": ["4.5rem", { lineHeight: "1", fontWeight: "800" }],
        "stat-lg": ["3.25rem", { lineHeight: "1.02", fontWeight: "800" }],
        "stat-md": ["2.25rem", { lineHeight: "1.1", fontWeight: "700" }],
        "stat-sm": ["1.5rem", { lineHeight: "1.15", fontWeight: "700" }],
        "mono-sm": ["0.7rem", { lineHeight: "1", letterSpacing: "0.04em" }]
      },
      boxShadow: { panel: "0 1px 2px rgba(15, 32, 68, 0.06)", card: "0 1px 2px rgba(15, 32, 68, 0.05)", raised: "0 4px 16px rgba(15, 32, 68, 0.10)" }
    }
  },
  plugins: []
};
export default config;
