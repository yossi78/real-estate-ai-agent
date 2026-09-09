/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#e2e8f0",
        moss: "#34d399",
        mossDark: "#10b981",
        sand: "#0f172a",
        clay: "#fb7185",
        paper: "#0b1220",
      },
      fontFamily: {
        sans: ["Heebo", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(0, 0, 0, 0.35), 0 18px 40px -20px rgba(0, 0, 0, 0.65)",
        glow: "0 0 0 1px rgba(52, 211, 153, 0.2), 0 10px 24px -12px rgba(16, 185, 129, 0.45)",
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
      },
      animation: {
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
