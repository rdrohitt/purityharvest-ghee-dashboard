import { useEffect, useMemo, useRef, useState } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, LineElement, BarElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend } from 'chart.js';
import { DateRange, RangeKey, generateMockData, getPresetRange, sum, getMonthRange, monthLabel } from '../utils/metrics';

ChartJS.register(LineElement, BarElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend);

function formatCurrency(n: number): string { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n); }

export default function Dashboard() {
	const [rangeKey, setRangeKey] = useState<RangeKey>('today');
	const [custom, setCustom] = useState<DateRange>({ start: new Date(), end: new Date() });
	const [showCustom, setShowCustom] = useState(false);
	const customBtnRef = useRef<HTMLButtonElement | null>(null);
	const popoverRef = useRef<HTMLDivElement | null>(null);

	const range = useMemo(() => (rangeKey === 'custom' ? custom : getPresetRange(rangeKey as Exclude<RangeKey, 'custom'>)), [rangeKey, custom]);
	const data = useMemo(() => generateMockData(range), [range]);
	const totals = useMemo(() => sum(data), [data]);

	const labels = data.map((d) => d.date);
	// Build last 6 months sales totals
	const months = Array.from({ length: 6 }, (_, i) => 5 - i);
	const monthLabels = months.map((m) => monthLabel(m));
	const monthAgg = months.map((m) => sum(generateMockData(getMonthRange(m))));
	const monthSales = monthAgg.map((t) => t.salesAmount);
	const monthDelivered = monthAgg.map((t) => t.deliveredAmount);
	const monthRto = monthAgg.map((t) => t.rtoAmount);
	const lastSixMonthsBar = {
		labels: monthLabels,
		datasets: [
			{ label: 'Sales', data: monthSales, backgroundColor: '#3b82f6' },
			{ label: 'Delivered', data: monthDelivered, backgroundColor: '#10b981' },
			{ label: 'RTO', data: monthRto, backgroundColor: '#f59e0b' },
		],
	};

	const barData = {
		labels: ['Sales', 'Delivered', 'In Transit', 'RTO'],
		datasets: [
			{ label: 'Count', data: [totals.salesCount, totals.deliveredCount, totals.inTransitCount, totals.rtoCount], backgroundColor: ['#3b82f6', '#10b981', '#60a5fa', '#f59e0b'] }
		]
	};

	// Build Top 10 performing customers (mock) responsive to date range
	const topCustomers = useMemo(() => {
		const seedBase = labels.join('|').length + data.length;
		function seeded(n: number) { return (Math.sin(seedBase + n) + 1) / 2; }
		const names = [
			'Aarav Sharma', 'Isha Gupta', 'Rohit Verma', 'Neha Singh', 'Karan Mehta',
			'Pooja Rao', 'Aarav Patel', 'Sana Khan', 'Vikram Joshi', 'Anita Desai',
			'Harsh Malhotra', 'Divya Nair', 'Ritika Kapoor', 'Aman Soni', 'Meera Jain'
		];
		const customers = names.map((name, i) => {
			const orders = Math.max(1, Math.round(seeded(i + 1) * (data.length * 1.2)));
			const avg = 499 + Math.round(seeded(i + 2) * 1500);
			const revenue = orders * avg;
			const phone = `9${String(Math.floor(seeded(i + 3) * 1000000000)).padStart(9, '0')}`;
			return { name, phone, orders, revenue };
		});
		return customers.sort((a, b) => b.revenue - a.revenue).slice(0, 10);
	}, [labels, data]);

	function onDateChange(e: React.ChangeEvent<HTMLInputElement>, which: 'start' | 'end') {
		const value = e.target.value;
		const next = new Date(value);
		setCustom((prev) => ({ ...prev, [which]: next }));
	}

	useEffect(() => {
		function onDocClick(e: MouseEvent) {
			if (!showCustom) return;
			const target = e.target as Node;
			if (popoverRef.current && popoverRef.current.contains(target)) return;
			if (customBtnRef.current && customBtnRef.current.contains(target as Node)) return;
			setShowCustom(false);
		}
		document.addEventListener('click', onDocClick);
		return () => document.removeEventListener('click', onDocClick);
	}, [showCustom]);

	return (
		<div className="page">
			<div className="card" style={{ marginBottom: 16, position: 'sticky', top: 64, zIndex: 5 }}>
				<div className="filter-group" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
					<RangeButton current={rangeKey} onClick={() => { setRangeKey('today'); setShowCustom(false); }} id="today">Today</RangeButton>
					<RangeButton current={rangeKey} onClick={() => { setRangeKey('yesterday'); setShowCustom(false); }} id="yesterday">Yesterday</RangeButton>
					<RangeButton current={rangeKey} onClick={() => { setRangeKey('last7'); setShowCustom(false); }} id="last7">Last 7 days</RangeButton>
					<RangeButton current={rangeKey} onClick={() => { setRangeKey('last30'); setShowCustom(false); }} id="last30">Last 30 days</RangeButton>
					<RangeButton
						refEl={customBtnRef}
						current={rangeKey}
						onClick={() => {
							setRangeKey('custom');
							setShowCustom((v) => !v);
						}}
						id="custom"
					>Custom</RangeButton>
				</div>

				{showCustom ? (
					<div
						ref={popoverRef}
						className="date-range-popover"
						style={{
							position: 'absolute',
							top: 56,
							left: customBtnRef.current ? customBtnRef.current.offsetLeft : 0,
						}}
					>
						<div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 4 }}>
							<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
								<label className="label" style={{ fontSize: 12, margin: 0 }}>Start</label>
								<input className="input" type="date" value={toInputDate(custom.start)} onChange={(e) => onDateChange(e, 'start')} style={{ height: 36 }} />
							</div>
							<span style={{ color: 'var(--muted)' }}>—</span>
							<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
								<label className="label" style={{ fontSize: 12, margin: 0 }}>End</label>
								<input className="input" type="date" value={toInputDate(custom.end)} onChange={(e) => onDateChange(e, 'end')} style={{ height: 36 }} />
							</div>
							<button className="button" style={{ width: 'auto', padding: '0 16px', height: 36 }} onClick={() => setShowCustom(false)}>Apply</button>
						</div>
					</div>
				) : null}
			</div>

			{/* Product-wise KPIs - Compact Design */}
			<div className="card" style={{ padding: '16px', marginBottom: 12 }}>
				<h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Sales from Delivered Orders - All Channels</h3>
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
					{Object.entries(totals.productSales).map(([productName, data]) => (
						<ProductKPI key={productName} productName={productName} count={data.count} amount={data.amount} />
					))}
				</div>
			</div>

			{/* Summary KPIs - Compact Row */}
			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
				<CompactMetricCard title="Total Sales" count={totals.salesCount} amount={totals.salesAmount} color="var(--primary)" />
				<CompactMetricCard title="Delivered" count={totals.deliveredCount} amount={totals.deliveredAmount} color="#10b981" />
				<CompactMetricCard title="In Transit" count={totals.inTransitCount} amount={totals.inTransitAmount} color="#60a5fa" />
				<CompactMetricCard title="RTO" count={totals.rtoCount} amount={totals.rtoAmount} color="#f59e0b" />
				<CompactMetricCard title="Shipping" count={0} amount={Math.round(totals.salesAmount * 0.05)} color="#60a5fa" />
				<CompactMetricCard title="aSpend" count={0} amount={Math.round(totals.salesAmount * 0.22)} color="#ef4444" />
			</div>

			<div className="card" style={{ marginTop: 12 }}>
				<h3 style={{ marginTop: 0 }}>Last 6 Months Sales</h3>
				<Bar data={lastSixMonthsBar} options={{ responsive: true, plugins: { legend: { display: true, position: 'bottom' } }, scales: { y: { ticks: { callback: (v) => formatCurrency(Number(v)).replace('₹', '') } } } }} />
			</div>

			<div className="card" style={{ marginTop: 12, padding: 0 }}>
				<h3 style={{ margin: '16px 16px 0 16px' }}>Top 10 Performing Customers</h3>
				<div style={{ overflowX: 'auto', marginTop: 8 }}>
					<table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
						<thead>
							<tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
								<th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)' }}>Name</th>
								<th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)' }}>Phone</th>
								<th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 12, color: 'var(--muted)' }}>Total Revenue</th>
								<th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 12, color: 'var(--muted)' }}>Total Orders</th>
							</tr>
						</thead>
						<tbody>
							{topCustomers.map((c) => (
								<tr key={c.phone} style={{ borderBottom: '1px solid var(--border)' }}>
									<td style={{ padding: '12px' }}>{c.name}</td>
									<td style={{ padding: '12px' }}><a className="link" href={`tel:${c.phone}`}>{c.phone}</a></td>
									<td style={{ padding: '12px', textAlign: 'right' }}>{formatCurrency(c.revenue)}</td>
									<td style={{ padding: '12px', textAlign: 'right' }}>{c.orders.toLocaleString()}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}

function MetricCard({ title, count, amount, color }: { title: string; count: number; amount: number; color: string }) {
	const showLtr = title !== 'Shipping' && title !== 'Marketing Spend';
	return (
		<div className="card" style={{ borderColor: 'var(--border)' }}>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
				<div style={{ fontSize: 14, color: 'var(--muted)' }}>{title}</div>
				<div style={{ fontWeight: 700, color }}>
					{count.toLocaleString()}
					{showLtr ? <em style={{ fontSize: '0.85em', color: 'var(--muted)', fontWeight: 400, marginLeft: '4px' }}>ltr</em> : ''}
				</div>
			</div>
			<div style={{ marginTop: 6, fontSize: 18, fontWeight: 800 }}>{formatCurrency(amount)}</div>
		</div>
	);
}

function CompactMetricCard({ title, count, amount, color }: { title: string; count: number; amount: number; color: string }) {
	const hideCount = title === 'Shipping' || title === 'Marketing Spend';
	return (
		<div style={{ 
			background: 'var(--bg)', 
			border: '1px solid var(--border)', 
			borderRadius: 8, 
			padding: '12px',
			display: 'flex',
			flexDirection: 'column',
			gap: 6
		}}>
			<div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
				{title}
			</div>
			{!hideCount ? (
				<div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
					<div style={{ fontSize: 16, fontWeight: 700, color }}>
						{count.toLocaleString()}
					</div>
				</div>
			) : null}
			<div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{formatCurrency(amount)}</div>
		</div>
	);
}

function getProductIcon(productName: string): string {
	const icons: Record<string, string> = {
		'Ghee': '🧈',
		'Honey': '🍯',
		'Grocery': '🛒',
		'Oils': '🫒',
		'Vermicompost': '🌱',
	};
	return icons[productName] || '📦';
}

function ProductKPI({ productName, count, amount }: { productName: string; count: number; amount: number }) {
	const unit = productName === 'Grocery' ? 'pcs' : 'ltr';
	return (
		<div style={{ 
			background: 'var(--bg)', 
			border: '1px solid var(--border)', 
			borderRadius: 8, 
			padding: '12px',
			display: 'flex',
			flexDirection: 'column',
			gap: 8
		}}>
			<div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, lineHeight: 1.4, display: 'flex', alignItems: 'center', gap: 6 }}>
				<span style={{ fontSize: 16 }}>{getProductIcon(productName)}</span>
				<span>{productName}</span>
			</div>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
					<div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Qty</div>
					<div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>
						{count.toLocaleString()}<em style={{ fontSize: '0.75em', color: 'var(--muted)', fontWeight: 400, marginLeft: '3px', fontStyle: 'italic' }}>{unit}</em>
					</div>
				</div>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
					<div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Revenue</div>
					<div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{formatCurrency(amount)}</div>
				</div>
			</div>
		</div>
	);
}

function RangeButton({ children, onClick, current, id, refEl }: { children: string; onClick: () => void; current: string; id: string; refEl?: React.MutableRefObject<HTMLButtonElement | null> }) {
	const active = current === id;
	return (
		<button
			ref={refEl as any}
			onClick={onClick}
			className={`filter-btn ${active ? 'active' : ''}`}
		>
			{children}
		</button>
	);
}

function toInputDate(d: Date) {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}


