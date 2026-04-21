import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        alert:  { DEFAULT: "#ef4444", light: "#fef2f2" },
        report: { DEFAULT: "#f59e0b", light: "#fffbeb" },
        hold:   { DEFAULT: "#6b7280", light: "#f9fafb" },
      },
    },
  },
  plugins: [],
};

export default config;
