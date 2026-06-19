/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        ink: {
          50: "#F4F6F8",
          100: "#E6E8EB",
          200: "#C9CFD6",
          300: "#7A828D",
          400: "#525B68",
          500: "#3A424E",
          600: "#2C333D",
          700: "#22272F",
          800: "#181C22",
          850: "#151A20",
          900: "#101216",
          950: "#0A0B0D",
        },
        safety: {
          50: "#FFF8E6",
          300: "#FFD27A",
          400: "#FBBF24",
          500: "#F5A524",
          600: "#D98308",
          700: "#B56906",
        },
        hazard: {
          400: "#FF6166",
          500: "#E5484D",
          600: "#CE2C31",
          700: "#A11F23",
        },
        ok: {
          400: "#46C77A",
          500: "#30A46C",
          600: "#2B9A66",
          700: "#1E7A4F",
        },
        recheck: {
          400: "#FF9442",
          500: "#F76B15",
          600: "#D4550A",
        },
      },
      fontFamily: {
        display: ['"Big Shoulders Display"', "Impact", "sans-serif"],
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(245,165,36,0.35), 0 0 24px -4px rgba(245,165,36,0.45)",
        hazard: "0 0 0 1px rgba(229,72,77,0.45), 0 0 28px -6px rgba(229,72,77,0.55)",
      },
      keyframes: {
        scan: {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "40%": { opacity: "0.7" },
          "100%": { transform: "translateY(2200%)", opacity: "0" },
        },
        flicker: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        riseIn: {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        scan: "scan 3.2s linear infinite",
        flicker: "flicker 2.4s ease-in-out infinite",
        riseIn: "riseIn 0.35s ease-out both",
      },
    },
  },
  plugins: [],
};
