/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B1220",
        line: "#D8E6F7",
        paper: "#F7FBFF",
        mint: "#D9F3FF",
        coral: "#2563EB",
        blue: "#0891B2",
        amber: "#60A5FA",
      },
      boxShadow: {
        soft: "0 18px 60px rgba(15, 38, 76, 0.1)",
      },
    },
  },
  plugins: [],
};
