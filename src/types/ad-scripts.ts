/** Populated user ref on script documents from the API. */
export interface AdScriptUserRef {
    _id: string;
    name?: string;
}

/**
 * Ad / marketing script document from GET /api/ad-scripts or GET /api/ad-scripts/:id.
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
    createdBy?: AdScriptUserRef;
    updatedBy?: AdScriptUserRef;
    __v?: number;
}

/**
 * Paginated list response from GET /api/ad-scripts?page=&limit=&category=.
 */
export interface AdScriptsListResponse {
    count: number;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    rows: AdScriptApi[];
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
