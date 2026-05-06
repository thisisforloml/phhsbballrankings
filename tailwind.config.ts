import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-barlow-condensed)"],
        sans: ["var(--font-plus-jakarta)"],
        mono: ["var(--font-ibm-plex-mono)"]
      },
      colors: {
        navy: {
          950: "#060D1F",
          900: "#0A1530",
          800: "#0F2044",
          700: "#162B5C",
          600: "#1D3875",
          500: "#24458E",
          400: "#3D5CA8",
          300: "#6B84C4",
          200: "#A8B8E0",
          100: "#D6DFF2",
          50: "#EEF2FA"
        },
        amber: {
          700: "#B85E00",
          600: "#D06C00",
          500: "#F5870A",
          400: "#FF9E35",
          300: "#FFB860",
          200: "#FFD4A0",
          100: "#FFF0DC",
          50: "#FFFAF3"
        },
        surface: {
          0: "#FFFFFF",
          50: "#F9F9FA",
          100: "#F2F3F5",
          150: "#E8EAEE",
          200: "#D8DBE3",
          300: "#B8BCC9",
          400: "#8B90A3",
          500: "#636879",
          600: "#484D5E",
          700: "#2E3244",
          800: "#1A1D2E"
        },
        ink: {
          900: "#1A1D2E",
          800: "#2E3244",
          700: "#2E3244",
          600: "#484D5E",
          500: "#636879",
          400: "#8B90A3",
          300: "#B8BCC9"
        },
        win: { bg: "#E6F4ED", text: "#1A5C35", pill: "#1A5C35" },
        loss: { bg: "#FAE8EA", text: "#8B0C1A", pill: "#8B0C1A" }
      },
      fontSize: {
        "stat-xl": ["7rem", { lineHeight: "1", letterSpacing: "0", fontWeight: "800" }],
        "stat-lg": ["4.5rem", { lineHeight: "1", letterSpacing: "0", fontWeight: "800" }],
        "stat-md": ["2.5rem", { lineHeight: "1.1", letterSpacing: "0", fontWeight: "700" }],
        "stat-sm": ["1.5rem", { lineHeight: "1.2", letterSpacing: "0", fontWeight: "700" }],
        label: ["0.65rem", { lineHeight: "1", letterSpacing: "0.12em", fontWeight: "500" }],
        "mono-sm": ["0.7rem", { lineHeight: "1", letterSpacing: "0.06em" }]
      },
      boxShadow: {
        panel: "0 1px 4px rgba(15, 32, 68, 0.06)",
        navy: "0 1px 4px rgba(15, 32, 68, 0.06)"
      },
      keyframes: {
        glowOnce: {
          "0%": { textShadow: "0 0 0 rgba(245, 135, 10, 0)" },
          "45%": { textShadow: "0 0 34px rgba(245, 135, 10, 0.45)" },
          "100%": { textShadow: "0 0 0 rgba(245, 135, 10, 0)" }
        }
      },
      animation: {
        "glow-once": "glowOnce 1.1s ease-out 1"
      }
    }
  },
  plugins: []
};

export default config;
