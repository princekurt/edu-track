import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9eaff",
          200: "#bcdcff",
          300: "#8ec6ff",
          400: "#59a6ff",
          500: "#3385f5",
          600: "#1e68e0",
          700: "#1a53b8",
          800: "#1c4794",
          900: "#1c3e75",
        },
      },
    },
  },
  plugins: [],
};

export default config;
