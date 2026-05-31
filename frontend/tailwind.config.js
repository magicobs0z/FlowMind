/** @type {import('tailwindcss').Config} */
import { heroui } from "@heroui/react";

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        flowmind: {
          primary: "#0099FF",
          bg: "#FFFFFF",
          layer: "#F4F4F4",
        },
      },
    },
  },
  darkMode: "class",
  plugins: [heroui()],
};
