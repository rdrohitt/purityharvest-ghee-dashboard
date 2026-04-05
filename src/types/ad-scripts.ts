/**
 * Ad / marketing script document from GET /api/ad-scripts.
 * Server may add `_id`, `id`, `createdAt`, `updatedAt`.
 */
export interface AdScriptApi {
    _id?: string;
    id?: string;
    date: string;
    author: string;
    title: string;
    /** May contain HTML from the rich-text editor (TipTap). */
    description: string;
    status: string;
    category: string;
    createdAt?: string;
    updatedAt?: string;
}

/**
 * Body for POST /api/ad-scripts.
 */
export interface AdScriptCreatePayload {
    date: string;
    author: string;
    title: string;
    /** May contain HTML from the rich-text editor (TipTap). */
    description: string;
    status: string;
    category: string;
}

/**
 * Body for PUT /api/ad-scripts/:id — any subset of fields; omitted keys stay unchanged on the server.
 */
export type AdScriptUpdatePayload = Partial<
    Pick<AdScriptCreatePayload, 'date' | 'author' | 'title' | 'description' | 'status' | 'category'>
>;
