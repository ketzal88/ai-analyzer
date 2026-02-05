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
                // Design tokens from Stitch
                special: "#0f1419",
                second: "#1a1f26",
                stellar: "#0a0d11",
                argent: "#2d3339",
                classic: "#135bec",
                white: "#ffffff",
                // Status colors
                synced: "#10b981",
                "sync-required": "#f59e0b",
                // Text colors
                "text-primary": "#ffffff",
                "text-secondary": "#9ca3af",
                "text-muted": "#6b7280",
            },
            fontFamily: {
                sans: ["Inter", "system-ui", "sans-serif"],
                mono: ["JetBrains Mono", "monospace"],
            },
            fontSize: {
                "hero": ["24px", { lineHeight: "32px", fontWeight: "700" }],
                "subheader": ["18px", { lineHeight: "28px", fontWeight: "600" }],
                "body": ["14px", { lineHeight: "20px", fontWeight: "400" }],
                "small": ["12px", { lineHeight: "16px", fontWeight: "400" }],
            },
            spacing: {
                "18": "4.5rem",
                "22": "5.5rem",
            },
            borderRadius: {
                "lg": "8px",
                "xl": "12px",
            },
        },
    },
    plugins: [],
};

export default config;
