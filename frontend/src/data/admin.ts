/* Admin-side collections that used to live only on the server. */

export type SettingRow = { id: string; section: string; values: Record<string, unknown>; savedAt: string };

/** Filled as panes are saved; empty means "everything is at its default". */
export const settings: SettingRow[] = [];

export type RolePermissionRow = {
  id: string;
  role: string;
  grants: Record<string, Record<string, boolean>>;
  updatedAt: string;
};

export const rolePermissions: RolePermissionRow[] = [];
