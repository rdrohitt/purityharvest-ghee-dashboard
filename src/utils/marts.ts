export type Mart = {
    id: string;
    name: string;
    mobile: string;
    sector: string;
    address: string;
    date: string;
    commission?: number;
    quantities: {
        gir500?: number;
        gir1?: number;
        desi500?: number;
        desi1?: number;
        buffalo500?: number;
        buffalo1?: number;
    };
    prices?: {
        gir500?: number;
        gir1?: number;
        desi500?: number;
        desi1?: number;
        buffalo500?: number;
        buffalo1?: number;
    };
};

export async function loadGurugramMarts(): Promise<Mart[]> {
    const response = await fetch('/api/gurugram-marts');
    if (!response.ok) {
        throw new Error('Failed to load Gurugram marts from API');
    }
    return (await response.json()) as Mart[];
}

export async function addGurugramMart(mart: Omit<Mart, 'id'>): Promise<Mart> {
    const response = await fetch('/api/gurugram-marts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(mart),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to save Gurugram mart' }));
        throw new Error(errorData.message || 'Failed to save Gurugram mart');
    }

    return (await response.json()) as Mart;
}

export async function updateGurugramMart(mart: Mart): Promise<Mart> {
    const response = await fetch(`/api/gurugram-marts/${mart.id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(mart),
    });

    if (!response.ok) {
        throw new Error('Failed to update Gurugram mart');
    }

    return (await response.json()) as Mart;
}

export async function deleteGurugramMart(id: string): Promise<void> {
    const response = await fetch(`/api/gurugram-marts/${id}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error('Failed to delete Gurugram mart');
    }
}

export async function loadDelhiMarts(): Promise<Mart[]> {
    const response = await fetch('/api/delhi-marts');
    if (!response.ok) {
        throw new Error('Failed to load Delhi marts from API');
    }
    return (await response.json()) as Mart[];
}

export async function addDelhiMart(mart: Omit<Mart, 'id'>): Promise<Mart> {
    const response = await fetch('/api/delhi-marts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(mart),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to save Delhi mart' }));
        throw new Error(errorData.message || 'Failed to save Delhi mart');
    }

    return (await response.json()) as Mart;
}

export async function updateDelhiMart(mart: Mart): Promise<Mart> {
    const response = await fetch(`/api/delhi-marts/${mart.id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(mart),
    });

    if (!response.ok) {
        throw new Error('Failed to update Delhi mart');
    }

    return (await response.json()) as Mart;
}

export async function deleteDelhiMart(id: string): Promise<void> {
    const response = await fetch(`/api/delhi-marts/${id}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error('Failed to delete Delhi mart');
    }
}

