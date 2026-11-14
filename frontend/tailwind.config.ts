import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // doughroom.co brand — warm brown palette from logo
        primary: {
          50:  "#fdf6f0",
          100: "#faeadb",
          200: "#f4d0b2",
          300: "#ecb07f",
          400: "#e28a4a",
          500: "#c4703a",
          600: "#a85a2e",
          700: "#8b4513",
          800: "#6e3610",
          900: "#4a240b",
          950: "#2d1507",
        },
        cream: {
          50:  "#fefcf8",
          100: "#fdf6ed",
          200: "#f9ead6",
          300: "#f4d9b8",
          400: "#edc494",
        },
      },
    },
  },
  plugins: [],
};

export default config;
