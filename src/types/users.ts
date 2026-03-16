/**
 * User record for the Users & Roles list (normalized from API).
 */
export interface UserRecord {
  id: string;
  name: string;
  mobile: string;
  username: string;
  password: string;
  role: string;
  permissions: string[];
}

/**
 * Payload for creating a user (POST /api/users).
 */
export interface CreateUserPayload {
  name: string;
  username: string;
  password: string;
  phoneNumber: string;
  role: string;
  permissions: string[];
}

/**
 * Payload for updating a user (PUT /api/users/:id).
 */
export interface UpdateUserPayload {
  name?: string;
  username?: string;
  password?: string;
  phoneNumber?: string;
  role?: string;
  permissions?: string[];
}

/**
 * User object returned from GET /api/users/me.
 */
export interface MeUser {
  _id: string;
  name: string;
  username: string;
  phoneNumber: string;
  role: string;
  permissions: string[];
  createdAt?: string;
  updatedAt?: string;
  __v?: number;
  createdBy?: {
    _id: string;
    name?: string;
  };
  updatedBy?: {
    _id: string;
    name?: string;
  };
}

/**
 * Menu item returned from GET /api/users/me.
 */
export interface MeMenuItem {
  module: string;
  label: string;
  path: string;
}

/**
 * Full payload from GET /api/users/me.
 */
export interface MeResponse {
  user: MeUser;
  menu: MeMenuItem[];
}

