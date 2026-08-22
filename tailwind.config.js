/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        poop: {
          50: "#fdf8f0",
          100: "#fbeed8",
          500: "#b45309",
          600: "#92400e",
          900: "#78350f",
        },
      },
    },
  },
  plugins: [],
};
