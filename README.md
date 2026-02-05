# Meta Ads Diagnostic Tool

A Next.js application for Meta Ads diagnostics with UI implemented from Google Stitch designs.

## 🎨 Design Implementation

This project implements the UI **exactly as designed in Google Stitch** with strict adherence to:
- ✅ Layout and structure
- ✅ Copy and hierarchy
- ✅ Spacing and typography
- ✅ Colors and design tokens
- ✅ Component patterns

**No modifications** have been made to the original Stitch design.

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: Firebase Auth
- **Design Source**: Google Stitch

## 📁 Project Structure

```
ad-analyzer/
├── src/
│   ├── app/                      # Next.js App Router pages
│   │   ├── layout.tsx           # Root layout
│   │   ├── page.tsx             # Login page (/)
│   │   ├── select-account/      # Account selector page
│   │   └── globals.css          # Global styles
│   ├── components/
│   │   ├── layouts/
│   │   │   ├── AuthLayout.tsx   # Layout for auth pages
│   │   │   └── AppLayout.tsx    # Layout for app pages
│   │   └── pages/
│   │       ├── LoginPage.tsx    # Login screen component
│   │       └── AccountSelector.tsx # Account selector component
│   ├── lib/
│   │   └── design-tokens.ts     # Centralized design tokens
│   └── types/
│       └── index.ts             # TypeScript type definitions
├── tailwind.config.ts           # Tailwind configuration
├── tsconfig.json                # TypeScript configuration
└── package.json                 # Dependencies
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm installed
- Firebase project (for authentication)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file for Firebase configuration:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📄 Pages

- **`/`** - Login page with Google sign-in and email authentication
- **`/select-account`** - Account selector with search, filters, and table

## 🎨 Design Tokens

All design tokens are centralized in `src/lib/design-tokens.ts`:

### Colors
- **Backgrounds**: `special`, `second`, `stellar`, `argent`
- **Brand**: `classic` (#135bec), `white`
- **Status**: `synced` (green), `syncRequired` (orange)
- **Text**: `textPrimary`, `textSecondary`, `textMuted`

### Typography
- **Hero Heading**: 24px Bold
- **Subheader**: 18px Semi-bold
- **Body**: 14px Regular
- **Small**: 12px Regular
- **Fonts**: Inter (sans), JetBrains Mono (mono)

### Spacing & Borders
- Consistent spacing scale from 4px to 48px
- Border radius: 8px (lg), 12px (xl)

## 🔥 Firebase Integration

The components are ready for Firebase Auth integration. Key areas to implement:

1. **`src/lib/firebase.ts`** - Initialize Firebase
2. **`src/contexts/AuthContext.tsx`** - Auth context provider
3. **Update components** - Connect Firebase methods to existing handlers

## 🚧 Guardrails

- ✅ No hardcoded data (uses minimal mock data)
- ✅ No extensive mock datasets
- ✅ Firebase Auth compatible structure
- ✅ TypeScript for type safety
- ✅ Responsive design
- ✅ Accessible components

## 📝 Notes

- Design matches Stitch screens pixel-perfect
- All copy is preserved from original design
- Component hierarchy follows Stitch structure
- Ready for Firebase Auth integration
- No build errors or TypeScript issues

## 🔗 Stitch Project

- **Project ID**: 5165520689568295033
- **Screens**: Login Screen, Account Selection Screen, Core Design System Utility
- **Theme**: Dark mode, Inter font, 8px roundness, #135bec accent

## 📦 Build

To create a production build:

```bash
npm run build
npm start
```

## 🧪 Development

The project uses:
- ESLint for code quality
- TypeScript for type checking
- Tailwind CSS for styling
- Next.js App Router for routing

---

**Built with strict adherence to Google Stitch designs** 🎨
