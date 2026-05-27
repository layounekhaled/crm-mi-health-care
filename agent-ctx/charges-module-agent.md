# Task: Add Charges Module to CRM DALIA

## Summary
Successfully added a complete "Charges" (Expenses) module to the CRM application, including database schema, API routes, UI component, and navigation integration.

## Files Created
1. `/home/z/my-project/src/app/api/charges/route.ts` - GET (list + stats) and POST endpoints
2. `/home/z/my-project/src/app/api/charges/[id]/route.ts` - GET, PUT, DELETE endpoints
3. `/home/z/my-project/src/components/crm/charges.tsx` - Complete UI component with 3 tabs

## Files Modified
1. `/home/z/my-project/prisma/schema.prisma` - Added Charge model, updated Employee (chargesAsEmployee, chargesAsCreator) and Opportunity (charges) relations
2. `/home/z/my-project/src/lib/store.ts` - Added 'charges' to Page type
3. `/home/z/my-project/src/components/crm/sidebar.tsx` - Added Receipt icon import and Charges nav item (after Employees, admin-only)
4. `/home/z/my-project/src/app/page.tsx` - Added ChargesModule import and case in switch

## Key Implementation Details
- **Charge model**: type (hotel/restaurant/transport/divers), montant (Float), description, date, employeId (required), opportunityId (optional), createdBy
- **Named relations**: EmployeeCharges and ChargeCreator to avoid ambiguous relations on Employee
- **API stats mode**: GET /api/charges?stats=true returns aggregated stats by type, employee, and opportunity
- **UI**: 3 tabs (Vue Globale, Par Employé, Par Opportunité), summary cards, type-colored badges, filter bar, progress bars, profit potential calculation for opportunities
- **Auth**: Admin-only access enforced in all API routes
- **Database**: Schema pushed to both local SQLite (for dev) and Neon PostgreSQL (for production)

## Lint Status
All new code passes lint. Pre-existing lint errors in other files (emails/send, login, catalog) are unrelated.
