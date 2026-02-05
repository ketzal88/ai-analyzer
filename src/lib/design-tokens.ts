/**
 * Design Tokens - Centralized design system values from Stitch
 * DO NOT modify these values without updating the Stitch design first
 */

export const colors = {
    // Background colors
    special: "#0f1419",
    second: "#1a1f26",
    stellar: "#0a0d11",
    argent: "#2d3339",

    // Brand colors
    classic: "#135bec",
    white: "#ffffff",

    // Status colors
    synced: "#10b981",
    syncRequired: "#f59e0b",

    // Text colors
    textPrimary: "#ffffff",
    textSecondary: "#9ca3af",
    textMuted: "#6b7280",
} as const;

export const typography = {
    fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
    },
    fontSize: {
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
    sm: "4px",
    md: "6px",
    lg: "8px",
    xl: "12px",
    full: "9999px",
} as const;

export const transitions = {
    fast: "150ms ease-in-out",
    normal: "200ms ease-in-out",
    slow: "300ms ease-in-out",
} as const;
