# Worklog - Task 3-4

## Task: Add "Recommandé par" field + Improve Prospect/Client detail display

**Date:** 2025-03-05
**Task ID:** 3-4
**Agent:** Z.ai Code

---

### Summary

Added `recommandePar` field to the Prospect model and completely redesigned the detail display (fiche) for both prospects and clients with gradient headers, contact info cards, quick actions, stats rows, and cleaned-up notes.

---

### Changes Made

#### Part 1: Database Schema
- **File:** `prisma/schema.prisma`
  - Added `recommandePar String?` field to the Prospect model
  - Ran `prisma db push` to sync with PostgreSQL (Neon)
  - Ran `prisma generate` to regenerate the Prisma client

#### Part 2: API Routes
- **File:** `src/app/api/prospects/route.ts`
  - Added `recommandePar` to destructured body in POST handler
  - Added `recommandePar: recommandePar || null` to `db.prospect.create` data

- **File:** `src/app/api/prospects/[id]/route.ts`
  - Added `recommandePar` to destructured body in PUT handler
  - Added `...(recommandePar !== undefined && { recommandePar })` to spread data in update

#### Part 3: Prospects Component
- **File:** `src/components/crm/prospects.tsx`
  - Added `UserCheck` and `FileText` to lucide-react imports
  - Added `recommandePar: string | null` to `Prospect` interface
  - Added `recommandePar: ''` to `formData` state initialization
  - Added `recommandePar: ''` to `openAddForm` reset
  - Added `recommandePar` to `openEditForm` (with type assertion for backward compatibility)
  - Added conditional "Recommandé par" input field that appears when `formData.source === 'recommandation'`
  - Source select now clears `recommandePar` when changing away from 'recommandation'
  - **Detail Dialog Redesign:**
    - Gradient header (`bg-gradient-to-r from-[#134885] to-[#1a5ca8]`) with white text
    - Name, specialite badge, status badge, source badge, and recommandePar badge in header
    - Stats row (3 colored boxes: Interactions, Opportunités, SAV)
    - Contact info cards with icons (PhoneCall, MessageCircle, Mail, MapPin, UserCheck, Building2)
    - Quick actions bar (Appeler, Appeler Tél 2, WhatsApp, Envoyer email, Ajouter interaction, Convertir en client)
    - Cleaned-up notes section (removes "Email:" lines already shown separately)
    - Footer with Modifier/Supprimer actions
    - Dialog width: `sm:max-w-[700px]`, padding adjusted with `p-0` for gradient header

#### Part 4: Clients Component
- **File:** `src/components/crm/clients.tsx`
  - Added `recommandePar: string | null` to `Client` interface
  - Added `recommandePar: ''` to `formData` state initialization
  - Added `recommandePar: ''` to `openAddForm` reset
  - Added `recommandePar` to `openEditForm` (with type assertion)
  - Added conditional "Recommandé par" input field (same pattern as prospects)
  - **DetailProfileTab Redesign:**
    - Health indicator + Client badge at top
    - Stats row (Opportunités, Interactions, SAV) with colored borders
    - Contact info cards with icons (same card style as prospects)
    - Recommandé par card shown when source is 'recommandation'
    - Source and "Client depuis" as info cards
    - Quick actions bar with color-coded buttons
    - Cleaned-up notes section
  - **Detail Dialog Header Redesign:**
    - Gradient header with client name, specialite, Client badge, Source badge, and recommandePar badge
    - Call and WhatsApp buttons styled as white-on-blue overlay buttons
    - Tabs wrapped in a `px-6 py-2` container for proper spacing
    - Dialog width: `sm:max-w-[750px]`, padding adjusted with `p-0`

---

### Files Modified
1. `prisma/schema.prisma` - Added recommandePar field
2. `src/app/api/prospects/route.ts` - Added recommandePar to POST
3. `src/app/api/prospects/[id]/route.ts` - Added recommandePar to PUT
4. `src/components/crm/prospects.tsx` - Form field + detail redesign
5. `src/components/crm/clients.tsx` - Form field + detail redesign

### Git
- **Commit:** `7e88aaf` - feat: add recommandePar field, improve prospect/client detail display
- **Pushed to:** `origin/main`

---

### Design Decisions
- Used `bg-gradient-to-r from-[#134885] to-[#1a5ca8]` for gradient header (MI HEALTH CARE brand blue)
- Contact info uses card layout with circular icon backgrounds for visual hierarchy
- Stats row placed before contact info for quick overview
- Notes cleaning removes "Email:" lines to avoid duplication with the email contact card
- `recommandePar` field is conditional - only shows when source is "recommandation"
- Type assertions used for backward compatibility with existing data that doesn't have recommandePar

---
Task ID: dalia-perms-dashboard-redirect
Agent: Super Z
Task: Fix bug where employees without dashboard.view permission were landing on the Dashboard page after authentication.

Work Log:
- Investigated the login flow: `src/app/login/page.tsx` redirects to `/` after `signIn()` success; the home page (`src/app/page.tsx`) reads `currentPage` from the Zustand store which defaults to `'dashboard'`.
- Found the root cause in `src/components/crm/sidebar.tsx`:
  the `useEffect` that handles permission redirects had `&& currentPage !== 'dashboard'` — meaning even if a user lacked the dashboard.view permission, the code would NOT redirect them away from the dashboard.
- Rewrote the `useEffect` in `sidebar.tsx` so that when the current page is not accessible (including `'dashboard'`), it now redirects to the FIRST accessible page in `navGroups` order. If the user has NO accessible pages, `currentPage` is left unchanged and the home page renders an "Accès refusé" fallback.
- Updated `src/app/page.tsx`:
  • Added a `useEffect` that mirrors the sidebar's redirect logic as a defense-in-depth safety net (in case `CRMSidebar` is not yet mounted).
  • Added a permission guard in `renderPage()`: if the user can't view the current page, either show an "Accès refusé" screen (no accessible modules at all) or a "Redirection..." spinner (waiting for the redirect effect to kick in).
- Updated `src/app/api/dashboard/route.ts` to reject the request with HTTP 403 when the authenticated user lacks `dashboard.view` permission (defense-in-depth on the backend).
- Verified with `npx tsc --noEmit` and `npx eslint` that the three modified files compile cleanly (no new errors introduced).

Stage Summary:
- Bug fixed: employees without `dashboard.view` permission are now redirected to the first module they CAN view (e.g. prospects, operations, tasks, after-sales…).
- Added an "Accès refusé" page for users with zero accessible modules.
- Server-side `/api/dashboard` now also returns 403 to unauthorized users, so even direct API calls cannot leak aggregated metrics.
- Files modified:
  • `src/components/crm/sidebar.tsx`
  • `src/app/page.tsx`
  • `src/app/api/dashboard/route.ts`
