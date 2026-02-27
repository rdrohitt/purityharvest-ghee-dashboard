import React from 'react';

export default function CostingMaster() {
    return (
        <section style={{ display: 'grid', gap: 12 }}>
            <div className="card" style={{ display: 'grid', gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>Costing Master</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                    Configure and manage product costing, margins, and shipping assumptions.
                </div>
                <div style={{ padding: 16, borderRadius: 8, border: '1px dashed var(--border)', background: 'var(--panel)' }}>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                        This screen is ready for your costing configuration.
                        Decide how you want to store and visualize costs (by SKU, by size, by channel, etc.),
                        and we can wire it up to your existing products and orders.
                    </div>
                </div>
            </div>
        </section>
    );
}

