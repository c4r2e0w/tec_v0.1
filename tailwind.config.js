/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#00A650",
          hover: "#008A43",
        },
        accent: "#00A650",
        background: "#FFFFFF",
        dark: "#1D1D1B",
        grayText: "#A7A9AC",
        border: "#F4F4F4",
        surface: "#F4F4F4",
        silver: "#A7A9AC",
        eco: {
          DEFAULT: "#00A650",
          dark: "#008A43",
          light: "#EAF8F0",
        },
        warning: {
          DEFAULT: "#C66A12",
          light: "#FFF4E8",
        },
      },
    },
  },
  plugins: [],
}
