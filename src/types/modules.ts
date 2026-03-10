/**
 * Module API response item (raw shape from GET /api/modules).
 */
export interface ModuleApiItem {
  _id: string;
  key: string;
  label: string;
  path: string;
  order: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  __v: number;
  icon?: string;
}

/**
 * Payload for creating a module (POST /api/modules).
 */
export interface ModuleCreatePayload {
  key: string;
  label: string;
  path: string;
  order?: number;
  active?: boolean;
  icon?: string;
}

/**
 * Payload for updating a module (PUT /api/modules/:id).
 */
export interface ModuleUpdatePayload {
  key?: string;
  label?: string;
  path?: string;
  order?: number;
  active?: boolean;
  icon?: string;
}

/**
 * Normalized module record for UI (id + label/name, path as description).
 */
export interface ModuleRecord {
  id: string;
  key: string;
  name: string;
  description?: string;
  order?: number;
  active?: boolean;
  icon?: string;
}
