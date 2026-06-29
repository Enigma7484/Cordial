/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        line: "#D8DEEA",
        paper: "#F5F7FF",
        mint: "#E9EDFF",
        coral: "#315CF6",
        blue: "#00A7B5",
        amber: "#FFB020",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(17, 24, 39, 0.09)",
      },
    },
  },
  plugins: [],
};
