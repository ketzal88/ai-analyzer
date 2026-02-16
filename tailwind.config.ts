import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                // Design tokens — remapped to webapp-1-industrialtechnical palette
                stellar:           "#18181B",   // page background (charcoal)
                special:           "#0F0F10",   // sidebar / card background (near-black)
                second:            "#141415",   // subtle surface tint
                argent:            "#27272A",   // borders / dividers
                classic:           "#FACC15",   // PRIMARY ACCENT: vivid yellow
                white:             "#ffffff",
                // Status colors
                synced:            "#22C55E",   // success green
                "sync-required":   "#FACC15",   // warning = yellow accent
                // Text colors
                "text-primary":    "#FAFAFA",   // off-white
                "text-secondary":  "#71717A",   // gray-500
                "text-muted":      "#52525B",   // mid-gray
                // New tokens
                "text-on-accent":  "#0F0F10",   // dark text on yellow fills
            },
            fontFamily: {
                sans: ["Space Grotesk", "system-ui", "sans-serif"],
                mono: ["JetBrains Mono", "monospace"],
            },
            fontSize: {
                "display":   ["40px", { lineHeight: "44px", fontWeight: "700" }],
                "metric":    ["32px", { lineHeight: "36px", fontWeight: "700" }],
                "hero":      ["24px", { lineHeight: "32px", fontWeight: "700" }],
                "subheader": ["18px", { lineHeight: "28px", fontWeight: "600" }],
                "body":      ["14px", { lineHeight: "20px", fontWeight: "400" }],
                "small":     ["12px", { lineHeight: "16px", fontWeight: "400" }],
            },
            spacing: {
                "18": "4.5rem",
                "22": "5.5rem",
            },
            borderRadius: {
                // Zero radius everywhere — industrial / zero-decoration aesthetic
                "DEFAULT": "0px",
                "none":    "0px",
                "sm":      "0px",
                "md":      "0px",
                "lg":      "0px",
                "xl":      "0px",
                "2xl":     "0px",
                "3xl":     "0px",
                "full":    "0px",
            },
            letterSpacing: {
                "wide":    "0.5px",
                "wider":   "1px",
                "widest":  "2px",
            },
        },
    },
    plugins: [],
};

export default config;
