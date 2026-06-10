// Fonte única de verdade das permissões de cargo.
// Usada tanto no servidor (rotas /api) quanto no cliente (telas).

// Todas as chaves de permissão existentes no sistema.
export const PERMISSION_KEYS = [
  "dashboard_view",
  "pipeline_view",
  "quotes_view_all",
  "quotes_create",
  "quotes_edit",
  "quotes_delete",
  "quotes_restore",
  "clients_manage",
  "catalog_manage",
  "logistics_view",
  "loss_reasons",
  "agent_use",
  "logs_view",
  "reviews_view",
  "users_manage",
  "settings_manage",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

// Nome do cargo de super-admin (acesso total, imutável).
export const ADMIN_ROLE = "admin";

// Um cargo é "admin" (acesso total, não editável) quando:
//  - se chama "admin" (ignorando maiúsculas/minúsculas), ou
//  - tem a flag is_admin marcada nas permissões.
export function isAdminRole(
  role?: string | null,
  permissions?: Record<string, unknown> | null,
): boolean {
  if (role && role.trim().toLowerCase() === ADMIN_ROLE) return true;
  return permissions?.is_admin === true;
}

// Objeto com TODAS as permissões ligadas (+ flag is_admin).
export function fullPermissions(): Record<string, boolean> {
  const all = Object.fromEntries(PERMISSION_KEYS.map((k) => [k, true]));
  return { ...all, is_admin: true };
}

// Permissões EFETIVAS de um cargo: o admin sempre recebe acesso total,
// independentemente do que estiver salvo no banco (à prova de drift).
export function effectivePermissions(
  role?: string | null,
  stored?: Record<string, boolean> | null,
): Record<string, boolean> {
  if (isAdminRole(role, stored)) return fullPermissions();
  return stored ?? {};
}
