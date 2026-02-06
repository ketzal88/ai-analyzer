# 📄 AG-44: Creative Intelligence UI Documentation

## Overview
The Creative Intelligence UI provides a centralized hub for cross-account creative analysis. It leverages the intelligent scoring engine to highlight high-performers, underfunded opportunities, and creatives at risk of fatigue.

## Architecture

### Data Flow
1. **Request:** Client selects range (e.g., `last_14d`).
2. **Backend:** `/api/creative/active` calculates or retrieves KPI snapshot.
3. **Selection:** Scoring algorithm ranks candidates and dedupes using fingerprints.
4. **Response:** Structured JSON with metadata about selection process.
5. **Frontend:** Client-side filters (Search, Format, Reason) allow real-time exploration.

### Components

#### `CreativeFilters`
Handles all UI controls. It's a controlled component that passes state updates up to the main page.
- **Props:** `range`, `viewMode`, `search`, `format`, `reason` + handlers.

#### `CreativeGrid`
Container for the card layout.
- Handles responsive columns using Tailwind: `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`.
- Renders `CreativeCard` elements.
- Implements Skeleton UI for a smooth loading experience.

#### `CreativeCard`
The core atomic unit of the library.
- **KPI Grid:** Displays 6 key metrics in a high-density layout.
- **Score Overlay:** Normalized score (0-100) based on multiple performance vectors.
- **Cluster Intelligence:** If a creative has duplicates (same fingerprint), it shows the total count and total spend of the cluster.

## Filtering Logic
```typescript
const filteredCreatives = data.selected.filter(c => {
  const matchesSearch = !search || 
    c.adName.toLowerCase().includes(search.toLowerCase()) || 
    c.campaignName.toLowerCase().includes(search.toLowerCase());
    
  const matchesFormat = !format || c.format === format;
  const matchesReason = !reason || c.reasons.includes(reason as any);
  
  return matchesSearch && matchesFormat && matchesReason;
});
```

## Styling & Theme
Uses the project's **Stellar/Argent/Classic** color system:
- **Backgrounds:** `bg-special` (Glassmorphism effect).
- **Borders:** `border-argent`.
- **Primary Actions:** `bg-classic` (Vibrant blue).
- **KPI Labels:** `text-text-muted` (Small, uppercase, bold tracking).

## Development Notes
- The "View Table" mode is currently disabled in the UI but the page state already supports toggling.
- Placeholders for thumbnails are temporary; future versions could fetch actual media URLs from Meta's CDN (with direct signing if necessary).
- Pagination is currently limited to top 40-50 results to optimize performance and AI token usage in later steps.

---
**Last Updated:** 2026-02-06
