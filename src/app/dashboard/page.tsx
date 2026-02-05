import Dashboard from "@/components/pages/Dashboard";
import { DiagnosticReport } from "@/types";

export default function DashboardPage() {
    // Example minimal props for UI verification
    const mockReport: DiagnosticReport = {
        id: "rep_123",
        accountId: "acc_456",
        generatedAt: new Date().toISOString(),
        kpis: {
            roas: { label: "Account ROAS", value: "4.21", change: 12.4, trend: "up", suffix: "" },
            spend: { label: "Daily Spend", value: "$1,482", limit: "Limit: $2k", trend: "neutral" },
            cpa: { label: "Avg. CPA", value: "$24.05", change: 6.2, trend: "down", suffix: "" },
        },
        findings: [
            {
                id: "f_1",
                title: "CAPI Event Mismatch Detected",
                description: "System detected 14% discrepancy between Web SDK and Server events for Purchase event. Action required to prevent signal loss.",
                severity: "CRITICAL",
                status: "DISCREPANCY",
                actionLabel: "RUN DIAGNOSTIC",
                timestamp: new Date().toISOString()
            },
            {
                id: "f_2",
                title: "Pixel Signal Optimal",
                description: "Deduplication rate is at 99.8%. Advanced matching is correctly identifying 84% of your traffic.",
                severity: "HEALTHY",
                status: "OPTIMAL",
                actionLabel: "VIEW REPORT",
                timestamp: new Date().toISOString()
            }
        ],
        campaignPerformance: []
    };

    return <Dashboard report={mockReport} />;
}
