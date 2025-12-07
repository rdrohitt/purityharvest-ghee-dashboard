export type SpendRecord = { id: string; date: string; amount: number; note?: string };
export type MiscRecord = { id: string; date: string; amount: number; where: string; note?: string };

/**
 * Load marketing spend records from the backend API.
 */
export async function loadMarketingSpend(endpoint: 'meta-spend' | 'amazon-spend' | 'flipkart-spend' | 'misc-spend'): Promise<SpendRecord[] | MiscRecord[]> {
    const response = await fetch(`/api/${endpoint}`);
    if (!response.ok) {
        throw new Error(`Failed to load ${endpoint} from API`);
    }
    return (await response.json()) as SpendRecord[] | MiscRecord[];
}

/**
 * Add a new marketing spend record via the backend API.
 */
export async function addMarketingSpend(endpoint: 'meta-spend' | 'amazon-spend' | 'flipkart-spend' | 'misc-spend', record: SpendRecord | MiscRecord): Promise<SpendRecord | MiscRecord> {
    const response = await fetch(`/api/${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(record),
    });

    if (!response.ok) {
        throw new Error(`Failed to save ${endpoint}`);
    }

    return (await response.json()) as SpendRecord | MiscRecord;
}

/**
 * Update an existing marketing spend record via the backend API.
 */
export async function updateMarketingSpend(endpoint: 'meta-spend' | 'amazon-spend' | 'flipkart-spend' | 'misc-spend', record: SpendRecord | MiscRecord): Promise<SpendRecord | MiscRecord> {
    const response = await fetch(`/api/${endpoint}/${record.id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(record),
    });

    if (!response.ok) {
        throw new Error(`Failed to update ${endpoint}`);
    }

    return (await response.json()) as SpendRecord | MiscRecord;
}

/**
 * Delete a marketing spend record via the backend API.
 */
export async function deleteMarketingSpend(endpoint: 'meta-spend' | 'amazon-spend' | 'flipkart-spend' | 'misc-spend', id: string): Promise<void> {
    const response = await fetch(`/api/${endpoint}/${id}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error(`Failed to delete ${endpoint}`);
    }
}

