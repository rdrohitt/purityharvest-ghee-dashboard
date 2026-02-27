import React, { useState } from 'react';

type CostRow = {
    id: number;
    product: string;
    actualCost: number;
};

export default function CostingMaster() {
    const [rows, setRows] = useState<CostRow[]>([]);
    const [newProduct, setNewProduct] = useState('');
    const [newCost, setNewCost] = useState('');

    function addRow(e: React.FormEvent) {
        e.preventDefault();
        if (!newProduct.trim() || !newCost) return;
        const costNumber = Number(newCost);
        if (Number.isNaN(costNumber)) return;

        setRows((prev) => [
            ...prev,
            {
                id: Date.now(),
                product: newProduct.trim(),
                actualCost: costNumber,
            },
        ]);
        setNewProduct('');
        setNewCost('');
    }

    return (
        <section style={{ display: 'grid', gap: 12 }}>
            <div className="card" style={{ display: 'grid', gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>Costing Master</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                    Maintain a simple master of product-level actual costing so you can track margins and profitability.
                </div>

                {/* Add row form */}
                <form
                    onSubmit={addRow}
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) auto',
                        gap: 12,
                        alignItems: 'end',
                        marginTop: 12,
                    }}
                >
                    <div>
                        <label className="label">Product</label>
                        <input
                            className="input"
                            style={{ width: '100%', marginTop: 6 }}
                            placeholder="e.g. A2 Desi Cow Ghee 500ml"
                            value={newProduct}
                            onChange={(e) => setNewProduct(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="label">Actual Cost (₹)</label>
                        <input
                            className="input"
                            style={{ width: '100%', marginTop: 6 }}
                            type="number"
                            min={0}
                            step="0.01"
                            value={newCost}
                            onChange={(e) => setNewCost(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="label" style={{ visibility: 'hidden' }}>
                            Add
                        </label>
                        <button type="submit" className="button" style={{ width: '100%', padding: '0 16px' }}>
                            Add Record
                        </button>
                    </div>
                </form>
            </div>

            {/* Costing table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-scroll-wrapper">
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                        <thead>
                            <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                                <Th>S.No</Th>
                                <Th>Product</Th>
                                <Th>Actual Cost (₹)</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={3}
                                        style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}
                                    >
                                        No costing records yet. Add your first product above.
                                    </td>
                                </tr>
                            ) : (
                                rows.map((row, index) => (
                                    <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <Td>{index + 1}</Td>
                                        <Td>{row.product}</Td>
                                        <Td>₹ {row.actualCost.toFixed(2)}</Td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}

function Th({ children }: { children: string }) {
    return (
        <th
            style={{
                textAlign: 'left',
                padding: '10px 12px',
                fontSize: 12,
                color: 'var(--muted)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
            }}
        >
            {children}
        </th>
    );
}

function Td({ children }: { children: React.ReactNode }) {
    return <td style={{ padding: '12px' }}>{children}</td>;
}

