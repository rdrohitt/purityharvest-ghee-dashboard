export function hasPermission(permissions: string[] | undefined, required: string): boolean {
    return (permissions ?? []).includes(required);
}

export function hasAnyPermission(permissions: string[] | undefined, required: string[]): boolean {
    const set = new Set(permissions ?? []);
    return required.some((p) => set.has(p));
}

/** Shopify, Amazon, Flipkart — requires orders:view (modify-only does not grant channel access). */
export function canViewSalesChannels(permissions: string[] | undefined): boolean {
    return hasPermission(permissions, 'orders:view');
}

/** RTO Orders page — orders:viewrto (legacy viewrto:* supported until users are re-saved). */
export function canViewRtoOrders(permissions: string[] | undefined): boolean {
    return (
        hasPermission(permissions, 'orders:viewrto') ||
        hasAnyPermission(permissions, ['viewrto:view', 'viewrto:modify'])
    );
}
