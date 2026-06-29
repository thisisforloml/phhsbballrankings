import type { Config } from "tailwindcss";

const primary = {
  950: "#04060C",
  900: "#080B14",
  800: "#0D111C",
  700: "#151B29",
  600: "#1F2738",
  500: "#2C3850",
  400: "#475571",
  300: "#74829E",
  200: "#A8B4C9",
  100: "#D6DCE8",
  50: "#EEF1F7"
};

const accent = {
  700: "#B45309",
  600: "#D97706",
  500: "#E98A12",
  400: "#F5A524",
  300: "#FBC56A",
  200: "#FDE0AE",
  100: "#FCEFD6",
  50: "#FDF8EF"
};

const neutral = {
  0: "#FFFFFF",
  50: "#F8FAFC",
  100: "#F1F4F8",
  150: "#E9EDF3",
  200: "#DCE2EB",
  300: "#C4CCD8",
  400: "#97A1B2",
  500: "#697489",
  600: "#4B5566",
  700: "#343C4B",
  800: "#1F2632",
  900: "#121723"
};

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Geist", "Arial", "Helvetica", "sans-serif"],
        sans: ["Geist", "Arial", "Helvetica", "sans-serif"],
        mono: ["Geist", "Arial", "Helvetica", "sans-serif"],
        numeric: ["Helvetica", "Arial", "sans-serif"]
      },
      colors: {
        // Scout shell (Figma Visual Language) — typography stays Geist + font-numeric Helvetica
        scout: {
          900: "#111318",
          800: "#1B1D23",
          700: "#2B2E36",
          600: "#464A55",
          500: "#949AA6",
          50: "#F7F4EF",
          orange: "#E98A12",
          "orange-bright": "#F5A524"
        },
        primary,
        accent,
        neutral,
        court: {
          900: "#111318",
          800: "#1B1D23",
          700: "#2B2E36",
          600: "#464A55",
          500: "#6B707D",
          400: "#949AA6",
          300: "#C0C4CC"
        },
        deep: {
          900: "#07142E",
          800: "#0B1D42"
        },
        hardwood: {
          700: "#B45309",
          600: "#D97706",
          500: "#E98A12"
        },
        gold: {
          500: "#F5A524"
        },
        paper: {
          500: "#F7F4EF",
          400: "#EFE9DE"
        },
        line: {
          500: "#D9D6CF"
        },
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
        card: "0 1px 2px rgba(15, 32, 68, 0.05)",
        raised: "0 4px 16px rgba(15, 32, 68, 0.10)",
        navy: "0 1px 4px rgba(15, 32, 68, 0.06)"
      },
      keyframes: {
        glowOnce: {
          "0%": { textShadow: "0 0 0 rgba(245, 135, 10, 0)" },
          "45%": { textShadow: "0 0 34px rgba(245, 135, 10, 0.45)" },
          "100%": { textShadow: "0 0 0 rgba(245, 135, 10, 0)" }
        },
        heroEnter: {
          "0%": { transform: "translateY(18px)" },
          "100%": { transform: "translateY(0)" }
        }
      },
      animation: {
        "glow-once": "glowOnce 1.1s ease-out 1",
        "hero-enter": "heroEnter 0.5s ease-out both",
        "hero-enter-delayed": "heroEnter 0.5s ease-out 0.08s both"
      }
    }
  },
  plugins: []
};

export default config;
