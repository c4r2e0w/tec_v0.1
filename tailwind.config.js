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
          DEFAULT: "#003B73",
          hover: "#0056A6",
        },
        accent: "#0076CE",
        background: "#F5F7FA",
        dark: "#1A1A1A",
        grayText: "#6B7280",
        border: "#E5E7EB",
        eco: {
          DEFAULT: "#2E8B57",
          light: "#E6F4EA",
        },
      },
    },
  },
  plugins: [],
}
