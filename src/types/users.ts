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
