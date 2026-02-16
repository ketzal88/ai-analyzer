# Meta Ads Diagnostic Tool

A high-performance Next.js application for Meta Ads diagnostics, featuring intelligent creative scoring, AI reports, and automated sync.

## 📖 Documentation & Guides

- 🧠 **[Master Reference (Tech)](docs/MASTER_REFERENCE.md)**: Deep dive into architecture and services.
- 🎯 **[Strategy Guide (Paid Media)](docs/DOCS_STRATEGY.md)**: How to use the tool for creative optimization.
- 📘 **In-app Academy**: Explica la lógica de alertas visualmente (`/academy/alerts`).

---

## 🛠️ Key Scripts & Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server on port 3000 |
| `npm run build` | Verify types and build for production |
| `firebase deploy --only firestore` | Deploy security rules and indexes |
| `node scripts/simulate-monday-remaining.ts` | Dry-run of all cron jobs locally |

---

## 🏗️ Core Architecture (Mission Checklist)

- [x] **Meta sync engine**: Fingerprint-based creative library.
- [x] **KPI Scoring**: Weighted logic for budget distribution.
- [x] **Alert Engine**: Real-time signal analysis.
- [x] **Per-Client Tuning**: Configurable thresholds for different business models.
- [x] **Stitch UI**: High-fidelity dark mode dashboard.

*Built with strict adherence to Google Stitch designs and Next.js 15+ best practices.*
