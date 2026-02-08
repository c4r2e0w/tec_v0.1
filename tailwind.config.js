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
          DEFAULT: "#1F6B43",
          hover: "#2E8B57",
        },
        accent: "#3EDB8A",
        background: "#070B0A",
        dark: "#E6F3EE",
        grayText: "#8AA39A",
        border: "#1E2B26",
        surface: "#111A17",
        silver: "#8AA39A",
        eco: {
          DEFAULT: "#2E8B57",
          dark: "#1F6B43",
          light: "#123126",
        },
        warning: {
          DEFAULT: "#C66A12",
          light: "#3B2811",
        },
      },
    },
  },
  plugins: [],
}
