---
Task ID: 1
Agent: Main Agent
Task: Fix operation status inconsistencies + create Users with hashed passwords in seed

Work Log:
- Changed operations.tsx STATUTS constant from `terminé` to `termine` (without accent) to match seed data and other modules
- Changed STATUT_COLORS key from `terminé` to `termine`
- Changed filter comparison from `o.statut === 'terminé'` to `o.statut === 'termine'`
- Added bcrypt import and User creation to prisma/seed.ts with hashed passwords
- Fixed notifications detect route to use `notIn: ['terminee', 'terminé', 'termine']` for robust matching
- Upserted users in production database with correct passwords and employee links

Stage Summary:
- Status values now consistent: Operations=`termine`, Tasks=`terminee`, After-sales=`termine`
- All 5 users created in DB: khaled/admin123 (admin), amine/com123 (commercial), sara/com123 (commercial), youcef/tech123 (technicien), nadia/tech123 (technicien)

---
Task ID: 2
Agent: Main Agent + Subagent
Task: Implement Role-Based Access Control (RBAC)

Work Log:
- Created `/src/lib/auth-helpers.ts` with getAuthUser(), canAccess(), isAdmin(), isCommercial(), isTechnicien()
- Updated sidebar.tsx with roles field on navItems and filtering by user role
- Added auto-redirect to dashboard if current page is not accessible to user's role
- Updated ALL API routes with auth checks and role-based data filtering:
  - Prospects: admin + commercial only
  - Opportunities: admin sees all, commercial sees own, technicien gets 403
  - Operations: admin sees all, commercial sees from their opportunities, technicien sees own
  - Tasks: admin all, commercial own + related, technicien own only (can only update statut)
  - After-sales: admin all, commercial for their clients, technicien own (can only update statut)
  - Employees: admin only
  - Events: admin + commercial
  - Dashboard: all authenticated, filtered by role
  - Notifications: JWT-based auth with header fallback
  - Interactions: admin + commercial
  - Objectives: admin only

Stage Summary:
- Full RBAC implemented across all API routes
- Navigation filtered by role in sidebar
- Technicien restricted to own tasks and after-sales (statut updates only)

---
Task ID: 3
Agent: Main Agent + Subagent
Task: Add quick status change + transition guards for operations

Work Log:
- Added VALID_TRANSITIONS constant: en_attente → en_cours → termine (forward only)
- Created QuickStatusButtons component for inline status changes
- Added handleQuickStatusChange function with toast feedback
- Desktop table and mobile cards now show quick status buttons next to StatutBadge
- Added currentStatut state tracking for edit dialog
- Edit form Select now disables invalid status transitions with "(non autorisé)" label
- Server-side validation added in PUT /api/operations/[id] returning 400 for invalid transitions

Stage Summary:
- Operations can advance status with one click (no need to open edit dialog)
- Forward-only transitions enforced at both UI and API level
- terminé operations cannot go backward

---
Task ID: 4
Agent: Main Agent + Subagent
Task: Add auto-complete opportunity when all operations are terminated

Work Log:
- Modified PUT /api/operations/[id] to check if all sibling operations are `termine`
- Returns `allOperationsComplete: true` in response when all operations complete
- Added `opportunityCompleteDialog` state in operations.tsx
- Both handleQuickStatusChange and handleSubmit check for completion
- AlertDialog prompts user to move opportunity to "Gagné" status
- "Oui, passer en Gagné" button calls PUT /api/opportunities/{id} with statut='Gagné'

Stage Summary:
- When last operation is marked `termine`, a dialog appears asking to mark the opportunity as "Gagné"
- User can accept or dismiss ("Plus tard")

---
Task ID: 5
Agent: Main Agent
Task: Fix TypeScript types and build verification

Work Log:
- Fixed store.ts CurrentUser interface: `nom` → `employeNom` for consistency
- Added NextAuth type declarations in auth.ts (User, Session, JWT interfaces)
- Removed unsafe type casts in auth.ts callbacks
- Refactored auth-context.tsx with mapSessionUser helper function
- Build passes successfully with no errors

Stage Summary:
- Clean TypeScript with proper NextAuth type augmentation
- Build compiles successfully
