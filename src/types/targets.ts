/** POST /api/targets/ */
export type CreateTargetPayload = {
    /** First day of target month in ISO format, e.g. 2026-08-01T00:00:00.000Z */
    month: string;
    target: string;
    platform: string;
};

export type TargetApiItem = {
    _id?: string;
    month: string;
    target: string;
    platform: string;
    createdAt?: string;
    updatedAt?: string;
};
