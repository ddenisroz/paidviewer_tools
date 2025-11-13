import { fontFamily } from "tailwindcss/defaultTheme";
import tailwindcssAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    './pages/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", ...fontFamily.sans],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        // Простая анимация для ChatCard (главная страница)
        "fadeIn": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        // Крутые анимации для OBS виджета
        "slideInUp": {
          "0%": { 
            opacity: "0", 
            transform: "translateY(20px)" 
          },
          "100%": { 
            opacity: "1", 
            transform: "translateY(0)" 
          },
        },
        "slideInRight": {
          "0%": { 
            opacity: "0", 
            transform: "translateX(30px)" 
          },
          "100%": { 
            opacity: "1", 
            transform: "translateX(0)" 
          },
        },
        "slideInLeft": {
          "0%": { 
            opacity: "0", 
            transform: "translateX(-30px)" 
          },
          "100%": { 
            opacity: "1", 
            transform: "translateX(0)" 
          },
        },
        "bounceIn": {
          "0%": { 
            opacity: "0", 
            transform: "scale(0.3)" 
          },
          "50%": { 
            opacity: "1", 
            transform: "scale(1.05)" 
          },
          "70%": { 
            transform: "scale(0.9)" 
          },
          "100%": { 
            transform: "scale(1)" 
          },
        },
        "scaleIn": {
          "0%": { 
            opacity: "0", 
            transform: "scale(0.8)" 
          },
          "100%": { 
            opacity: "1", 
            transform: "scale(1)" 
          },
        },
        "rotateIn": {
          "0%": { 
            opacity: "0", 
            transform: "rotate(-10deg) scale(0.9)" 
          },
          "100%": { 
            opacity: "1", 
            transform: "rotate(0deg) scale(1)" 
          },
        },
        "glowPulse": {
          "0%, 100%": { 
            boxShadow: "0 0 5px rgba(147, 51, 234, 0.3)" 
          },
          "50%": { 
            boxShadow: "0 0 20px rgba(147, 51, 234, 0.6), 0 0 30px rgba(147, 51, 234, 0.4)" 
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        // Простая анимация для ChatCard
        "fadeIn": "fadeIn 0.5s ease-out",
        // Анимации для OBS виджета
        "slideInUp": "slideInUp 0.4s ease-out",
        "slideInRight": "slideInRight 0.4s ease-out",
        "slideInLeft": "slideInLeft 0.4s ease-out",
        "bounceIn": "bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        "scaleIn": "scaleIn 0.3s ease-out",
        "rotateIn": "rotateIn 0.5s ease-out",
        "glowPulse": "glowPulse 2s ease-in-out infinite",
      },
    },
  },
  plugins: [
    tailwindcssAnimate
  ],
}
