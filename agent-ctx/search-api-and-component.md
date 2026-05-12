# Task: Create Global Search API and Component for DALIA CRM

## Work Completed

### File 1: `/home/z/my-project/src/app/api/search/route.ts`
- **GET /api/search?q=xxx** endpoint
- Uses `getAuthUser` for authentication (returns 401 if not authenticated)
- Role-based filtering:
  - **Admin**: sees everything across all entity types
  - **Commercial**: sees own opportunities (commercialId filter), own + related tasks, all prospects, all events
  - **Technicien**: sees only prospects/opportunities/events linked to tasks assigned to them, only own assigned tasks, no employees
- Searches across 5 entity types with case-insensitive `contains`:
  - **Prospects**: `nom`, `telephone`, `whatsapp`, `etablissement`, `specialite`
  - **Opportunities**: `nomProjet`, client's `nom` (via relation), commercial's `nom` (via relation)
  - **Tasks**: `titre`, `description`
  - **Employees**: `nom`, `email` (admin only)
  - **Events**: `nom`, `ville`
- Limits each group to 5 results
- Only searches if query >= 2 characters
- All 5 searches run in parallel via `Promise.all`
- Returns results with `type` discriminator field

### File 2: `/home/z/my-project/src/components/crm/global-search.tsx`
- `'use client'` component using CommandDialog (cmdk)
- Opens with **Ctrl+K / Cmd+K** keyboard shortcut
- Debounced search (300ms) with AbortController for cancellation
- Results grouped by category with French labels:
  - Prospects, Opportunités, Tâches, Employés, Événements
- Each group has icon, label, and count badge
- Result items show contextual info (specialite/wilaya for prospects, montant/statut for opportunities, priorite for tasks, role for employees, date/ville for events)
- Clicking a result: navigates via `useCRMStore.setCurrentPage()` AND closes dialog
- Optional callbacks: `onSelectProspect`, `onSelectOpportunity`, `onSelectTask` for detail dialog integration
- Loading spinner (Loader2 animated) while searching
- Empty state: "Aucun résultat trouvé" via CommandEmpty
- Trigger button with Ctrl+K hint shown when dialog is closed
- Cleans up state on dialog close with small delay for animation

### Lint Status
- 0 errors, 2 pre-existing warnings (unrelated to new files)
