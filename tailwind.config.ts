import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class", // ✅ correct for Tailwind v4
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;