# Quick Start Guide

## Prerequisites Check

Before running the project, ensure you have:

- [ ] Node.js 18 or higher installed
- [ ] npm or yarn package manager
- [ ] Firebase project created (optional for initial testing)

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

This will install:
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Firebase SDK

### 2. Environment Setup (Optional for initial run)

Copy the environment template:

```bash
copy .env.example .env.local
```

Then edit `.env.local` with your Firebase credentials.

**Note**: The app will run without Firebase configured, but authentication won't work.

### 3. Start Development Server

```bash
npm run dev
```

The app will be available at: **http://localhost:3000**

## Available Routes

- **`/`** - Login page
- **`/select-account`** - Account selector page

## Testing the UI

### Login Page (`/`)
You should see:
- Dark theme background
- Centered login card
- "Sign In" heading
- Google sign-in button
- Email input field
- Blue "Continue with Email" button

### Account Selector (`/select-account`)
You should see:
- Top navigation with DiagnosticPro logo
- "Select an Ad Account" heading
- Search bar and filters
- Table with 6 sample accounts
- Status badges (green/orange)
- Pagination controls

## Build for Production

```bash
npm run build
npm start
```

## Troubleshooting

### "npm: command not found"
- Install Node.js from https://nodejs.org/

### Port 3000 already in use
```bash
npm run dev -- -p 3001
```

### TypeScript errors
```bash
npm run build
```
This will show any type errors that need fixing.

## Project Structure Quick Reference

```
src/
├── app/                    # Routes (Next.js App Router)
├── components/
│   ├── layouts/           # AuthLayout, AppLayout
│   └── pages/             # LoginPage, AccountSelector
├── lib/                   # Utilities (firebase, design-tokens)
└── types/                 # TypeScript definitions
```

## Design Tokens Reference

### Colors
```typescript
classic: "#135bec"    // Primary blue
stellar: "#0a0d11"    // Background
second: "#1a1f26"     // Cards
synced: "#10b981"     // Success green
```

### Typography
```typescript
Hero: 24px Bold
Subheader: 18px Semi-bold
Body: 14px Regular
Small: 12px Regular
```

## Next Steps

1. ✅ Run `npm install`
2. ✅ Run `npm run dev`
3. ✅ Open http://localhost:3000
4. ⏭️ Configure Firebase for authentication
5. ⏭️ Connect to real data sources
6. ⏭️ Deploy to production

---

**Need help?** Check the README.md for detailed documentation.
