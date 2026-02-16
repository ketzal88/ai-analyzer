export interface NavItem {
    title: string;
    subtitle?: string;
    href: string;
    icon?: string;
    adminOnly?: boolean;
    section?: 'operativo' | 'inteligencia' | 'admin';
    number: string;
}

export const navConfig: NavItem[] = [
    // ── OPERATIVO ────────────────────────────
    {
        title: "Command Center",
        subtitle: "Vista diaria: KPIs y alertas",
        href: "/dashboard",
        number: "01",
        icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
        section: 'operativo',
    },
    {
        title: "Ads Manager",
        subtitle: "Gestión operativa por niveles",
        href: "/ads-manager",
        number: "02",
        icon: "M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
        section: 'operativo',
    },
    {
        title: "Decision Board",
        subtitle: "Matriz de decisiones GEM",
        href: "/decision-board",
        number: "03",
        icon: "M9 17v-2a4 4 0 00-4-4H3m18 0h-2a4 4 0 00-4 4v2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z",
        section: 'operativo',
    },
    // ── INTELIGENCIA ─────────────────────────
    {
        title: "Creative Intel",
        subtitle: "Análisis y librería de activos",
        href: "/creative",
        number: "04",
        icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z",
        section: 'inteligencia',
    },
    {
        title: "Conceptos",
        subtitle: "Librería de conceptos y briefs",
        href: "/concepts",
        number: "05",
        icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.675.337a4 4 0 00-1.547 5.47l.337.675a6 6 0 005.47 1.547l.675-.337a4 4 0 001.547-5.47l-.337-.675z",
        section: 'inteligencia',
    },
    {
        title: "AI Handbook",
        subtitle: "Guía de alertas y lógica",
        href: "/academy/alerts",
        number: "06",
        icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
        section: 'inteligencia',
    },
    // ── ADMIN ────────────────────────────────
    {
        title: "Prompts IA",
        subtitle: "Gestión de prompts Gemini",
        href: "/admin/prompts",
        number: "07",
        icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
        adminOnly: true,
        section: 'admin',
    },
    {
        title: "Administración",
        subtitle: "Gestión de clientes y accesos",
        href: "/admin/clients",
        number: "08",
        icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
        adminOnly: true,
        section: 'admin',
    }
];
