# Design System: webapp-1-industrialtechnical
**Source:** Pencil Style Guide · **Synced with:** `tailwind.config.ts` + `src/lib/design-tokens.ts`

---

## 1. Visual Theme & Atmosphere
Industrial-technical dark mode. Zero-decoration aesthetic — no border radius, sharp edges, high-contrast yellow accent on near-black surfaces. The feel is a **precision control panel**: dense, utilitarian, data-first. Decorative elements are eliminated in favor of structural clarity.

## 2. Color Palette & Roles

### Surfaces
| Token | Hex | Role |
|-------|-----|------|
| `stellar` | `#18181B` | Page background (charcoal) |
| `special` | `#0F0F10` | Sidebar / card background (near-black) |
| `second` | `#141415` | Subtle surface tint |
| `argent` | `#27272A` | Borders / dividers |

### Brand & Accent
| Token | Hex | Role |
|-------|-----|------|
| `classic` | `#FACC15` | **Primary accent** — vivid yellow. CTAs, active states, highlights |
| `white` | `#FFFFFF` | Pure white — headings, key data |

### Status
| Token | Hex | Role |
|-------|-----|------|
| `synced` | `#22C55E` | Success / positive indicators |
| `sync-required` | `#FACC15` | Warning — reuses yellow accent |

### Text
| Token | Hex | Role |
|-------|-----|------|
| `text-primary` | `#FAFAFA` | Off-white — main body text |
| `text-secondary` | `#71717A` | Gray-500 — secondary info, labels |
| `text-muted` | `#52525B` | Mid-gray — tertiary, disabled |
| `text-on-accent` | `#0F0F10` | Dark text on yellow fills |

### Dashboard Theme (Indigo)
| Token | Hex | Role |
|-------|-----|------|
| `dashboard-primary` | `#4F46E5` | Indigo-600 — dashboard accent |
| `dashboard-light` | `#EEF2FF` | Indigo-50 — light surfaces |
| `dashboard-dark` | `#3730A3` | Indigo-800 — deep emphasis |

## 3. Typography Rules

| Scale | Size | Line Height | Weight | Usage |
|-------|------|-------------|--------|-------|
| `display` | 40px | 44px | 700 | Page titles, hero numbers |
| `metric` | 32px | 36px | 700 | KPI values, large data |
| `hero` | 24px | 32px | 700 | Section headers |
| `subheader` | 18px | 28px | 600 | Card titles, sub-sections |
| `body` | 14px | 20px | 400 | Default body text |
| `small` | 12px | 16px | 400 | Labels, captions, metadata |

- **Primary font:** Space Grotesk (geometric sans-serif — technical feel)
- **Monospace:** JetBrains Mono (data tables, code, IDs, metrics)
- **Letter spacing:** `wide` 0.5px · `wider` 1px · `widest` 2px (used on uppercase labels)

## 4. Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Tight gaps, inline spacing |
| `sm` | 8px | Component internal padding |
| `md` | 12px | Default gap |
| `lg` | 16px | Card padding, section gaps |
| `xl` | 24px | Major section separation |
| `2xl` | 32px | Page-level spacing |
| `3xl` | 48px | Hero sections, major breaks |

## 5. Border Radius
**Zero. Everywhere.**

All border radius tokens are set to `0px`. This is the defining visual characteristic of the industrial aesthetic — sharp corners, no rounding, no softening. Cards, buttons, inputs, modals, badges — all rectangular.

## 6. Component Stylings

- **Buttons:** Sharp rectangle. Primary = `classic` yellow bg + `text-on-accent` dark text. Secondary = transparent with `argent` border. No rounded corners.
- **Cards/Containers:** `special` background, 1px `argent` border, 0px radius. Depth via background color shifts, not shadows.
- **Inputs/Forms:** 1px `argent` border on `special` background. Focus state = `classic` yellow border.
- **Tables:** `argent` row dividers, `special` alternating rows. Monospace for numeric data.
- **Badges/Tags:** Sharp rectangle, `classic` yellow for active/important, `argent` border for neutral.

## 7. Layout Principles

- **Density:** High. Tight spacing, data-dense layouts. Minimal decorative whitespace.
- **Alignment:** Grid-based, left-aligned text. Sidebar navigation pattern.
- **Whitespace:** Functional only — separates logical groups, never decorative.
- **Transitions:** `fast` 150ms · `normal` 200ms · `slow` 300ms — all ease-in-out.

## 8. Key Differences from Previous (Google Stitch)

| Aspect | Old (Stitch) | Current (Industrial) |
|--------|-------------|---------------------|
| Accent | Electric Blue `#135BEC` | Vivid Yellow `#FACC15` |
| Font | Inter | Space Grotesk |
| Border Radius | 4-12px rounded | 0px everywhere |
| Feel | Clean/corporate | Industrial/utilitarian |
| Backgrounds | Deeper blacks | Zinc/charcoal tones |
