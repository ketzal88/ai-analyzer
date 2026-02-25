/**
 * Design Tokens — webapp-1-industrialtechnical (Pencil)
 * Synced with tailwind.config.ts — this is the JS reference for runtime usage.
 * DO NOT modify without updating tailwind.config.ts in parallel.
 */

export const colors = {
    // Background colors
    stellar: "#18181B",       // page background (charcoal)
    special: "#0F0F10",       // sidebar / card background (near-black)
    second: "#141415",        // subtle surface tint
    argent: "#27272A",        // borders / dividers

    // Brand colors
    classic: "#FACC15",       // PRIMARY ACCENT: vivid yellow
    white: "#ffffff",

    // Status colors
    synced: "#22C55E",        // success green
    syncRequired: "#FACC15",  // warning = yellow accent

    // Text colors
    textPrimary: "#FAFAFA",   // off-white
    textSecondary: "#71717A", // gray-500
    textMuted: "#52525B",     // mid-gray
    textOnAccent: "#0F0F10",  // dark text on yellow fills

    // Dashboard theme (indigo-based)
    dashboard: {
        primary: "#4F46E5",   // indigo-600
        light: "#EEF2FF",     // indigo-50
        dark: "#3730A3",      // indigo-800
    },
} as const;

export const typography = {
    fontFamily: {
        sans: ["Space Grotesk", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
    },
    fontSize: {
        display: {
            size: "40px",
            lineHeight: "44px",
            fontWeight: "700",
        },
        metric: {
            size: "32px",
            lineHeight: "36px",
            fontWeight: "700",
        },
        hero: {
            size: "24px",
            lineHeight: "32px",
            fontWeight: "700",
        },
        subheader: {
            size: "18px",
            lineHeight: "28px",
            fontWeight: "600",
        },
        body: {
            size: "14px",
            lineHeight: "20px",
            fontWeight: "400",
        },
        small: {
            size: "12px",
            lineHeight: "16px",
            fontWeight: "400",
        },
    },
} as const;

export const spacing = {
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    "2xl": "32px",
    "3xl": "48px",
} as const;

export const borderRadius = {
    // Zero radius everywhere — industrial / zero-decoration aesthetic
    DEFAULT: "0px",
    sm: "0px",
    md: "0px",
    lg: "0px",
    xl: "0px",
    full: "0px",
} as const;

export const letterSpacing = {
    wide: "0.5px",
    wider: "1px",
    widest: "2px",
} as const;

export const transitions = {
    fast: "150ms ease-in-out",
    normal: "200ms ease-in-out",
    slow: "300ms ease-in-out",
} as const;
