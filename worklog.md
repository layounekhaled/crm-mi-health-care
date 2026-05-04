---
Task ID: 1
Agent: Main Agent
Task: Fix "erreur de chargement des prospects" - investigate and fix prospects loading error

Work Log:
- Investigated the CRM project structure at /home/z/my-project/
- Discovered the root cause: DATABASE_URL was set to SQLite (`file:/tmp/crm-mi-healthcare.db`) which is ephemeral on Vercel
- Found that Vercel already had a Neon PostgreSQL database configured (POSTGRES_PRISMA_URL env var)
- Switched Prisma from SQLite to PostgreSQL (Neon)
- Removed the SQLite auto-initialization hack (ensureDbInitialized) from db.ts and all 17 API route files
- Fixed typo: "propection" → "prospection" in schema.prisma and API route
- Fixed duplicate "Tlemcen" in WILAYAS array (prospects.tsx)
- Added cascade delete logic for prospects (delete related records before deleting prospect)
- Pushed Prisma schema to Neon PostgreSQL database
- Seeded the Neon database with demo data (10 prospects, 5 employees, 10 opportunities, etc.)
- Updated Vercel environment variables: DATABASE_URL and DIRECT_URL for all environments
- Deployed to Vercel production
- Verified API endpoints work correctly on production

Stage Summary:
- Root cause: SQLite database at /tmp/ was ephemeral on Vercel, causing data loss on cold starts
- Solution: Switched to persistent Neon PostgreSQL database
- All 23 files modified, tested, and deployed successfully
- Production URL: https://my-project-gilt-six-41.vercel.app
- API verified: /api/prospects returns all 10 prospects correctly

---
Task ID: 2
Agent: Main Agent
Task: Add Authentication and Notifications system to CRM

Work Log:
- Added User and Notification models to Prisma schema
- Added User relation to Employee model
- Pushed schema to Neon PostgreSQL (2 new tables created)
- Created 5 demo users with bcrypt hashed passwords
- Configured NextAuth.js with CredentialsProvider (JWT strategy, 24h sessions)
- Created login page with MI HEALTH CARE branding (emerald/teal gradient)
- Created auth middleware that protects all routes except /login and /api/auth/*
- Created AuthProvider and useAuth hook for client-side auth state
- Updated layout.tsx to wrap with AuthProvider
- Updated page.tsx with auth loading state
- Created notifications API routes: GET, POST, PATCH, DELETE, mark-all-read
- Created auto-detection service (POST /api/notifications/detect)
  - Detects overdue tasks, tasks due soon, stagnant opportunities, quotes without follow-up
- Created NotificationsBell component with popover, badge, type-specific icons
- Updated sidebar with notifications bell, user avatar, role badge, logout button
- Updated Zustand store with currentUser state
- Seeded 6 demo notifications
- Added NEXTAUTH_SECRET and NEXTAUTH_URL to Vercel environment variables
- Deployed to Vercel production
- Verified: 307 redirect for unauthenticated, 200 for login page, CSRF token works

Stage Summary:
- Authentication system fully functional with NextAuth.js
- Notifications system with auto-detection and bell icon
- Production URL: https://my-project-gilt-six-41.vercel.app
- Login credentials: khaled@mihealthcare.dz / admin123
