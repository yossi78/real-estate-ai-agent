/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17211c",
        moss: "#1f6b4a",
        mossDark: "#154d36",
        sand: "#f3eee4",
        clay: "#c46a2f",
        paper: "#fffdf8",
      },
      fontFamily: {
        sans: ["Heebo", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 18px 40px -28px rgba(23, 33, 28, 0.45)",
      },
    },
  },
  plugins: [],
};
