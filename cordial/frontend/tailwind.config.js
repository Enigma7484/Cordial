/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#161616",
        line: "#E7E4DE",
        paper: "#FBFAF7",
        mint: "#CDEFE1",
        coral: "#FF7D68",
        blue: "#5A7DFF",
      },
      boxShadow: {
        soft: "0 18px 60px rgba(22, 22, 22, 0.08)",
      },
    },
  },
  plugins: [],
};
