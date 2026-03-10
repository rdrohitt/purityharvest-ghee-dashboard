import { apiFetch } from '../api';
import type { CustomerSearchResult } from '../types/shopify';

/**
 * Search customers by phone digits. GET /api/customers/search?phone=<digits>
 */
export async function searchCustomersByPhone(phoneDigits: string): Promise<CustomerSearchResult[]> {
    const trimmed = (phoneDigits || '').replace(/\D/g, '');
    if (!trimmed) return [];
    const response = await apiFetch(`/api/customers/search?phone=${encodeURIComponent(trimmed)}`);
    if (!response.ok) return [];
    const json = (await response.json()) as unknown;
    if (Array.isArray(json)) return json as CustomerSearchResult[];
    if (json && typeof json === 'object' && Array.isArray((json as Record<string, unknown>).data)) {
        return (json as { data: CustomerSearchResult[] }).data;
    }
    return [];
}
