import { type Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px",
      },
    },
    extend: {
      fontFamily: {
        heading: ["Poppins", "sans-serif"],
      },
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
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
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
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-out": {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "slide-up": {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "slide-down": {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "progress-indeterminate": {
          "0%": { transform: "translateX(-100%)" },
          "50%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(100%)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        descend: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(180px)" },
        },
        swing: {
          "0%, 100%": { transform: "rotate(0deg)" },
          "50%": { transform: "rotate(3deg)" },
        },
        "spider-walk": {
          "0%": { transform: "translateX(0) rotate(0deg)" },
          "25%": { transform: "translateX(100px) rotate(10deg)" },
          "50%": { transform: "translateX(200px) rotate(0deg)" },
          "75%": { transform: "translateX(100px) rotate(-10deg)" },
          "100%": { transform: "translateX(0) rotate(0deg)" },
        },
        "bat-fly": {
          "0%": { transform: "translate(0, 0) scale(1)" },
          "25%": { transform: "translate(-50px, -30px) scale(0.9)" },
          "50%": { transform: "translate(-100px, 0) scale(1)" },
          "75%": { transform: "translate(-50px, 30px) scale(1.1)" },
          "100%": { transform: "translate(0, 0) scale(1)" },
        },
        "ghost-float": {
          "0%, 100%": { transform: "translateY(0) translateX(0)" },
          "25%": { transform: "translateY(-20px) translateX(10px)" },
          "50%": { transform: "translateY(0) translateX(20px)" },
          "75%": { transform: "translateY(20px) translateX(10px)" },
        },
        "web-appear": {
          "0%": { opacity: "0", transform: "scale(0)" },
          "100%": { opacity: "0.6", transform: "scale(1)" },
        },
        "wing-flap": {
          "0%, 100%": { transform: "scaleX(1) scaleY(1)" },
          "50%": { transform: "scaleX(0.7) scaleY(1.1)" },
        },
        "web-stretch": {
          "0%, 100%": { height: "0px" },
          "50%": { height: "180px" },
        },
        "scare-popup": {
          "0%": { transform: "translate(-50%, -50%) scale(0)", opacity: "0" },
          "10%": {
            transform: "translate(-50%, -50%) scale(1.3)",
            opacity: "1",
          },
          "90%": {
            transform: "translate(-50%, -50%) scale(1.3)",
            opacity: "1",
          },
          "100%": { transform: "translate(-50%, -50%) scale(0)", opacity: "0" },
        },
        "scare-slide-left": {
          "0%": {
            transform: "translateX(100%) translateY(-50%)",
            opacity: "0",
          },
          "10%": {
            transform: "translateX(-100px) translateY(-50%)",
            opacity: "1",
          },
          "90%": {
            transform: "translateX(-100px) translateY(-50%)",
            opacity: "1",
          },
          "100%": {
            transform: "translateX(100%) translateY(-50%)",
            opacity: "0",
          },
        },
        "scare-slide-right": {
          "0%": {
            transform: "translateX(-100%) translateY(-50%)",
            opacity: "0",
          },
          "10%": {
            transform: "translateX(100px) translateY(-50%)",
            opacity: "1",
          },
          "90%": {
            transform: "translateX(100px) translateY(-50%)",
            opacity: "1",
          },
          "100%": {
            transform: "translateX(-100%) translateY(-50%)",
            opacity: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "fade-out": "fade-out 0.3s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
        "slide-down": "slide-down 0.3s ease-out",
        "progress-indeterminate":
          "progress-indeterminate 1.5s infinite cubic-bezier(0.65, 0.815, 0.735, 0.395)",
        shimmer: "shimmer 2s infinite linear",
        // 🕸️ Halloween
        descend: "descend 8s ease-in-out infinite",
        swing: "swing 8s ease-in-out infinite",
        "spider-walk": "spider-walk 12s ease-in-out infinite",
        "bat-fly": "bat-fly 8s ease-in-out infinite",
        "ghost-float": "ghost-float 6s ease-in-out infinite",
        "web-appear": "web-appear 1s ease-out forwards",
        "wing-flap": "wing-flap 0.4s ease-in-out infinite",
        "web-stretch": "web-stretch 8s ease-in-out infinite",
        "scare-popup": "scare-popup 3s ease-out",
        "scare-slide-left": "scare-slide-left 3s ease-out",
        "scare-slide-right": "scare-slide-right 3s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
