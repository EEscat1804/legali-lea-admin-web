import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Lea brand palette — rose/coral, sourced from the mobile app's
        // app_colors.dart (primaryStart #F0AAAA → primaryEnd #EC9191).
        brand: {
          50: "#fff5f5", // bgStart
          100: "#fde8e8",
          200: "#fad1d1",
          300: "#f4b8b8", // userBubble
          400: "#f0aaaa", // primaryStart
          500: "#ec9191", // primaryEnd
          600: "#db7676",
          700: "#c85a5a", // quick-exit / deep rose
          800: "#a84848",
          900: "#7a2e2e", // toast text
        },
        // Secondary (lavender/purple) and accent (peach/orange) from the app.
        lea: {
          purple: "#9333ea",
          purpleLight: "#c084fc",
          peach: "#fb923c",
          peachLight: "#fdba74",
          cream: "#fff5f5", // bg gradient start
          peachbg: "#fff0e6", // bg gradient end
          ink: "#2e1414", // onPrimary — warm near-black text
        },
      },
      fontFamily: {
        // Lea theme: Nunito (body) + Quicksand (headings). See app/layout.tsx.
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        heading: ["var(--font-heading)", "var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
