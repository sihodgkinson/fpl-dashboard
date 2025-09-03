import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}", // NEW
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",      // optional, in case you use classes in lib
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;