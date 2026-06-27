/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17211B",
        line: "#DCE3DC",
        paper: "#F4F6F2",
        mint: "#DDF4E7",
        coral: "#E85D3F",
        blue: "#177E77",
        amber: "#F3C969",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(34, 49, 40, 0.09)",
      },
    },
  },
  plugins: [],
};
