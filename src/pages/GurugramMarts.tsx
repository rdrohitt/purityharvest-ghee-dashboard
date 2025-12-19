import { useState, useEffect, useRef, useMemo } from 'react';
import { loadGurugramMarts, addGurugramMart, updateGurugramMart, deleteGurugramMart, type Mart, type RefillEntry, type SalesEntry } from '../utils/marts';
import { loadProducts, type Product } from '../utils/products';
import { loadOrders, type Order, type OrderItem } from '../utils/orders';

function formatCurrency(n: number): string { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n); }
function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

type UiRange = 'all' | 'today' | 'yesterday' | 'last7' | 'currentMonth' | 'lastMonth' | 'custom';
type PerformanceFilter = 'all' | 'top' | 'good' | 'average' | 'none';

/**
 * Standalone Gurugram Marts page with Shopify-style filters.
 * (Currently only the filter UI; hook up data / metrics later.)
 */
export default function GurugramMarts() {
    const [range, setRange] = useState<UiRange>('all');
    const [customerFilter, setCustomerFilter] = useState('');
    const [performance, setPerformance] = useState<PerformanceFilter>('all');
    const [showAddMart, setShowAddMart] = useState(false);
    const [martName, setMartName] = useState('');
    const [martMobile, setMartMobile] = useState('');
    const [martSector, setMartSector] = useState('');
    const [martAddress, setMartAddress] = useState('');
    const [martDate, setMartDate] = useState(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    });
    const [martCommission, setMartCommission] = useState('');
    const [quantities, setQuantities] = useState<Record<string, string>>({});
    const [prices, setPrices] = useState<Record<string, number>>({});
    const [marts, setMarts] = useState<Mart[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingMartId, setEditingMartId] = useState<string | null>(null);
    const [martToDelete, setMartToDelete] = useState<Mart | null>(null);
    const [selectedMart, setSelectedMart] = useState<Mart | null>(null);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);

    const products = [
        { key: 'gir500', label: 'Gir Cow - 500ml', name: 'A2 Gir Cow Ghee', size: '500 ml', price: 900 },
        { key: 'gir1', label: 'Gir Cow - 1 ltr', name: 'A2 Gir Cow Ghee', size: '1000 ml', price: 1720 },
        { key: 'desi500', label: 'Desi Cow - 500ml', name: 'A2 Desi Cow Ghee', size: '500 ml', price: 710 },
        { key: 'desi1', label: 'Desi Cow - 1 ltr', name: 'A2 Desi Cow Ghee', size: '1000 ml', price: 1350 },
        { key: 'buffalo500', label: 'Buffalo - 500ml', name: 'A2 Buffalo Ghee', size: '500 ml', price: 650 },
        { key: 'buffalo1', label: 'Buffalo - 1 ltr', name: 'A2 Buffalo Ghee', size: '1000 ml', price: 1250 },
    ];

    function getProductPrice(productKey: string): number | null {
        // First check if price is stored in mart data (prices state)
        if (prices[productKey] !== undefined) {
            return prices[productKey];
        }
        // Otherwise use default price from products array
        const product = products.find(p => p.key === productKey);
        return product?.price ?? null;
    }

    useEffect(() => {
        async function fetchMarts() {
            try {
                setLoading(true);
                const data = await loadGurugramMarts();
                setMarts(data);
            } catch (err) {
                console.error('Failed to load marts:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchMarts();
    }, []);

    useEffect(() => {
        async function fetchProducts() {
            try {
                const data = await loadProducts();
                setAllProducts(data);
            } catch (err) {
                console.error('Failed to load products:', err);
            }
        }
        fetchProducts();
    }, []);

    useEffect(() => {
        async function fetchOrders() {
            try {
                const data = await loadOrders();
                setOrders(data);
            } catch (err) {
                console.error('Failed to load orders:', err);
            }
        }
        fetchOrders();
    }, []);

    async function handleSaveMart() {
        try {
            // Validate required fields
            if (!martName.trim()) {
                alert('Please enter customer name');
                return;
            }
            if (!martMobile.trim()) {
                alert('Please enter mobile number');
                return;
            }
            if (!martDate) {
                alert('Please select a date');
                return;
            }

            const quantitiesObj: Record<string, number> = {};
            const pricesObj: Record<string, number> = {};
            
            Object.entries(quantities).forEach(([key, value]) => {
                const num = parseInt(value, 10);
                if (!isNaN(num) && num > 0) {
                    quantitiesObj[key] = num;
                    // Use price from stored prices (mart data) or default price
                    const price = prices[key] !== undefined ? prices[key] : getProductPrice(key);
                    if (price !== null) {
                        pricesObj[key] = price;
                    }
                }
            });

            const commissionValue = martCommission.trim() ? parseFloat(martCommission.trim()) : undefined;

            const martData = {
                name: martName.trim(),
                mobile: martMobile.trim(),
                sector: martSector.trim(),
                address: martAddress.trim(),
                date: martDate,
                commission: commissionValue && !isNaN(commissionValue) ? commissionValue : undefined,
                quantities: quantitiesObj,
                prices: Object.keys(pricesObj).length > 0 ? pricesObj : undefined,
            };

            console.log('Saving mart:', martData);
            
            if (editingMartId) {
                await updateGurugramMart({ ...martData, id: editingMartId });
                setEditingMartId(null);
            } else {
                await addGurugramMart(martData);
            }

            // Reset form
            setMartName('');
            setMartMobile('');
            setMartSector('');
            setMartAddress('');
            setMartDate(() => {
                const today = new Date();
                return today.toISOString().split('T')[0];
            });
            setMartCommission('');
            setQuantities({});
            setPrices({});
            setShowAddMart(false);

            // Reload marts
            const data = await loadGurugramMarts();
            setMarts(data);
        } catch (err) {
            console.error('Failed to save mart:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to save mart. Please try again.';
            alert(errorMessage);
        }
    }

    async function handleDeleteMart() {
        if (!martToDelete) return;
        try {
            await deleteGurugramMart(martToDelete.id);
            const data = await loadGurugramMarts();
            setMarts(data);
            setMartToDelete(null);
        } catch (err) {
            console.error('Failed to delete mart:', err);
            alert('Failed to delete mart. Please try again.');
        }
    }

    function handleEditMart(mart: Mart) {
        setMartName(mart.name);
        setMartMobile(mart.mobile);
        setMartSector(mart.sector);
        setMartAddress(mart.address);
        setMartDate(mart.date);
        setMartCommission(mart.commission ? String(mart.commission) : '');
        const qtyObj: Record<string, string> = {};
        Object.entries(mart.quantities || {}).forEach(([key, value]) => {
            qtyObj[key] = String(value);
        });
        setQuantities(qtyObj);
        // Populate prices from mart data
        const priceObj: Record<string, number> = {};
        Object.entries(mart.prices || {}).forEach(([key, value]) => {
            priceObj[key] = value;
        });
        setPrices(priceObj);
        setEditingMartId(mart.id);
        setShowAddMart(true);
    }

    function handleCancelEdit() {
        setShowAddMart(false);
        setEditingMartId(null);
        setMartName('');
        setMartMobile('');
        setMartSector('');
        setMartAddress('');
        setMartDate(() => {
            const today = new Date();
            return today.toISOString().split('T')[0];
        });
        setMartCommission('');
        setQuantities({});
        setPrices({});
    }

    function formatDate(dateStr: string): string {
        const date = new Date(dateStr);
        const day = String(date.getDate()).padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    }

    return (
        <section style={{ display: 'grid', gap: 12, width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
            <div
                className="card"
                style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    position: 'relative',
                }}
            >
                <div style={{ fontWeight: 800 }}>Gurugram Marts</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div className="filter-group" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <FilterButton active={range === 'all'} onClick={() => setRange('all')}>
                                All
                            </FilterButton>
                            <FilterButton active={range === 'today'} onClick={() => setRange('today')}>
                                Today
                            </FilterButton>
                            <FilterButton active={range === 'yesterday'} onClick={() => setRange('yesterday')}>
                                Yesterday
                            </FilterButton>
                            <FilterButton active={range === 'last7'} onClick={() => setRange('last7')}>
                                Last 7 days
                            </FilterButton>
                            <FilterButton active={range === 'currentMonth'} onClick={() => setRange('currentMonth')}>
                                Current Month
                            </FilterButton>
                            <FilterButton active={range === 'lastMonth'} onClick={() => setRange('lastMonth')}>
                                Last Month
                            </FilterButton>
                            <FilterButton active={range === 'custom'} onClick={() => setRange('custom')}>
                                Custom
                            </FilterButton>
                        </div>
                        <div style={{ flex: 1 }} />
                        <input
                            className="input"
                            placeholder="Search customer name or phone"
                            style={{ width: 240 }}
                            value={customerFilter}
                            onChange={(e) => setCustomerFilter(e.target.value)}
                        />
                        <button
                            className="button"
                            style={{ width: 'auto', padding: '0 16px' }}
                            type="button"
                            onClick={() => setShowAddMart(true)}
                        >
                            Add Mart
                        </button>
                    </div>

                    {/* Performance filter row */}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div className="filter-group" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <FilterButton active={performance === 'all'} onClick={() => setPerformance('all')}>
                                All Stores
                            </FilterButton>
                            <FilterButton active={performance === 'top'} onClick={() => setPerformance('top')}>
                                Top Performing
                            </FilterButton>
                            <FilterButton active={performance === 'good'} onClick={() => setPerformance('good')}>
                                Good Performing
                            </FilterButton>
                            <FilterButton active={performance === 'average'} onClick={() => setPerformance('average')}>
                                Average
                            </FilterButton>
                            <FilterButton active={performance === 'none'} onClick={() => setPerformance('none')}>
                                No Performing
                            </FilterButton>
                        </div>
                    </div>

                    {/* Summary metrics row (visual only for now) */}
                    <div
                        style={{
                            width: '100%',
                            display: 'flex',
                            borderRadius: 4,
                            overflow: 'hidden',
                            border: '1px solid var(--border)',
                            marginTop: 12,
                            background: 'var(--bg-elev)',
                        }}
                    >
                        <MetricItem icon="🚫" label="Blocked Amount" value="₹0" isLast={false} isEven={false} />
                        <QuantityMetric
                            label="Blocked Qty"
                            lines={['500ml — 0', '1ltr — 0']}
                            isLast={false}
                            isEven={true}
                        />
                        <MetricItem icon="💰" label="Total Sale" value="₹0" isLast={false} isEven={false} />
                        <QuantityMetric
                            label="Sale Qty"
                            lines={['500ml — 0', '1ltr — 0']}
                            isLast={true}
                            isEven={true}
                        />
                    </div>
                </div>
            </div>

            {/* Marts Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-scroll-wrapper">
                    <table
                        style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            minWidth: 1000,
                        }}
                    >
                        <thead>
                            <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700, width: 150 }}>Onboarding Date</th>
                                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700, width: 200 }}>Mart Name</th>
                                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Mobile</th>
                                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Sector</th>
                                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Commission</th>
                                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Products</th>
                                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                                        Loading marts...
                                    </td>
                                </tr>
                            ) : marts.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                                        No marts found. Click "Add Mart" to create your first mart.
                                    </td>
                                </tr>
                            ) : (
                                marts.map((mart) => (
                                    <tr key={mart.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '12px' }}>{formatDate(mart.date)}</td>
                                        <td style={{ padding: '12px' }}>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedMart(mart)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    padding: 0,
                                                    cursor: 'pointer',
                                                    fontSize: 14,
                                                    color: 'var(--link)',
                                                    fontWeight: 600,
                                                    textDecoration: 'underline',
                                                    textAlign: 'left',
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.color = 'var(--link-hover)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.color = 'var(--link)';
                                                }}
                                            >
                                                {mart.name}
                                            </button>
                                        </td>
                                        <td style={{ padding: '12px' }}>{mart.mobile}</td>
                                        <td style={{ padding: '12px' }}>{mart.sector}</td>
                                        <td style={{ padding: '12px' }}>{mart.commission !== undefined ? `${mart.commission}%` : '—'}</td>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                {(() => {
                                                    const qty = mart.quantities || {};
                                                    const tags = [];
                                                    
                                                    // Gir Cow
                                                    const gir500 = qty.gir500 || 0;
                                                    const gir1 = qty.gir1 || 0;
                                                    if (gir500 > 0 || gir1 > 0) {
                                                        const parts = [];
                                                        if (gir500 > 0) parts.push(`500ml: ${gir500}`);
                                                        if (gir1 > 0) parts.push(`1ltr: ${gir1}`);
                                                        tags.push({ label: 'Gir Cow', value: parts.join(', ') });
                                                    }
                                                    
                                                    // Desi Cow
                                                    const desi500 = qty.desi500 || 0;
                                                    const desi1 = qty.desi1 || 0;
                                                    if (desi500 > 0 || desi1 > 0) {
                                                        const parts = [];
                                                        if (desi500 > 0) parts.push(`500ml: ${desi500}`);
                                                        if (desi1 > 0) parts.push(`1ltr: ${desi1}`);
                                                        tags.push({ label: 'Desi Cow', value: parts.join(', ') });
                                                    }
                                                    
                                                    // Buffalo
                                                    const buffalo500 = qty.buffalo500 || 0;
                                                    const buffalo1 = qty.buffalo1 || 0;
                                                    if (buffalo500 > 0 || buffalo1 > 0) {
                                                        const parts = [];
                                                        if (buffalo500 > 0) parts.push(`500ml: ${buffalo500}`);
                                                        if (buffalo1 > 0) parts.push(`1ltr: ${buffalo1}`);
                                                        tags.push({ label: 'Buffalo', value: parts.join(', ') });
                                                    }
                                                    
                                                    return tags.length > 0 ? tags.map((tag, tagIdx) => (
                                                        <span
                                                            key={tagIdx}
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                padding: '6px 12px',
                                                                borderRadius: 16,
                                                                fontSize: 11,
                                                                fontWeight: 600,
                                                                background: 'linear-gradient(135deg, var(--bg-elev) 0%, rgba(22, 163, 74, 0.08) 100%)',
                                                                border: '1px solid rgba(22, 163, 74, 0.2)',
                                                                color: 'var(--text)',
                                                                whiteSpace: 'nowrap',
                                                                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                                                            }}
                                                        >
                                                            <span style={{ fontWeight: 700, marginRight: 4 }}>{tag.label}:</span>
                                                            <span style={{ color: 'var(--muted)' }}>{tag.value}</span>
                                                        </span>
                                                    )) : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>;
                                                })()}
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button
                                                    type="button"
                                                    className="icon-btn"
                                                    onClick={() => handleEditMart(mart)}
                                                    style={{ fontSize: 12, padding: '4px 8px' }}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    className="icon-btn icon-btn--danger"
                                                    onClick={() => setMartToDelete(mart)}
                                                    style={{ fontSize: 12, padding: '4px 8px' }}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {showAddMart && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(15, 23, 42, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                    }}
                >
                    <div
                        className="card"
                        style={{
                            width: '100%',
                            maxWidth: 900,
                            maxHeight: '90vh',
                            overflow: 'auto',
                            padding: 20,
                            borderRadius: 16,
                        }}
                    >
                        <div
                            style={{
                                position: 'sticky',
                                top: 0,
                                zIndex: 1,
                                background: 'var(--bg-elev)',
                                paddingBottom: 12,
                                marginBottom: 12,
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{editingMartId ? 'Edit Mart' : 'Add Mart'}</h2>
                                <button
                                    type="button"
                                    className="icon-btn"
                                    onClick={handleCancelEdit}
                                    style={{ marginLeft: 'auto' }}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
                            {/* Top row: Phone and Customer Name */}
                            <div style={{ display: 'flex', gap: 16 }}>
                                <div style={{ flex: 1 }}>
                                    <label
                                        style={{
                                            display: 'block',
                                            fontSize: 13,
                                            fontWeight: 700,
                                            color: '#166534',
                                            marginBottom: 6,
                                        }}
                                    >
                                        Phone
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="tel"
                                            inputMode="numeric"
                                            value={martMobile}
                                            onChange={(e) => {
                                                const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                                                setMartMobile(digits);
                                            }}
                                            placeholder="Type phone number to search..."
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                borderRadius: 8,
                                                border: '1px solid #86efac',
                                                background: '#f0fdf4',
                                                fontSize: 14,
                                                color: 'var(--text)',
                                                outline: 'none',
                                                transition: 'all 0.2s',
                                            }}
                                            onFocus={(e) => {
                                                e.currentTarget.style.borderColor = '#4ade80';
                                                e.currentTarget.style.background = '#ffffff';
                                            }}
                                            onBlur={(e) => {
                                                e.currentTarget.style.borderColor = '#86efac';
                                                e.currentTarget.style.background = '#f0fdf4';
                                            }}
                                        />
                                    </div>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label
                                        style={{
                                            display: 'block',
                                            fontSize: 13,
                                            fontWeight: 700,
                                            color: '#166534',
                                            marginBottom: 6,
                                        }}
                                    >
                                        Mart Name
                                    </label>
                                    <input
                                        type="text"
                                        value={martName}
                                        onChange={(e) => setMartName(e.target.value)}
                                        placeholder="Enter customer name"
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px',
                                            borderRadius: 8,
                                            border: '1px solid #86efac',
                                            background: '#f0fdf4',
                                            fontSize: 14,
                                            color: 'var(--text)',
                                            outline: 'none',
                                            transition: 'all 0.2s',
                                        }}
                                        onFocus={(e) => {
                                            e.currentTarget.style.borderColor = '#4ade80';
                                            e.currentTarget.style.background = '#ffffff';
                                        }}
                                        onBlur={(e) => {
                                            e.currentTarget.style.borderColor = '#86efac';
                                            e.currentTarget.style.background = '#f0fdf4';
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Address below Phone */}
                            <div>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: '#166534',
                                        marginBottom: 6,
                                    }}
                                >
                                    Address
                                </label>
                                <textarea
                                    value={martAddress}
                                    onChange={(e) => setMartAddress(e.target.value)}
                                    placeholder="Enter address"
                                    rows={3}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: 8,
                                        border: '1px solid #86efac',
                                        background: '#f0fdf4',
                                        fontSize: 14,
                                        color: 'var(--text)',
                                        outline: 'none',
                                        resize: 'vertical',
                                        transition: 'all 0.2s',
                                        fontFamily: 'inherit',
                                    }}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = '#4ade80';
                                        e.currentTarget.style.background = '#ffffff';
                                    }}
                                    onBlur={(e) => {
                                        e.currentTarget.style.borderColor = '#86efac';
                                        e.currentTarget.style.background = '#f0fdf4';
                                    }}
                                />
                            </div>

                            {/* Sector and Date */}
                            <div style={{ display: 'flex', gap: 16 }}>
                                <div style={{ flex: 1 }}>
                                    <label
                                        style={{
                                            display: 'block',
                                            fontSize: 13,
                                            fontWeight: 700,
                                            color: '#166534',
                                            marginBottom: 6,
                                        }}
                                    >
                                        Sector
                                    </label>
                                    <input
                                        type="text"
                                        value={martSector}
                                        onChange={(e) => setMartSector(e.target.value)}
                                        placeholder="Enter sector"
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px',
                                            borderRadius: 8,
                                            border: '1px solid #86efac',
                                            background: '#f0fdf4',
                                            fontSize: 14,
                                            color: 'var(--text)',
                                            outline: 'none',
                                            transition: 'all 0.2s',
                                        }}
                                        onFocus={(e) => {
                                            e.currentTarget.style.borderColor = '#4ade80';
                                            e.currentTarget.style.background = '#ffffff';
                                        }}
                                        onBlur={(e) => {
                                            e.currentTarget.style.borderColor = '#86efac';
                                            e.currentTarget.style.background = '#f0fdf4';
                                        }}
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label
                                        style={{
                                            display: 'block',
                                            fontSize: 13,
                                            fontWeight: 700,
                                            color: '#166534',
                                            marginBottom: 6,
                                        }}
                                    >
                                        Date
                                    </label>
                                    <DatePicker
                                        value={martDate}
                                        onChange={setMartDate}
                                        placeholder="Select date"
                                    />
                                </div>
                            </div>

                            {/* Commission */}
                            <div>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: '#166534',
                                        marginBottom: 6,
                                    }}
                                >
                                    Commission (%)
                                </label>
                                <input
                                    type="number"
                                    value={martCommission}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        // Allow empty, or valid number with max 2 decimal places
                                        if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
                                            setMartCommission(value);
                                        }
                                    }}
                                    placeholder="Enter commission percentage"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: 8,
                                        border: '1px solid #86efac',
                                        background: '#f0fdf4',
                                        fontSize: 14,
                                        color: 'var(--text)',
                                        outline: 'none',
                                        transition: 'all 0.2s',
                                    }}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = '#4ade80';
                                        e.currentTarget.style.background = '#ffffff';
                                    }}
                                    onBlur={(e) => {
                                        e.currentTarget.style.borderColor = '#86efac';
                                        e.currentTarget.style.background = '#f0fdf4';
                                    }}
                                />
                            </div>
                        </div>

                        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
                            <div className="table-scroll-wrapper">
                                <table
                                    style={{
                                        width: '100%',
                                        borderCollapse: 'collapse',
                                        minWidth: 500,
                                    }}
                                >
                                    <thead>
                                        <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                                            <th
                                                style={{
                                                    textAlign: 'left',
                                                    padding: '10px 12px',
                                                    fontSize: 12,
                                                    color: 'var(--muted)',
                                                    fontWeight: 700,
                                                    width: 110,
                                                }}
                                            >
                                                Product
                                            </th>
                                            <th
                                                style={{
                                                    textAlign: 'left',
                                                    padding: '10px 12px',
                                                    fontSize: 12,
                                                    color: 'var(--muted)',
                                                    fontWeight: 700,
                                                    width: 100,
                                                }}
                                            >
                                                Price
                                            </th>
                                            <th
                                                style={{
                                                    textAlign: 'left',
                                                    padding: '10px 12px',
                                                    fontSize: 12,
                                                    color: 'var(--muted)',
                                                    fontWeight: 700,
                                                    width: 120,
                                                }}
                                            >
                                                Quantity
                                            </th>
                                            <th
                                                style={{
                                                    textAlign: 'left',
                                                    padding: '10px 12px',
                                                    fontSize: 12,
                                                    color: 'var(--muted)',
                                                    fontWeight: 700,
                                                    width: 110,
                                                }}
                                            >
                                                Product
                                            </th>
                                            <th
                                                style={{
                                                    textAlign: 'left',
                                                    padding: '10px 12px',
                                                    fontSize: 12,
                                                    color: 'var(--muted)',
                                                    fontWeight: 700,
                                                    width: 100,
                                                }}
                                            >
                                                Price
                                            </th>
                                            <th
                                                style={{
                                                    textAlign: 'left',
                                                    padding: '10px 12px',
                                                    fontSize: 12,
                                                    color: 'var(--muted)',
                                                    fontWeight: 700,
                                                    width: 120,
                                                }}
                                            >
                                                Quantity
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            [products[0], products[1]],
                                            [products[2], products[3]],
                                            [products[4], products[5]],
                                        ].map((pair, rowIdx) => (
                                            <tr
                                                key={rowIdx}
                                                style={{
                                                    borderBottom:
                                                        rowIdx === 2 ? 'none' : '1px solid var(--border)',
                                                }}
                                            >
                                                {pair.map((p, colIdx) =>
                                                    p ? (
                                                        <>
                                                            <td
                                                                key={p.key + '-label'}
                                                                style={{ padding: '10px 12px', fontSize: 12, width: 110 }}
                                                            >
                                                                {p.label}
                                                            </td>
                                                            <td
                                                                key={p.key + '-price'}
                                                                style={{ padding: '10px 12px', fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}
                                                            >
                                                                {getProductPrice(p.key) !== null ? `₹${getProductPrice(p.key)?.toLocaleString('en-IN')}` : '—'}
                                                            </td>
                                                            <td
                                                                key={p.key + '-input'}
                                                                style={{ padding: '10px 12px', width: 120 }}
                                                            >
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    className="input"
                                                                    value={quantities[p.key] ?? ''}
                                                                    onChange={(e) => {
                                                                        const value = e.target.value;
                                                                        setQuantities((prev) => ({
                                                                            ...prev,
                                                                            [p.key]: value,
                                                                        }));
                                                                        // When quantity is entered, populate price from default prices if not already set
                                                                        if (value && !prices[p.key]) {
                                                                            const productDef = products.find(pr => pr.key === p.key);
                                                                            if (productDef && productDef.price) {
                                                                                setPrices((prev) => ({
                                                                                    ...prev,
                                                                                    [p.key]: productDef.price,
                                                                                }));
                                                                            }
                                                                        }
                                                                    }}
                                                                    placeholder="0"
                                                                    style={{ width: '100%', height: 32 }}
                                                                />
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <td key={'empty-' + colIdx} colSpan={3} />
                                                    )
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button
                                type="button"
                                className="button button--ghost"
                                onClick={handleCancelEdit}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="button"
                                onClick={handleSaveMart}
                            >
                                {editingMartId ? 'Update Mart' : 'Save Mart'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {martToDelete && (
                <DeleteConfirmationModal
                    mart={martToDelete}
                    onConfirm={handleDeleteMart}
                    onCancel={() => setMartToDelete(null)}
                />
            )}

            {selectedMart && (
                <MartDetailsModal
                    mart={selectedMart}
                    orders={orders}
                    onClose={() => {
                        setSelectedMart(null);
                        // Reload marts to get updated data
                        loadGurugramMarts().then(setMarts).catch(console.error);
                    }}
                    onMartUpdate={() => {
                        // Reload marts to get updated data
                        loadGurugramMarts().then((data) => {
                            setMarts(data);
                            // Update selectedMart with fresh data
                            const updated = data.find(m => m.id === selectedMart.id);
                            if (updated) setSelectedMart(updated);
                        }).catch(console.error);
                    }}
                />
            )}
        </section>
    );
}

function FilterButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: string;
}) {
    return (
        <button onClick={onClick} className={`filter-btn ${active ? 'active' : ''}`}>
            {children}
        </button>
    );
}

function MetricItem({
    icon,
    label,
    value,
    isLast,
    isEven,
}: {
    icon: string;
    label: string;
    value: string;
    isLast: boolean;
    isEven: boolean;
}) {
    return (
        <div
            style={{
                background: isEven ? '#f8f9fa' : 'transparent',
                flex: 1,
                padding: '12px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                borderRight: isLast ? 'none' : '1px solid var(--border)',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 16, opacity: 0.8 }}>{icon}</span>
                <div
                    style={{
                        fontSize: 10,
                        color: 'var(--muted)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.4px',
                    }}
                >
                    {label}
                </div>
            </div>
            <div
                style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: 'var(--text)',
                    lineHeight: 1.2,
                    letterSpacing: '-0.2px',
                }}
            >
                {value}
            </div>
        </div>
    );
}

function QuantityMetric({
    label,
    lines,
    isLast,
    isEven,
}: {
    label: string;
    lines: string[];
    isLast: boolean;
    isEven: boolean;
}) {
    return (
        <div
            style={{
                background: isEven ? '#f8f9fa' : 'transparent',
                flex: 1,
                padding: '12px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                borderRight: isLast ? 'none' : '1px solid var(--border)',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 16, opacity: 0.8 }}>📊</span>
                <div
                    style={{
                        fontSize: 10,
                        color: 'var(--muted)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.4px',
                    }}
                >
                    {label}
                </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>
                {lines.map((line) => (
                    <div key={line}>{line}</div>
                ))}
            </div>
        </div>
    );
}

function MetricItemWithAmount({
    icon,
    label,
    count,
    amount,
    isLast,
    isEven,
}: {
    icon: string;
    label: string;
    count: number;
    amount: string;
    isLast: boolean;
    isEven: boolean;
}) {
    return (
        <div
            style={{
                background: isEven ? '#f8f9fa' : 'transparent',
                flex: 1,
                padding: '12px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                borderRight: isLast ? 'none' : '1px solid var(--border)',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 16, opacity: 0.8 }}>{icon}</span>
                <div
                    style={{
                        fontSize: 10,
                        color: 'var(--muted)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.4px',
                    }}
                >
                    {label}
                </div>
            </div>
            <div
                style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: 'var(--text)',
                    lineHeight: 1.2,
                    letterSpacing: '-0.2px',
                }}
            >
                {count}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{amount}</div>
        </div>
    );
}

function toInputDate(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function DatePicker({ value, onChange, required, placeholder }: { value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(() => {
        const date = value ? new Date(value) : new Date();
        return new Date(date.getFullYear(), date.getMonth(), 1);
    });
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    const selectedDate = value ? new Date(value) : null;
    const displayValue = selectedDate ? (() => {
        const day = String(selectedDate.getDate()).padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[selectedDate.getMonth()];
        const year = selectedDate.getFullYear();
        return `${day}-${month}-${year}`;
    })() : '';

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && inputRef.current && popupRef.current) {
            const inputRect = inputRef.current.getBoundingClientRect();
            const popup = popupRef.current;
            const popupHeight = 350;
            const popupWidth = 300;
            
            let top = inputRect.bottom + window.scrollY + 4;
            let left = inputRect.left + window.scrollX;
            
            if (inputRect.bottom + popupHeight > window.innerHeight) {
                top = inputRect.top + window.scrollY - popupHeight - 4;
            }
            
            if (inputRect.left + popupWidth > window.innerWidth) {
                left = window.innerWidth - popupWidth - 10;
            }
            
            popup.style.top = `${top}px`;
            popup.style.left = `${left}px`;
        }
    }, [isOpen]);

    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    function handleDateSelect(day: number) {
        const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        onChange(toInputDate(newDate));
        setIsOpen(false);
    }

    function handlePrevMonth() {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    }

    function handleNextMonth() {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    }

    function handleToday() {
        const today = new Date();
        onChange(toInputDate(today));
        setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
        setIsOpen(false);
    }

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
            <div
                ref={inputRef}
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '100%',
                    padding: '10px 12px 10px 12px',
                    borderRadius: 8,
                    border: '1px solid #86efac',
                    background: '#f0fdf4',
                    fontSize: 14,
                    color: displayValue ? 'var(--text)' : 'var(--muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    userSelect: 'none',
                    outline: 'none',
                    transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#4ade80';
                }}
                onMouseLeave={(e) => {
                    if (!isOpen) {
                        e.currentTarget.style.borderColor = '#86efac';
                    }
                }}
            >
                <span>{displayValue || placeholder || 'Select date'}</span>
                <span style={{ fontSize: 16, color: '#166534' }}>📅</span>
            </div>
            <input
                type="date"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required={required}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                tabIndex={-1}
            />
            {isOpen && (
                <div
                    ref={popupRef}
                    style={{
                        position: 'fixed',
                        background: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: 12,
                        padding: 20,
                        boxShadow: '0 10px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
                        zIndex: 10000,
                        minWidth: 300,
                        maxWidth: 300,
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <button
                            type="button"
                            onClick={handlePrevMonth}
                            style={{ 
                                padding: '6px 10px', 
                                fontSize: 18,
                                border: 'none',
                                background: '#f3f4f6',
                                borderRadius: 6,
                                cursor: 'pointer',
                                color: '#374151',
                                fontWeight: 600,
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#e5e7eb';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#f3f4f6';
                            }}
                            aria-label="Previous month"
                        >
                            ‹
                        </button>
                        <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>
                            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </div>
                        <button
                            type="button"
                            onClick={handleNextMonth}
                            style={{ 
                                padding: '6px 10px', 
                                fontSize: 18,
                                border: 'none',
                                background: '#f3f4f6',
                                borderRadius: 6,
                                cursor: 'pointer',
                                color: '#374151',
                                fontWeight: 600,
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#e5e7eb';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#f3f4f6';
                            }}
                            aria-label="Next month"
                        >
                            ›
                        </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 16 }}>
                        {weekDays.map((day) => (
                            <div key={day} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#6b7280', padding: '8px 0' }}>
                                {day}
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                        {Array(firstDayOfMonth).fill(null).map((_, i) => (
                            <div key={`empty-${i}`} />
                        ))}
                        {days.map((day) => {
                            const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                            const isSelected = selectedDate && 
                                date.getDate() === selectedDate.getDate() &&
                                date.getMonth() === selectedDate.getMonth() &&
                                date.getFullYear() === selectedDate.getFullYear();
                            const isToday = date.toDateString() === new Date().toDateString();
                            return (
                                <button
                                    key={day}
                                    type="button"
                                    onClick={() => handleDateSelect(day)}
                                    style={{
                                        padding: '10px 4px',
                                        border: 'none',
                                        background: isSelected ? '#16a34a' : isToday ? '#dcfce7' : 'transparent',
                                        color: isSelected ? '#ffffff' : isToday ? '#16a34a' : '#111827',
                                        borderRadius: 8,
                                        cursor: 'pointer',
                                        fontSize: 14,
                                        fontWeight: isSelected ? 700 : isToday ? 600 : 400,
                                        transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isSelected && !isToday) {
                                            e.currentTarget.style.background = '#f3f4f6';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isSelected && !isToday) {
                                            e.currentTarget.style.background = 'transparent';
                                        } else if (isToday && !isSelected) {
                                            e.currentTarget.style.background = '#dcfce7';
                                        }
                                    }}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        type="button"
                        onClick={handleToday}
                        style={{
                            marginTop: 16,
                            width: '100%',
                            padding: '10px',
                            border: '1px solid #e5e7eb',
                            background: '#f9fafb',
                            borderRadius: 8,
                            cursor: 'pointer',
                            fontSize: 14,
                            fontWeight: 600,
                            color: '#111827',
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f3f4f6';
                            e.currentTarget.style.borderColor = '#d1d5db';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#f9fafb';
                            e.currentTarget.style.borderColor = '#e5e7eb';
                        }}
                    >
                        Today
                    </button>
                </div>
            )}
        </div>
    );
}

function DeleteConfirmationModal({ mart, onConfirm, onCancel }: { mart: Mart; onConfirm: () => void | Promise<void>; onCancel: () => void }) {
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    return (
        <div
            role="dialog"
            aria-modal="true"
            onClick={onCancel}
            style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,.45)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', zIndex: 70 }}
        >
            <div
                className="card"
                onClick={(e) => e.stopPropagation()}
                style={{ width: '100%', maxWidth: 480, padding: 0, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}
            >
                <div style={{ padding: 24 }}>
                    {/* Warning Icon */}
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                        <div style={{
                            width: 64,
                            height: 64,
                            borderRadius: '50%',
                            background: '#fef2f2',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <span style={{ fontSize: 32, color: '#ef4444' }}>⚠️</span>
                        </div>
                    </div>

                    {/* Title */}
                    <h3 style={{ margin: '0 0 12px 0', fontSize: 20, fontWeight: 700, color: 'var(--text)', textAlign: 'center' }}>
                        Delete Mart?
                    </h3>

                    {/* Warning Message */}
                    <p style={{ margin: '0 0 20px 0', fontSize: 14, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.6 }}>
                        Are you sure you want to delete this mart? This action cannot be undone.
                    </p>

                    {/* Mart Name Warning */}
                    <div style={{
                        padding: '12px 16px',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: 8,
                        marginBottom: 24,
                    }}>
                        <div style={{ fontSize: 11, color: '#991b1b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                            Mart Name
                        </div>
                        <div style={{ fontSize: 16, color: '#7f1d1d', fontWeight: 600 }}>
                            {mart.name}
                        </div>
                        {mart.mobile && (
                            <div style={{ fontSize: 12, color: '#991b1b', marginTop: 4 }}>
                                Mobile: {mart.mobile}
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: 12 }}>
                        <button
                            type="button"
                            onClick={onCancel}
                            style={{
                                flex: 1,
                                padding: '10px 20px',
                                border: '1px solid var(--border)',
                                borderRadius: 8,
                                background: 'var(--bg)',
                                color: 'var(--text)',
                                fontSize: 14,
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'var(--bg-elev)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'var(--bg)';
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            style={{
                                flex: 1,
                                padding: '10px 20px',
                                border: 'none',
                                borderRadius: 8,
                                background: '#ef4444',
                                color: '#ffffff',
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#dc2626';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#ef4444';
                            }}
                        >
                            Delete Mart
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MartDetailsModal({ mart, orders, onClose, onMartUpdate }: { mart: Mart; orders: Order[]; onClose: () => void; onMartUpdate?: () => void }) {
    const [salesExpanded, setSalesExpanded] = useState(false);
    const [refillExpanded, setRefillExpanded] = useState(false);
    const [showAddSales, setShowAddSales] = useState(false);
    const [showAddRefill, setShowAddRefill] = useState(false);

    // Get sales from mart data
    const sales = useMemo(() => {
        return (mart.sales || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [mart.sales]);

    // Get refills from mart data
    const refills = useMemo(() => {
        return (mart.refills || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [mart.refills]);

    const totalSalesAmount = sales.reduce((sum, s) => sum + s.totalAmount, 0);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    return (
        <div
            role="dialog"
            aria-modal="true"
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,.45)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', zIndex: 60 }}
        >
            <div
                className="card"
                onClick={(e) => e.stopPropagation()}
                style={{ width: '100%', maxWidth: 1200, padding: 0, boxShadow: '0 20px 60px rgba(0,0,0,.25)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottom: '1px solid var(--border)' }}>
                    <h3 style={{ margin: 0 }}>Mart Details</h3>
                    <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
                </div>
                
                <div style={{ padding: 20, overflow: 'auto', flex: 1 }}>
                    {/* Mart Information and Stock Available in one row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
                        {/* Mart Information */}
                        <div style={{ padding: 16, background: 'var(--bg-elev)', borderRadius: 8, border: '1px solid var(--border)' }}>
                            <h4 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Mart Information</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {/* First Row: Name, Mobile, Onboarding Date, and Commission */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
                                    <div>
                                        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Mart Name</div>
                                        <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{mart.name}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Mobile</div>
                                        <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>
                                            <a className="link" href={`tel:${mart.mobile}`} style={{ textDecoration: 'none' }}>{mart.mobile}</a>
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Onboarding Date</div>
                                        <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{formatDate(mart.date)}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Commission</div>
                                        <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{mart.commission !== undefined ? `${mart.commission}%` : '—'}</div>
                                    </div>
                                </div>
                                {/* Second Row: Address (full width) */}
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Address</div>
                                    <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{mart.address}</div>
                                </div>
                                {/* Third Row: Sector */}
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Sector</div>
                                    <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{mart.sector}</div>
                                </div>
                            </div>
                        </div>

                        {/* Stock Available Section */}
                        <div style={{ padding: 16, background: 'var(--bg-elev)', borderRadius: 8, border: '1px solid var(--border)' }}>
                            <h4 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Stock Available</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {(() => {
                                    const qty = mart.quantities || {};
                                    const tags = [];
                                    
                                    // Gir Cow
                                    const gir500 = qty.gir500 || 0;
                                    const gir1 = qty.gir1 || 0;
                                    if (gir500 > 0 || gir1 > 0) {
                                        const parts = [];
                                        if (gir500 > 0) parts.push(`500ml: ${gir500}`);
                                        if (gir1 > 0) parts.push(`1ltr: ${gir1}`);
                                        tags.push({ label: 'Gir Cow', value: parts.join(', ') });
                                    }
                                    
                                    // Desi Cow
                                    const desi500 = qty.desi500 || 0;
                                    const desi1 = qty.desi1 || 0;
                                    if (desi500 > 0 || desi1 > 0) {
                                        const parts = [];
                                        if (desi500 > 0) parts.push(`500ml: ${desi500}`);
                                        if (desi1 > 0) parts.push(`1ltr: ${desi1}`);
                                        tags.push({ label: 'Desi Cow', value: parts.join(', ') });
                                    }
                                    
                                    // Buffalo
                                    const buffalo500 = qty.buffalo500 || 0;
                                    const buffalo1 = qty.buffalo1 || 0;
                                    if (buffalo500 > 0 || buffalo1 > 0) {
                                        const parts = [];
                                        if (buffalo500 > 0) parts.push(`500ml: ${buffalo500}`);
                                        if (buffalo1 > 0) parts.push(`1ltr: ${buffalo1}`);
                                        tags.push({ label: 'Buffalo', value: parts.join(', ') });
                                    }
                                    
                                    return tags.length > 0 ? tags.map((tag, tagIdx) => (
                                        <div
                                            key={tagIdx}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                padding: '10px 12px',
                                                borderRadius: 8,
                                                fontSize: 13,
                                                fontWeight: 600,
                                                background: 'linear-gradient(135deg, var(--bg-elev) 0%, rgba(22, 163, 74, 0.1) 100%)',
                                                border: '1px solid rgba(22, 163, 74, 0.25)',
                                                color: 'var(--text)',
                                                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                                            }}
                                        >
                                            <span style={{ fontWeight: 700, marginRight: 6, color: '#166534' }}>{tag.label}:</span>
                                            <span style={{ color: 'var(--muted)' }}>{tag.value}</span>
                                        </div>
                                    )) : (
                                        <div style={{ color: 'var(--muted)', fontSize: 14, fontStyle: 'italic' }}>No stock available</div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>

                    {/* Sales Data Accordion */}
                    <div style={{ marginBottom: 16, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-elev)', borderBottom: salesExpanded ? '1px solid var(--border)' : 'none' }}>
                            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)', flex: 1 }}>Sales Data</h4>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowAddSales(true);
                                }}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '6px 14px',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: '#ffffff',
                                    background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                                    border: 'none',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                                    marginRight: 20,
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'linear-gradient(135deg, #15803d 0%, #166534 100%)';
                                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)';
                                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
                                }}
                            >
                                + Add
                            </button>
                            <button
                                type="button"
                                onClick={() => setSalesExpanded(!salesExpanded)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                }}
                            >
                                <span style={{ fontSize: 18, color: 'var(--muted)', transition: 'transform 0.2s', transform: salesExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                    ▼
                                </span>
                            </button>
                        </div>
                        {salesExpanded && (
                            <div className="table-scroll-wrapper" style={{ maxHeight: '300px', overflow: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                                    <thead>
                                        <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10 }}>
                                            <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Date</th>
                                            <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Products</th>
                                            <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Total Amount</th>
                                            <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Status</th>
                                            <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Amount Received</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sales.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                                                    No sales data found
                                                </td>
                                            </tr>
                                        ) : (
                                            sales.map((sale) => (
                                                <tr key={sale.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                    <td style={{ padding: '12px', fontSize: 13 }}>{formatDate(sale.date)}</td>
                                                    <td style={{ padding: '12px', fontSize: 13 }}>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                            {(() => {
                                                                const qty = sale.quantities || {};
                                                                const tags = [];
                                                                
                                                                // Gir Cow
                                                                const gir500 = qty.gir500 || 0;
                                                                const gir1 = qty.gir1 || 0;
                                                                if (gir500 > 0 || gir1 > 0) {
                                                                    const parts = [];
                                                                    if (gir500 > 0) parts.push(`500ml: ${gir500}`);
                                                                    if (gir1 > 0) parts.push(`1ltr: ${gir1}`);
                                                                    tags.push({ label: 'Gir Cow', value: parts.join(', ') });
                                                                }
                                                                
                                                                // Desi Cow
                                                                const desi500 = qty.desi500 || 0;
                                                                const desi1 = qty.desi1 || 0;
                                                                if (desi500 > 0 || desi1 > 0) {
                                                                    const parts = [];
                                                                    if (desi500 > 0) parts.push(`500ml: ${desi500}`);
                                                                    if (desi1 > 0) parts.push(`1ltr: ${desi1}`);
                                                                    tags.push({ label: 'Desi Cow', value: parts.join(', ') });
                                                                }
                                                                
                                                                // Buffalo
                                                                const buffalo500 = qty.buffalo500 || 0;
                                                                const buffalo1 = qty.buffalo1 || 0;
                                                                if (buffalo500 > 0 || buffalo1 > 0) {
                                                                    const parts = [];
                                                                    if (buffalo500 > 0) parts.push(`500ml: ${buffalo500}`);
                                                                    if (buffalo1 > 0) parts.push(`1ltr: ${buffalo1}`);
                                                                    tags.push({ label: 'Buffalo', value: parts.join(', ') });
                                                                }
                                                                
                                                                return tags.length > 0 ? tags.map((tag, tagIdx) => (
                                                                    <span
                                                                        key={tagIdx}
                                                                        style={{
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            padding: '6px 12px',
                                                                            borderRadius: 16,
                                                                            fontSize: 11,
                                                                            fontWeight: 600,
                                                                            background: 'linear-gradient(135deg, var(--bg-elev) 0%, rgba(22, 163, 74, 0.08) 100%)',
                                                                            border: '1px solid rgba(22, 163, 74, 0.2)',
                                                                            color: 'var(--text)',
                                                                            whiteSpace: 'nowrap',
                                                                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                                                                        }}
                                                                    >
                                                                        <span style={{ fontWeight: 700, marginRight: 4 }}>{tag.label}:</span>
                                                                        <span style={{ color: 'var(--muted)' }}>{tag.value}</span>
                                                                    </span>
                                                                )) : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>;
                                                            })()}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px', fontSize: 13, fontWeight: 600 }}>{formatCurrency(sale.totalAmount)}</td>
                                                    <td style={{ padding: '12px', fontSize: 13 }}>
                                                        <select
                                                            value={sale.status}
                                                            onChange={async (e) => {
                                                                const newStatus = e.target.value as 'Paid' | 'Partial Paid' | 'Pending';
                                                                const updatedSales = sales.map(s => 
                                                                    s.id === sale.id ? { ...s, status: newStatus } : s
                                                                );
                                                                const updatedMart: Mart = { ...mart, sales: updatedSales };
                                                                try {
                                                                    await updateGurugramMart(updatedMart);
                                                                    if (onMartUpdate) onMartUpdate();
                                                                } catch (err) {
                                                                    console.error('Failed to update sale status:', err);
                                                                    alert('Failed to update status. Please try again.');
                                                                }
                                                            }}
                                                            style={{
                                                                padding: '6px 10px',
                                                                borderRadius: 6,
                                                                border: '1px solid var(--border)',
                                                                background: 'var(--bg)',
                                                                color: 'var(--text)',
                                                                fontSize: 13,
                                                                cursor: 'pointer',
                                                                minWidth: 120,
                                                            }}
                                                        >
                                                            <option value="Paid">Paid</option>
                                                            <option value="Partial Paid">Partial Paid</option>
                                                            <option value="Pending">Pending</option>
                                                        </select>
                                                    </td>
                                                    <td style={{ padding: '12px', fontSize: 13 }}>
                                                        <input
                                                            type="number"
                                                            value={sale.amountReceived}
                                                            onChange={async (e) => {
                                                                const newAmount = parseFloat(e.target.value) || 0;
                                                                const updatedSales = sales.map(s => 
                                                                    s.id === sale.id ? { ...s, amountReceived: newAmount } : s
                                                                );
                                                                const updatedMart: Mart = { ...mart, sales: updatedSales };
                                                                try {
                                                                    await updateGurugramMart(updatedMart);
                                                                    if (onMartUpdate) onMartUpdate();
                                                                } catch (err) {
                                                                    console.error('Failed to update amount received:', err);
                                                                    alert('Failed to update amount. Please try again.');
                                                                }
                                                            }}
                                                            style={{
                                                                padding: '6px 10px',
                                                                borderRadius: 6,
                                                                border: '1px solid var(--border)',
                                                                background: 'var(--bg)',
                                                                color: 'var(--text)',
                                                                fontSize: 13,
                                                                width: 120,
                                                            }}
                                                        />
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Refill Data Accordion */}
                    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-elev)', borderBottom: refillExpanded ? '1px solid var(--border)' : 'none' }}>
                            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)', flex: 1 }}>Refill Data</h4>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowAddRefill(true);
                                }}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '6px 14px',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: '#ffffff',
                                    background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                                    border: 'none',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                                    marginRight: 20,
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'linear-gradient(135deg, #15803d 0%, #166534 100%)';
                                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)';
                                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
                                }}
                            >
                                + Add
                            </button>
                            <button
                                type="button"
                                onClick={() => setRefillExpanded(!refillExpanded)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                }}
                            >
                                <span style={{ fontSize: 18, color: 'var(--muted)', transition: 'transform 0.2s', transform: refillExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                    ▼
                                </span>
                            </button>
                        </div>
                        {refillExpanded && (
                            <div className="table-scroll-wrapper" style={{ maxHeight: '300px', overflow: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                                    <thead>
                                        <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10 }}>
                                            <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Date</th>
                                            <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Products</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {refills.length === 0 ? (
                                            <tr>
                                                <td colSpan={2} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                                                    No refill data found
                                                </td>
                                            </tr>
                                        ) : (
                                            refills.map((refill) => (
                                                <tr key={refill.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                    <td style={{ padding: '12px', fontSize: 13 }}>{formatDate(refill.date)}</td>
                                                    <td style={{ padding: '12px', fontSize: 13 }}>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                            {(() => {
                                                                const qty = refill.quantities || {};
                                                                const tags = [];
                                                                
                                                                // Gir Cow
                                                                const gir500 = qty.gir500 || 0;
                                                                const gir1 = qty.gir1 || 0;
                                                                if (gir500 > 0 || gir1 > 0) {
                                                                    const parts = [];
                                                                    if (gir500 > 0) parts.push(`500ml: ${gir500}`);
                                                                    if (gir1 > 0) parts.push(`1ltr: ${gir1}`);
                                                                    tags.push({ label: 'Gir Cow', value: parts.join(', ') });
                                                                }
                                                                
                                                                // Desi Cow
                                                                const desi500 = qty.desi500 || 0;
                                                                const desi1 = qty.desi1 || 0;
                                                                if (desi500 > 0 || desi1 > 0) {
                                                                    const parts = [];
                                                                    if (desi500 > 0) parts.push(`500ml: ${desi500}`);
                                                                    if (desi1 > 0) parts.push(`1ltr: ${desi1}`);
                                                                    tags.push({ label: 'Desi Cow', value: parts.join(', ') });
                                                                }
                                                                
                                                                // Buffalo
                                                                const buffalo500 = qty.buffalo500 || 0;
                                                                const buffalo1 = qty.buffalo1 || 0;
                                                                if (buffalo500 > 0 || buffalo1 > 0) {
                                                                    const parts = [];
                                                                    if (buffalo500 > 0) parts.push(`500ml: ${buffalo500}`);
                                                                    if (buffalo1 > 0) parts.push(`1ltr: ${buffalo1}`);
                                                                    tags.push({ label: 'Buffalo', value: parts.join(', ') });
                                                                }
                                                                
                                                                return tags.length > 0 ? tags.map((tag, tagIdx) => (
                                                                    <span
                                                                        key={tagIdx}
                                                                        style={{
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            padding: '6px 12px',
                                                                            borderRadius: 16,
                                                                            fontSize: 11,
                                                                            fontWeight: 600,
                                                                            background: 'linear-gradient(135deg, var(--bg-elev) 0%, rgba(22, 163, 74, 0.08) 100%)',
                                                                            border: '1px solid rgba(22, 163, 74, 0.2)',
                                                                            color: 'var(--text)',
                                                                            whiteSpace: 'nowrap',
                                                                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                                                                        }}
                                                                    >
                                                                        <span style={{ fontWeight: 700, marginRight: 4 }}>{tag.label}:</span>
                                                                        <span style={{ color: 'var(--muted)' }}>{tag.value}</span>
                                                                    </span>
                                                                )) : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>;
                                                            })()}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showAddSales && (
                <AddTransactionModal
                    type="sales"
                    mart={mart}
                    onClose={() => setShowAddSales(false)}
                    onSave={async (updatedMart) => {
                        setShowAddSales(false);
                        if (onMartUpdate) {
                            onMartUpdate();
                        }
                    }}
                />
            )}

            {showAddRefill && (
                <AddTransactionModal
                    type="refill"
                    mart={mart}
                    onClose={() => setShowAddRefill(false)}
                    onSave={async (updatedMart) => {
                        setShowAddRefill(false);
                        if (onMartUpdate) {
                            onMartUpdate();
                        }
                    }}
                />
            )}
        </div>
    );
}

function AddTransactionModal({ type, mart, onClose, onSave }: { type: 'sales' | 'refill'; mart: Mart; onClose: () => void; onSave: (updatedMart?: Mart) => void | Promise<void> }) {
    const [date, setDate] = useState(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    });
    const [orderId, setOrderId] = useState('');
    const [amount, setAmount] = useState('');
    const [paymentStatus, setPaymentStatus] = useState<'COD' | 'PAID'>('COD');
    const [deliveryStatus, setDeliveryStatus] = useState<'In Transit' | 'Delivered' | 'RTO' | 'Pending Pickup'>('Pending Pickup');
    const [refillQuantities, setRefillQuantities] = useState<Record<string, string>>({});
    const [salesQuantities, setSalesQuantities] = useState<Record<string, string>>({});
    const [totalAmount, setTotalAmount] = useState('');
    const [status, setStatus] = useState<'Paid' | 'Partial Paid' | 'Pending'>('Pending');
    const [amountReceived, setAmountReceived] = useState('');

    const products = [
        { key: 'gir500', label: 'Gir Cow - 500ml', name: 'A2 Gir Cow Ghee', size: '500 ml', price: 900 },
        { key: 'gir1', label: 'Gir Cow - 1 ltr', name: 'A2 Gir Cow Ghee', size: '1000 ml', price: 1720 },
        { key: 'desi500', label: 'Desi Cow - 500ml', name: 'A2 Desi Cow Ghee', size: '500 ml', price: 710 },
        { key: 'desi1', label: 'Desi Cow - 1 ltr', name: 'A2 Desi Cow Ghee', size: '1000 ml', price: 1350 },
        { key: 'buffalo500', label: 'Buffalo - 500ml', name: 'A2 Buffalo Ghee', size: '500 ml', price: 650 },
        { key: 'buffalo1', label: 'Buffalo - 1 ltr', name: 'A2 Buffalo Ghee', size: '1000 ml', price: 1250 },
    ];

    function getProductPrice(productKey: string): number | null {
        const product = products.find(p => p.key === productKey);
        return product?.price ?? null;
    }

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        
        if (type === 'refill') {
            try {
                // Create refill entry
                const refillEntry: RefillEntry = {
                    id: `REF-${Date.now()}`,
                    date: date,
                    quantities: {
                        gir500: refillQuantities.gir500 ? parseInt(refillQuantities.gir500) : undefined,
                        gir1: refillQuantities.gir1 ? parseInt(refillQuantities.gir1) : undefined,
                        desi500: refillQuantities.desi500 ? parseInt(refillQuantities.desi500) : undefined,
                        desi1: refillQuantities.desi1 ? parseInt(refillQuantities.desi1) : undefined,
                        buffalo500: refillQuantities.buffalo500 ? parseInt(refillQuantities.buffalo500) : undefined,
                        buffalo1: refillQuantities.buffalo1 ? parseInt(refillQuantities.buffalo1) : undefined,
                    },
                };

                // Update mart quantities by adding refill quantities
                const updatedQuantities = { ...mart.quantities };
                Object.keys(refillEntry.quantities).forEach((key) => {
                    const qty = refillEntry.quantities[key as keyof typeof refillEntry.quantities];
                    if (qty !== undefined) {
                        updatedQuantities[key as keyof typeof updatedQuantities] = 
                            (updatedQuantities[key as keyof typeof updatedQuantities] || 0) + qty;
                    }
                });

                // Add refill to mart's refills array
                const updatedRefills = [...(mart.refills || []), refillEntry];

                // Update mart
                const updatedMart: Mart = {
                    ...mart,
                    quantities: updatedQuantities,
                    refills: updatedRefills,
                };

                // Save to server
                await updateGurugramMart(updatedMart);
                await onSave(updatedMart);
            } catch (err) {
                console.error('Failed to save refill:', err);
                alert('Failed to save refill. Please try again.');
            }
        } else {
            // Sales transaction logic
            try {
                // Create sales entry
                const salesEntry: SalesEntry = {
                    id: `SAL-${Date.now()}`,
                    date: date,
                    quantities: {
                        gir500: salesQuantities.gir500 ? parseInt(salesQuantities.gir500) : undefined,
                        gir1: salesQuantities.gir1 ? parseInt(salesQuantities.gir1) : undefined,
                        desi500: salesQuantities.desi500 ? parseInt(salesQuantities.desi500) : undefined,
                        desi1: salesQuantities.desi1 ? parseInt(salesQuantities.desi1) : undefined,
                        buffalo500: salesQuantities.buffalo500 ? parseInt(salesQuantities.buffalo500) : undefined,
                        buffalo1: salesQuantities.buffalo1 ? parseInt(salesQuantities.buffalo1) : undefined,
                    },
                    totalAmount: parseFloat(totalAmount) || 0,
                    status: status,
                    amountReceived: parseFloat(amountReceived) || 0,
                };

                // Update mart quantities by subtracting sales quantities
                const updatedQuantities = { ...mart.quantities };
                Object.keys(salesEntry.quantities).forEach((key) => {
                    const qty = salesEntry.quantities[key as keyof typeof salesEntry.quantities];
                    if (qty !== undefined) {
                        updatedQuantities[key as keyof typeof updatedQuantities] = 
                            Math.max(0, (updatedQuantities[key as keyof typeof updatedQuantities] || 0) - qty);
                    }
                });

                // Add sales to mart's sales array
                const updatedSales = [...(mart.sales || []), salesEntry];

                // Update mart
                const updatedMart: Mart = {
                    ...mart,
                    quantities: updatedQuantities,
                    sales: updatedSales,
                };

                // Save to server
                await updateGurugramMart(updatedMart);
                await onSave(updatedMart);
            } catch (err) {
                console.error('Failed to save sales:', err);
                alert('Failed to save sales. Please try again.');
            }
        }
    }

    return (
        <div
            role="dialog"
            aria-modal="true"
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,.45)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', zIndex: 70 }}
        >
            <div
                className="card"
                onClick={(e) => e.stopPropagation()}
                style={{ width: '100%', maxWidth: 1000, padding: 0, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottom: '1px solid var(--border)' }}>
                    <h3 style={{ margin: 0 }}>Add {type === 'sales' ? 'Sales' : 'Refill'} Transaction</h3>
                    <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
                </div>
                <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 20, padding: 20 }}>
                    <div>
                        <label className="label">Date</label>
                        <DatePicker
                            value={date}
                            onChange={setDate}
                            placeholder="Select date"
                        />
                    </div>

                    {type === 'refill' ? (
                        // Refill: Show only products
                        <div>
                            <label className="label" style={{ marginBottom: 12 }}>Products</label>
                            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                                <div className="table-scroll-wrapper" style={{ maxHeight: '400px', overflow: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                                                <th
                                                    style={{
                                                        textAlign: 'left',
                                                        padding: '10px 12px',
                                                        fontSize: 12,
                                                        color: 'var(--muted)',
                                                        fontWeight: 700,
                                                        width: 110,
                                                    }}
                                                >
                                                    Product
                                                </th>
                                                <th
                                                    style={{
                                                        textAlign: 'left',
                                                        padding: '10px 12px',
                                                        fontSize: 12,
                                                        color: 'var(--muted)',
                                                        fontWeight: 700,
                                                        width: 100,
                                                    }}
                                                >
                                                    Price
                                                </th>
                                                <th
                                                    style={{
                                                        textAlign: 'left',
                                                        padding: '10px 12px',
                                                        fontSize: 12,
                                                        color: 'var(--muted)',
                                                        fontWeight: 700,
                                                        width: 100,
                                                    }}
                                                >
                                                    Current Stock
                                                </th>
                                                <th
                                                    style={{
                                                        textAlign: 'left',
                                                        padding: '10px 12px',
                                                        fontSize: 12,
                                                        color: 'var(--muted)',
                                                        fontWeight: 700,
                                                        width: 120,
                                                    }}
                                                >
                                                    Quantity
                                                </th>
                                                <th
                                                    style={{
                                                        textAlign: 'left',
                                                        padding: '10px 12px',
                                                        fontSize: 12,
                                                        color: 'var(--muted)',
                                                        fontWeight: 700,
                                                        width: 110,
                                                    }}
                                                >
                                                    Product
                                                </th>
                                                <th
                                                    style={{
                                                        textAlign: 'left',
                                                        padding: '10px 12px',
                                                        fontSize: 12,
                                                        color: 'var(--muted)',
                                                        fontWeight: 700,
                                                        width: 100,
                                                    }}
                                                >
                                                    Price
                                                </th>
                                                <th
                                                    style={{
                                                        textAlign: 'left',
                                                        padding: '10px 12px',
                                                        fontSize: 12,
                                                        color: 'var(--muted)',
                                                        fontWeight: 700,
                                                        width: 100,
                                                    }}
                                                >
                                                    Current Stock
                                                </th>
                                                <th
                                                    style={{
                                                        textAlign: 'left',
                                                        padding: '10px 12px',
                                                        fontSize: 12,
                                                        color: 'var(--muted)',
                                                        fontWeight: 700,
                                                        width: 120,
                                                    }}
                                                >
                                                    Quantity
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[
                                                [products[0], products[1]],
                                                [products[2], products[3]],
                                                [products[4], products[5]],
                                            ].map((pair, rowIdx) => (
                                                <tr
                                                    key={rowIdx}
                                                    style={{
                                                        borderBottom:
                                                            rowIdx === 2 ? 'none' : '1px solid var(--border)',
                                                    }}
                                                >
                                                    {pair.map((p, colIdx) =>
                                                        p ? (
                                                            <>
                                                                <td
                                                                    key={p.key + '-label'}
                                                                    style={{ padding: '10px 12px', fontSize: 12, width: 110 }}
                                                                >
                                                                    {p.label}
                                                                </td>
                                                                <td
                                                                    key={p.key + '-price'}
                                                                    style={{ padding: '10px 12px', fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}
                                                                >
                                                                    {getProductPrice(p.key) !== null ? `₹${getProductPrice(p.key)?.toLocaleString('en-IN')}` : '—'}
                                                                </td>
                                                                <td
                                                                    key={p.key + '-stock'}
                                                                    style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text)', fontWeight: 500 }}
                                                                >
                                                                    {mart.quantities?.[p.key as keyof typeof mart.quantities] || 0}
                                                                </td>
                                                                <td
                                                                    key={p.key + '-input'}
                                                                    style={{ padding: '10px 12px', width: 120 }}
                                                                >
                                                                    <input
                                                                        type="number"
                                                                        min={0}
                                                                        className="input"
                                                                        value={refillQuantities[p.key] ?? ''}
                                                                        onChange={(e) => {
                                                                            const value = e.target.value;
                                                                            setRefillQuantities((prev) => ({
                                                                                ...prev,
                                                                                [p.key]: value,
                                                                            }));
                                                                        }}
                                                                        placeholder="0"
                                                                        style={{ width: '100%', height: 32 }}
                                                                    />
                                                                </td>
                                                            </>
                                                        ) : (
                                                            <td key={'empty-' + colIdx} colSpan={4} />
                                                        )
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : (
                        // Sales: Show products, total amount, status, and amount received
                        <>
                            <div>
                                <label className="label" style={{ marginBottom: 12 }}>Products</label>
                                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                                    <div className="table-scroll-wrapper" style={{ maxHeight: '400px', overflow: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                                                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700, width: 110 }}>Product</th>
                                                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700, width: 100 }}>Price</th>
                                                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700, width: 100 }}>Current Stock</th>
                                                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700, width: 120 }}>Quantity</th>
                                                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700, width: 110 }}>Product</th>
                                                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700, width: 100 }}>Price</th>
                                                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700, width: 100 }}>Current Stock</th>
                                                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700, width: 120 }}>Quantity</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {[
                                                    [products[0], products[1]],
                                                    [products[2], products[3]],
                                                    [products[4], products[5]],
                                                ].map((pair, rowIdx) => (
                                                    <tr key={rowIdx} style={{ borderBottom: rowIdx === 2 ? 'none' : '1px solid var(--border)' }}>
                                                        {pair.map((p, colIdx) =>
                                                            p ? (
                                                                <>
                                                                    <td key={p.key + '-label'} style={{ padding: '10px 12px', fontSize: 12, width: 110 }}>{p.label}</td>
                                                                    <td key={p.key + '-price'} style={{ padding: '10px 12px', fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>
                                                                        {getProductPrice(p.key) !== null ? `₹${getProductPrice(p.key)?.toLocaleString('en-IN')}` : '—'}
                                                                    </td>
                                                                    <td key={p.key + '-stock'} style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                                                                        {mart.quantities?.[p.key as keyof typeof mart.quantities] || 0}
                                                                    </td>
                                                                    <td key={p.key + '-input'} style={{ padding: '10px 12px', width: 120 }}>
                                                                        <input
                                                                            type="number"
                                                                            min={0}
                                                                            className="input"
                                                                            value={salesQuantities[p.key] ?? ''}
                                                                            onChange={(e) => {
                                                                                const value = e.target.value;
                                                                                setSalesQuantities((prev) => {
                                                                                    const newQuantities = { ...prev, [p.key]: value };
                                                                                    // Calculate total amount
                                                                                    let total = 0;
                                                                                    Object.keys(newQuantities).forEach((key) => {
                                                                                        const qty = parseInt(newQuantities[key] || '0');
                                                                                        const price = getProductPrice(key);
                                                                                        if (qty > 0 && price !== null) {
                                                                                            total += qty * price;
                                                                                        }
                                                                                    });
                                                                                    const totalStr = total.toString();
                                                                                    setTotalAmount(totalStr);
                                                                                    // If status is Paid, update amount received too
                                                                                    if (status === 'Paid') {
                                                                                        setAmountReceived(totalStr);
                                                                                    }
                                                                                    return newQuantities;
                                                                                });
                                                                            }}
                                                                            placeholder="0"
                                                                            style={{ width: '100%', height: 32 }}
                                                                        />
                                                                    </td>
                                                                </>
                                                            ) : (
                                                                <td key={'empty-' + colIdx} colSpan={4} />
                                                            )
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="label">Total Amount</label>
                                <input
                                    className="input"
                                    style={{ width: '100%', marginTop: 6 }}
                                    type="number"
                                    value={totalAmount}
                                    disabled
                                    placeholder="Auto-calculated"
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
                                <div>
                                    <label className="label">Status</label>
                                    <select
                                        className="input"
                                        style={{ width: '100%', marginTop: 6 }}
                                        value={status}
                                        onChange={(e) => {
                                            const newStatus = e.target.value as 'Paid' | 'Partial Paid' | 'Pending';
                                            setStatus(newStatus);
                                            // Auto-populate Amount Received with Total Amount if status is Paid
                                            if (newStatus === 'Paid' && totalAmount) {
                                                setAmountReceived(totalAmount);
                                            }
                                        }}
                                        required
                                    >
                                        <option value="Pending">Pending</option>
                                        <option value="Partial Paid">Partial Paid</option>
                                        <option value="Paid">Paid</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Amount Received</label>
                                    <input
                                        className="input"
                                        style={{ width: '100%', marginTop: 6 }}
                                        type="number"
                                        value={amountReceived}
                                        onChange={(e) => setAmountReceived(e.target.value)}
                                        placeholder="Enter amount received"
                                        required
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                        <button type="button" className="button button--ghost" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="button">
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
