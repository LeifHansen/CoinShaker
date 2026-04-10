import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // DittoCoin brand palette (from dittocoin.com)
        ditto: {
          purple: {
            900: "#1a0a2e",
            800: "#2d1052",
            700: "#0d0d2b",
            600: "#7b2fbe",
          },
          teal: {
            DEFAULT: "#1ac8b0",
            light: "#21cab9",
          },
          pink: {
            DEFAULT: "#d64b8a",
          },
          amber: "#f59e0b",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "hero-gradient":
          "linear-gradient(to right bottom, #1a0a2e, #2d1052, #0d0d2b)",
        "card-gradient":
          "linear-gradient(135deg, rgba(26,200,176,0.08), rgba(214,75,138,0.08))",
        "teal-glow":
          "radial-gradient(circle, rgba(26,200,176,0.15) 0%, transparent 70%)",
        "pink-glow":
          "radial-gradient(circle, rgba(214,75,138,0.15) 0%, transparent 70%)",
      },
      animation: {
        "float": "float 6s ease-in-out infinite",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
