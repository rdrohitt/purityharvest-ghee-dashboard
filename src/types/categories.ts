/**
 * Category API response item (raw shape from GET /api/categories).
 */
export interface CategoryApiItem {
  _id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Payload for creating a category (POST /api/categories).
 */
export interface CategoryCreatePayload {
  name: string;
}

/**
 * Payload for updating a category (PUT /api/categories/:id).
 */
export interface CategoryUpdatePayload {
  name: string;
}

/**
 * Normalized category for UI (id + name).
 */
export interface CategoryRecord {
  id: string;
  name: string;
}
