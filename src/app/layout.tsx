import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ClientProvider } from "@/contexts/ClientContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Meta Ads Diagnostic Tool",
    description: "Access your Meta Ads diagnostic suite",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <AuthProvider>
                    <ClientProvider>
                        {children}
                    </ClientProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
