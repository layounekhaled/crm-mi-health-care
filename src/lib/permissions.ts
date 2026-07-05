// ─── DALIA CRM — Granular Permissions System ──────────────────────
// Each module has actions: view, create, edit, delete
// Admin always has full access regardless of permissions object
// If permissions is null/undefined, role defaults are used

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete'

export interface ModulePermissions {
  view: boolean
  create: boolean
  edit: boolean
  delete: boolean
}

export interface Permissions {
  prospects: ModulePermissions
  clients: ModulePermissions
  events: ModulePermissions
  opportunities: ModulePermissions
  operations: ModulePermissions
  tasks: ModulePermissions
  afterSales: ModulePermissions
  charges: ModulePermissions
  caisse: ModulePermissions
  employees: ModulePermissions
  documents: ModulePermissions
  calendar: ModulePermissions
  rh: ModulePermissions
  emails: ModulePermissions
  catalog: ModulePermissions
  dashboard: ModulePermissions
}

export type PermissionModule = keyof Permissions

// ─── Permission Labels (for UI) ────────────────────────────────

export const MODULE_LABELS: Record<PermissionModule, { label: string; icon: string }> = {
  dashboard: { label: 'Dashboard', icon: 'LayoutDashboard' },
  prospects: { label: 'Prospects', icon: 'UserRound' },
  clients: { label: 'Clients', icon: 'UserCheck' },
  events: { label: 'Événements', icon: 'Calendar' },
  opportunities: { label: 'Opportunités', icon: 'Briefcase' },
  operations: { label: 'Opérations', icon: 'Package' },
  tasks: { label: 'Tâches', icon: 'CheckSquare' },
  afterSales: { label: 'Après-vente', icon: 'Wrench' },
  charges: { label: 'Charges', icon: 'Receipt' },
  caisse: { label: 'Caisse', icon: 'Wallet' },
  employees: { label: 'Employés', icon: 'Users' },
  documents: { label: 'Documents', icon: 'FileText' },
  calendar: { label: 'Calendrier', icon: 'CalendarClock' },
  rh: { label: 'RH', icon: 'CalendarDays' },
  emails: { label: 'Emails', icon: 'Mail' },
  catalog: { label: 'Catalogue', icon: 'BookOpen' },
}

export const ACTION_LABELS: Record<PermissionAction, string> = {
  view: 'Voir',
  create: 'Créer',
  edit: 'Modifier',
  delete: 'Supprimer',
}

// ─── Role Defaults ─────────────────────────────────────────────

const FULL_ACCESS: ModulePermissions = { view: true, create: true, edit: true, delete: true }
const READ_ONLY: ModulePermissions = { view: true, create: false, edit: false, delete: false }
const NO_ACCESS: ModulePermissions = { view: false, create: false, edit: false, delete: false }

export const ROLE_DEFAULTS: Record<string, Permissions> = {
  admin: {
    dashboard: FULL_ACCESS,
    prospects: FULL_ACCESS,
    clients: FULL_ACCESS,
    events: FULL_ACCESS,
    opportunities: FULL_ACCESS,
    operations: FULL_ACCESS,
    tasks: FULL_ACCESS,
    afterSales: FULL_ACCESS,
    charges: FULL_ACCESS,
    caisse: FULL_ACCESS,
    employees: FULL_ACCESS,
    documents: FULL_ACCESS,
    calendar: FULL_ACCESS,
    rh: FULL_ACCESS,
    emails: FULL_ACCESS,
    catalog: FULL_ACCESS,
  },
  commercial: {
    dashboard: FULL_ACCESS,
    prospects: FULL_ACCESS,
    clients: FULL_ACCESS,
    events: FULL_ACCESS,
    opportunities: FULL_ACCESS,
    operations: FULL_ACCESS,
    tasks: FULL_ACCESS,
    afterSales: FULL_ACCESS,
    charges: { view: true, create: true, edit: true, delete: false },
    caisse: { view: true, create: true, edit: false, delete: false },
    employees: NO_ACCESS,
    documents: { view: true, create: true, edit: true, delete: false },
    calendar: FULL_ACCESS,
    rh: { view: true, create: false, edit: false, delete: false },
    emails: FULL_ACCESS,
    catalog: FULL_ACCESS,
  },
  technicien: {
    dashboard: FULL_ACCESS,
    prospects: NO_ACCESS,
    clients: NO_ACCESS,
    events: NO_ACCESS,
    opportunities: NO_ACCESS,
    operations: FULL_ACCESS,
    tasks: FULL_ACCESS,
    afterSales: FULL_ACCESS,
    charges: { view: true, create: true, edit: false, delete: false },
    caisse: { view: true, create: true, edit: false, delete: false },
    employees: NO_ACCESS,
    documents: { view: true, create: true, edit: true, delete: false },
    calendar: FULL_ACCESS,
    rh: { view: true, create: false, edit: false, delete: false },
    emails: FULL_ACCESS,
    catalog: FULL_ACCESS,
  },
}

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Get the effective permissions for a user.
 * - Admin always gets full access
 * - If permissions object is set, use it
 * - Otherwise, fall back to role defaults
 */
export function getEffectivePermissions(role: string, permissions: Record<string, unknown> | null | undefined): Permissions {
  // Admin always has full access
  if (role === 'admin') {
    return ROLE_DEFAULTS.admin
  }

  // If custom permissions are set, use them
  if (permissions && typeof permissions === 'object' && Object.keys(permissions).length > 0) {
    const defaults = ROLE_DEFAULTS[role] || ROLE_DEFAULTS.commercial
    const result = { ...defaults } as Permissions

    for (const [module, actions] of Object.entries(permissions)) {
      if (module in result && typeof actions === 'object' && actions !== null) {
        result[module as PermissionModule] = {
          ...result[module as PermissionModule],
          ...(actions as Partial<ModulePermissions>),
        }
      }
    }

    return result
  }

  // Fall back to role defaults
  return ROLE_DEFAULTS[role] || ROLE_DEFAULTS.commercial
}

/**
 * Check if a user has a specific permission
 */
export function hasPermission(
  role: string,
  permissions: Record<string, unknown> | null | undefined,
  module: PermissionModule,
  action: PermissionAction
): boolean {
  const effective = getEffectivePermissions(role, permissions)
  return effective[module]?.[action] ?? false
}

/**
 * Check if a user can view a module (used for sidebar visibility)
 */
export function canViewModule(
  role: string,
  permissions: Record<string, unknown> | null | undefined,
  module: PermissionModule
): boolean {
  return hasPermission(role, permissions, module, 'view')
}

/**
 * Create an empty permissions object from role defaults
 * (used to initialize the form)
 */
export function createPermissionsFromRole(role: string): Permissions {
  return JSON.parse(JSON.stringify(ROLE_DEFAULTS[role] || ROLE_DEFAULTS.commercial))
}

/**
 * Get list of modules a user can view (for sidebar filtering)
 */
export function getVisibleModules(role: string, permissions: Record<string, unknown> | null | undefined): PermissionModule[] {
  const effective = getEffectivePermissions(role, permissions)
  return (Object.keys(effective) as PermissionModule[]).filter(
    (module) => effective[module].view
  )
}
