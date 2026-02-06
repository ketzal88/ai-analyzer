export interface NavItem {
    title: string;
    subtitle?: string;
    href: string;
    icon?: string;
    adminOnly?: boolean;
}

export const navConfig: NavItem[] = [
    {
        title: "Panel de Control",
        subtitle: "Estado actual y comparación",
        href: "/dashboard",
        icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    },
    {
        title: "Hallazgos",
        subtitle: "Señales automáticas con evidencia",
        href: "/findings",
        icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    },
    {
        title: "Reporte IA",
        subtitle: "Decisiones y plan operativo",
        href: "/report",
        icon: "M13 10V3L4 14h7v7l9-11h-7z",
    },
    {
        title: "Creative Intel",
        subtitle: "Análisis y librería de activos",
        href: "/creative",
        icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z",
    },
    {
        title: "Prompts IA",
        subtitle: "Gestión de prompts Gemini",
        href: "/admin/prompts",
        icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
        adminOnly: true
    },
    {
        title: "Administración",
        subtitle: "Gestión de clientes y accesos",
        href: "/admin/clients",
        icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
        adminOnly: true,
    }
];
