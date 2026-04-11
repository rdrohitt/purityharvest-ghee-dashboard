import React from 'react';
import { deliveryStatusLabel, normalizeDeliveryStatus } from '../../utils/orders';

export function StatusTag({ kind, type }: { kind: string; type: 'payment' | 'delivery' }) {
    let cls = 'tag info';
    if (type === 'payment') {
        if (kind === 'PAID') cls = 'tag success';
        else if (kind === 'COD') cls = 'tag warning';
        else cls = 'tag info';
    } else {
        const d = normalizeDeliveryStatus(kind);
        if (d === 'delivered') cls = 'tag success';
        else if (d === 'in_transit') cls = 'tag info';
        else if (d === 'pending_pickup') cls = 'tag warning';
        else if (d === 'rto') cls = 'tag danger';
    }
    return (
        <span className={cls}>
            {type === 'delivery' ? deliveryStatusLabel(kind) : kind}
        </span>
    );
}
