import type { Config } from "tailwindcss";
import { designSystemTheme } from "./src/lib/design-system/tokens";

/**
 * Unified design tokens (UI/UX overhaul).
 *
 * ONE restrained palette:
 *  - primary : deep court navy/ink (brand anchor, headers, primary buttons)
 *  - accent  : a single hardwood orange (emphasis, CTAs, active state)
 *  - neutral : one gray ramp (backgrounds, borders, text)
 *  - success / warning / danger : semantic, reserved for state only
 *
 * Legacy family names (court, deep, paper, line, navy, amber, surface, ink,
 * hardwood, gold, win, loss) are intentionally repointed INTO this palette so
 * existing class usage adopts the new look without a 57-page rename. New code
 * should prefer primary / accent / neutral / semantic tokens.
 */

// Navy shifted close to black for a punchier, high-contrast structural feel
// (top bar, footer, primary buttons, hero base) while keeping a subtle blue tint.
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

const success = { 700: "#15643A", 600: "#1A7F46", 500: "#2A9D5C", 100: "#E6F4ED", 50: "#F1FAF4" };
const warning = { 700: "#92510B", 600: "#B45309", 500: "#D97706", 100: "#FCEFD6", 50: "#FDF8EF" };
const danger = { 700: "#8B1A24", 600: "#B42318", 500: "#D64545", 100: "#FBEAE8", 50: "#FEF4F3" };

const {
  colors: designSystemColors,
  boxShadow: designSystemBoxShadow,
  ...designSystemRest
} = designSystemTheme ?? {};

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
        // ---- Unified palette (preferred) ----
        primary,
        accent,
        neutral,
        success,
        warning,
        danger,

        // ---- Legacy aliases repointed into the unified palette ----
        court: {
          900: primary[900],
          800: primary[800],
          700: neutral[700],
          600: neutral[600],
          500: neutral[500],
          400: neutral[400],
          300: neutral[300]
        },
        deep: { 900: primary[950], 800: primary[800] },
        hardwood: { 700: accent[700], 600: accent[600], 500: accent[500] },
        gold: { 500: accent[400] },
        paper: { 500: neutral[50], 400: neutral[100] },
        line: { 500: neutral[200] },
        navy: {
          950: primary[950],
          900: primary[900],
          800: primary[800],
          700: primary[700],
          600: primary[600],
          500: primary[500],
          400: primary[400],
          300: primary[300],
          200: primary[200],
          100: primary[100],
          50: primary[50]
        },
        amber: {
          700: accent[700],
          600: accent[600],
          500: accent[500],
          400: accent[400],
          300: accent[300],
          200: accent[200],
          100: accent[100],
          50: accent[50]
        },
        surface: {
          0: neutral[0],
          50: neutral[50],
          100: neutral[100],
          150: neutral[150],
          200: neutral[200],
          300: neutral[300],
          400: neutral[400],
          500: neutral[500],
          600: neutral[600],
          700: neutral[700],
          800: neutral[800]
        },
        ink: {
          900: neutral[900],
          800: neutral[800],
          700: neutral[700],
          600: neutral[600],
          500: neutral[500],
          400: neutral[400],
          300: neutral[300]
        },
        win: { bg: success[100], text: success[700], pill: success[600] },
        loss: { bg: danger[100], text: danger[700], pill: danger[600] },

        // Design-system semantic + brand tokens (must not replace palette above)
        ...designSystemColors
      },
      fontSize: {
        // 5-step type scale (display / title / heading / body / caption)
        display: ["3.25rem", { lineHeight: "1.04", letterSpacing: "-0.02em", fontWeight: "800" }],
        title: ["2rem", { lineHeight: "1.1", letterSpacing: "-0.015em", fontWeight: "700" }],
        heading: ["1.25rem", { lineHeight: "1.25", letterSpacing: "-0.01em", fontWeight: "700" }],
        label: ["0.7rem", { lineHeight: "1.1", letterSpacing: "0.08em", fontWeight: "600" }],
        // numeric/stat display sizes (kept for scoreboards/profile metrics)
        "stat-xl": ["4.5rem", { lineHeight: "1", letterSpacing: "-0.02em", fontWeight: "800" }],
        "stat-lg": ["3.25rem", { lineHeight: "1.02", letterSpacing: "-0.02em", fontWeight: "800" }],
        "stat-md": ["2.25rem", { lineHeight: "1.1", letterSpacing: "-0.01em", fontWeight: "700" }],
        "stat-sm": ["1.5rem", { lineHeight: "1.15", letterSpacing: "-0.01em", fontWeight: "700" }],
        "mono-sm": ["0.7rem", { lineHeight: "1", letterSpacing: "0.04em" }]
      },
      borderRadius: {
        // one radius scale
        sm: "0.375rem",
        DEFAULT: "0.5rem",
        md: "0.5rem",
        lg: "0.75rem",
        xl: "1rem"
      },
      boxShadow: {
        // one subtle elevation system (no hard offset "comic" shadows)
        panel: "0 1px 2px rgba(15, 32, 68, 0.06), 0 1px 3px rgba(15, 32, 68, 0.04)",
        card: "0 1px 2px rgba(15, 32, 68, 0.05)",
        raised: "0 4px 16px rgba(15, 32, 68, 0.10)",
        navy: "0 1px 2px rgba(15, 32, 68, 0.06)",

        // Design-system elevation aliases (must not replace scale above)
        ...designSystemBoxShadow
      },
      keyframes: {
        glowOnce: {
          "0%": { textShadow: "0 0 0 rgba(217, 119, 6, 0)" },
          "45%": { textShadow: "0 0 24px rgba(217, 119, 6, 0.35)" },
          "100%": { textShadow: "0 0 0 rgba(217, 119, 6, 0)" }
        }
      },
      animation: {
        "glow-once": "glowOnce 1.1s ease-out 1"
      },
      ...designSystemRest
    }
  },
  plugins: []
};

export default config;
