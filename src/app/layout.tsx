import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ClientProvider } from "@/contexts/ClientContext";
import { ReportProvider } from "@/contexts/ReportContext";

// Display font: page titles, section headers, metric values
const spaceGrotesk = Space_Grotesk({
    subsets: ["latin"],
    variable: "--font-space-grotesk",
    weight: ["400", "500", "600", "700"],
});

// Mono font: all UI text, labels, buttons, navigation, data
const jetbrainsMono = JetBrains_Mono({
    subsets: ["latin"],
    variable: "--font-jetbrains-mono",
    weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
    title: "Meta Ads Diagnostic Tool",
    description: "Access your Meta Ads diagnostic suite",
    icons: {
        icon: [
            { url: "/favicon.ico" },
            { url: "/favicon.png", type: "image/png" },
        ],
        shortcut: "/favicon.ico",
        apple: "/favicon.png",
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
            <body className={jetbrainsMono.className}>
                <AuthProvider>
                    <ClientProvider>
                        <ReportProvider>
                            {children}
                        </ReportProvider>
                    </ClientProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
