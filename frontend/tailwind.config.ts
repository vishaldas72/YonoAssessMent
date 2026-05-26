import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#07080b",
          subtle: "#0c0e13",
          card: "#11141b",
          hover: "#171a23",
          elevated: "#1a1e28",
        },
        border: {
          DEFAULT: "#1d2330",
          strong: "#2a3142",
          accent: "#3a4561",
        },
        fg: {
          DEFAULT: "#edeff3",
          muted: "#8b94a5",
          subtle: "#5b6478",
        },
        brand: {
          DEFAULT: "#8b5cf6",
          hover: "#a78bfa",
          deep: "#7c3aed",
          subtle: "rgba(139, 92, 246, 0.12)",
          glow: "rgba(139, 92, 246, 0.35)",
        },
        accent: {
          DEFAULT: "#22d3ee",
          subtle: "rgba(34, 211, 238, 0.12)",
        },
        success: {
          DEFAULT: "#34d399",
          subtle: "rgba(52, 211, 153, 0.12)",
        },
        warning: {
          DEFAULT: "#fbbf24",
          subtle: "rgba(251, 191, 36, 0.12)",
        },
        danger: {
          DEFAULT: "#f87171",
          subtle: "rgba(248, 113, 113, 0.12)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "Menlo", "monospace"],
      },
      fontSize: {
        "display-lg": ["3rem", { lineHeight: "1.05", letterSpacing: "-0.03em", fontWeight: "700" }],
        "display": ["2.25rem", { lineHeight: "1.1", letterSpacing: "-0.025em", fontWeight: "700" }],
        "title": ["1.5rem", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "600" }],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(139, 92, 246, 0.4), 0 8px 32px -8px rgba(139, 92, 246, 0.4)",
        "glow-sm": "0 0 0 1px rgba(139, 92, 246, 0.25), 0 4px 16px -4px rgba(139, 92, 246, 0.2)",
        card: "0 1px 0 0 rgba(255, 255, 255, 0.04), 0 12px 28px -16px rgba(0, 0, 0, 0.7)",
        "card-hover": "0 1px 0 0 rgba(255, 255, 255, 0.06), 0 16px 40px -16px rgba(0, 0, 0, 0.8)",
        inner: "inset 0 1px 0 0 rgba(255, 255, 255, 0.04)",
      },
      backgroundImage: {
        "atmosphere":
          "radial-gradient(ellipse 800px 600px at 20% 0%, rgba(139, 92, 246, 0.15), transparent 50%), radial-gradient(ellipse 600px 400px at 80% 100%, rgba(34, 211, 238, 0.08), transparent 50%)",
        "grid":
          "linear-gradient(rgba(139, 92, 246, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 92, 246, 0.04) 1px, transparent 1px)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(1.2)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.35s ease-out",
        "pulse-dot": "pulse-dot 1.6s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
