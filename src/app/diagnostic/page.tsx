"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DiagnosticRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace("/decision-board");
    }, [router]);
    return null;
}
