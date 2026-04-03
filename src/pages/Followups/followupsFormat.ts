export function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function toInputDate(dateStr: string | null): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function getCustomerType(totalOrders: number): string {
    if (totalOrders === 1) return 'new';
    if (totalOrders >= 2 && totalOrders <= 4) return 'repeat';
    if (totalOrders >= 5) return 'loyal';
    return 'new';
}

export function formatCurrency(n: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export function getFeedbackSelectClass(feedback: string): string {
    const value = (feedback || '').toLowerCase();
    if (!value) return 'fu-feedback-sel--empty';
    if (value.includes('excellent')) return 'fu-feedback-sel--excellent';
    if (value.includes('average')) return 'fu-feedback-sel--average';
    if (value.includes('smell') || value.includes('issue') || value.includes('rancid')) return 'fu-feedback-sel--issue';
    if (value.includes('price') || value.includes('high')) return 'fu-feedback-sel--price';
    if (value.includes('packaging')) return 'fu-feedback-sel--packaging';
    if (value.includes('delay') || value.includes('delivery')) return 'fu-feedback-sel--delay';
    return 'fu-feedback-sel--other';
}

export function getFeedbackEmoji(feedback: string): string {
    const value = (feedback || '').toLowerCase();
    if (value.includes('excellent')) return '🌟';
    if (value.includes('average')) return '🙂';
    if (value.includes('smell')) return '👃';
    if (value.includes('price')) return '💸';
    if (value.includes('packaging')) return '📦';
    if (value.includes('delay')) return '⏱️';
    return '💬';
}
