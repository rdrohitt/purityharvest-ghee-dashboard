import { useEffect, useMemo, useRef, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import type { ChartOptions, Plugin } from 'chart.js';
import type { AnalyticsOrderReportingResponse } from '../../types/analytics-order-reporting';
import type {
	TopPerformingCustomersResponse,
	TopPerformingCustomersType,
} from '../../types/analytics-top-performing-customers';
import {
	DateRange,
	RangeKey,
	TopCustomersRangeKey,
	getPresetRange,
	getTopCustomersPresetRange,
} from '../../utils/metrics';
import { fetchAnalyticsOrderReporting, fetchTopPerformingCustomers } from '../../utils/analytics';
import { mergeStateCountsForDisplay } from '../../utils/orderReportingStateMerge';
import { DatePicker } from '../sales/Shopify/DatePicker';
import { FilterButton, PlatformTag, StatusTag, toInputDate } from '../sales/Shopify/ShopifyShared';
import { mapDeliveryStatusFromTracking } from '../../utils/shopify-orders';
import '../sales/Shopify/Shopify.scss';
import './Dashboard.scss';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

/** Pixels reserved per category so many bars scroll horizontally instead of squashing. */
const ORDER_REPORT_BAR_SLOT_PX = 52;
const ORDER_REPORT_CHART_HEIGHT = 300;

function orderReportingVerticalBarOptions(): ChartOptions<'bar'> {
	return {
		responsive: true,
		maintainAspectRatio: false,
		layout: { padding: { top: 64 } },
		animation: {
			duration: 720,
			easing: 'easeOutQuart',
		},
		interaction: { intersect: false, mode: 'index' },
		plugins: {
			legend: { display: false },
			tooltip: {
				animation: { duration: 120 },
				callbacks: {
					label: (ctx) => {
						const n = typeof ctx.parsed.y === 'number' ? ctx.parsed.y : 0;
						return ` ${n.toLocaleString()} orders`;
					},
				},
			},
		},
		scales: {
			x: {
				grid: { display: false },
				ticks: {
					maxRotation: 55,
					minRotation: 0,
					autoSkip: false,
					font: { size: 10 },
				},
			},
			y: {
				beginAtZero: true,
				ticks: { precision: 0 },
				title: { display: true, text: 'Orders' },
				grid: { color: 'rgba(148, 163, 184, 0.22)' },
				border: { dash: [3, 3] },
			},
		},
	};
}

function orderReportingScrollWidth(labelCount: number): number {
	return Math.max(320, labelCount * ORDER_REPORT_BAR_SLOT_PX);
}

/** State + pincode order charts: counts on bars; hide Y labels, title, grid, and axis line. */
const ORDER_REPORTING_GEO_BAR_OPTIONS = ((): ChartOptions<'bar'> => {
	const base = orderReportingVerticalBarOptions();
	return {
		...base,
		scales: {
			...base.scales,
			y: {
				...base.scales?.y,
				beginAtZero: true,
				ticks: { precision: 0, display: false },
				title: { display: false },
				grid: { display: false },
				border: { display: false },
			},
		},
	};
})();

function formatCurrency(n: number): string { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n); }
function formatPhone(countryCode: string, phoneNumber: string): string {
	const code = countryCode?.trim() || '';
	const phone = phoneNumber?.trim() || '';
	if (!phone) return '—';
	return code ? `${code} ${phone}` : phone;
}
function formatLastOrderDate(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '—';
	return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatCompactCurrency(n: number): string {
	return new Intl.NumberFormat('en-IN', {
		style: 'currency',
		currency: 'INR',
		notation: 'compact',
		maximumFractionDigits: 1,
	}).format(n);
}
function toFiniteNumber(v: unknown): number {
	const n = typeof v === 'number' ? v : Number(v);
	return Number.isFinite(n) ? n : 0;
}
function topLabelSet<T>(rows: T[], valueOf: (row: T) => number, labelOf: (row: T) => string, topN = 5): Set<string> {
	return new Set(
		[...rows]
			.sort((a, b) => valueOf(b) - valueOf(a))
			.slice(0, topN)
			.map((row) => labelOf(row)),
	);
}

const geoDualValueLabelsPlugin: Plugin<'bar'> = {
	id: 'geoDualValueLabels',
	afterDatasetsDraw(chart) {
		const { ctx, chartArea } = chart;
		const fill =
			typeof chart.options.color === 'string' && chart.options.color
				? chart.options.color
				: '#64748b';
		for (let dsIndex = 0; dsIndex < chart.data.datasets.length; dsIndex += 1) {
			const dataset = chart.data.datasets[dsIndex];
			const meta = chart.getDatasetMeta(dsIndex);
			if (!meta.visible) continue;
			meta.data.forEach((element, i) => {
				const raw = dataset.data[i];
				const n = typeof raw === 'number' ? raw : Number(raw);
				if (!Number.isFinite(n)) return;
				const { x, y } = element.getProps(['x', 'y'], true);
				const labelY = Math.max(chartArea.top + 8, y - 8);
				const isRevenue = dataset.label === 'Revenue';
				const text = isRevenue ? formatCompactCurrency(n) : n.toLocaleString();
				ctx.save();
				ctx.fillStyle = fill;
				ctx.font = isRevenue ? '700 10px system-ui, -apple-system, sans-serif' : '700 11px system-ui, -apple-system, sans-serif';
				ctx.textAlign = 'left';
				ctx.textBaseline = 'middle';
				ctx.translate(x, labelY);
				ctx.rotate(-Math.PI / 2);
				ctx.fillText(text, 0, 0);
				ctx.restore();
			});
		}
	},
};

/** Local calendar date from `YYYY-MM-DD` (matches DatePicker / toInputDate). */
function dateFromInputString(iso: string): Date {
	const [y, m, d] = iso.split('-').map((x) => parseInt(x, 10));
	if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return new Date();
	return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export default function Dashboard() {
	const [rangeKey, setRangeKey] = useState<RangeKey>('currentMonth');
	const [custom, setCustom] = useState<DateRange>({ start: new Date(), end: new Date() });
	const [showCustom, setShowCustom] = useState(false);
	const customBtnRef = useRef<HTMLButtonElement | null>(null);
	const popoverRef = useRef<HTMLDivElement | null>(null);

	const range = useMemo(() => (rangeKey === 'custom' ? custom : getPresetRange(rangeKey as Exclude<RangeKey, 'custom'>)), [rangeKey, custom]);
	const dateRangeForApi = useMemo(
		() => ({ from: toInputDate(range.start), to: toInputDate(range.end) }),
		[range.start, range.end],
	);
	const [orderReportLoading, setOrderReportLoading] = useState(false);
	const [orderReportError, setOrderReportError] = useState<string | null>(null);
	const [orderReport, setOrderReport] = useState<AnalyticsOrderReportingResponse | null>(null);

	const [topCustomersType, setTopCustomersType] = useState<TopPerformingCustomersType>('amount');
	const [topCustomersRangeKey, setTopCustomersRangeKey] = useState<TopCustomersRangeKey>('currentMonth');
	const [topCustomersAppliedCustom, setTopCustomersAppliedCustom] = useState<DateRange>(() =>
		getTopCustomersPresetRange('currentMonth'),
	);
	const [topCustomersCustomDraft, setTopCustomersCustomDraft] = useState<DateRange>(() =>
		getTopCustomersPresetRange('currentMonth'),
	);
	const [topCustomersShowCustom, setTopCustomersShowCustom] = useState(false);
	const topCustomersCustomBtnRef = useRef<HTMLButtonElement | null>(null);
	const topCustomersPopoverRef = useRef<HTMLDivElement | null>(null);
	const [topCustomersLoading, setTopCustomersLoading] = useState(false);
	const [topCustomersError, setTopCustomersError] = useState<string | null>(null);
	const [topCustomersData, setTopCustomersData] = useState<TopPerformingCustomersResponse | null>(null);

	const topCustomersRange = useMemo(
		() =>
			topCustomersRangeKey === 'custom'
				? topCustomersAppliedCustom
				: getTopCustomersPresetRange(topCustomersRangeKey),
		[topCustomersRangeKey, topCustomersAppliedCustom],
	);
	const topCustomersDateRangeForApi = useMemo(
		() => ({ from: toInputDate(topCustomersRange.start), to: toInputDate(topCustomersRange.end) }),
		[topCustomersRange.start, topCustomersRange.end],
	);

	const mergedStateCounts = useMemo(
		() => mergeStateCountsForDisplay(orderReport?.stateCounts ?? []),
		[orderReport],
	);

	const stateOrderBarData = useMemo(() => {
		const rows = mergedStateCounts;
		const sorted = [...rows].sort((a, b) => b.count - a.count);
		const topCountStates = topLabelSet(sorted, (r) => r.count, (r) => r.state, 5);
		const topRevenueStates = topLabelSet(sorted, (r) => toFiniteNumber(r.revenue), (r) => r.state, 5);
		return {
			labels: sorted.map((r) => r.state),
			datasets: [
				{
					label: 'Orders',
					data: sorted.map((r) => r.count),
					backgroundColor: sorted.map((r) => (topCountStates.has(r.state) ? '#2563eb' : 'rgba(37, 99, 235, 0.28)')),
					hoverBackgroundColor: sorted.map((r) => (topCountStates.has(r.state) ? '#1d4ed8' : 'rgba(37, 99, 235, 0.46)')),
					borderRadius: 6,
					borderSkipped: false,
					yAxisID: 'y',
				},
				{
					label: 'Revenue',
					data: sorted.map((r) => toFiniteNumber(r.revenue)),
					backgroundColor: sorted.map((r) => (topRevenueStates.has(r.state) ? '#7c3aed' : 'rgba(124, 58, 237, 0.28)')),
					hoverBackgroundColor: sorted.map((r) => (topRevenueStates.has(r.state) ? '#6d28d9' : 'rgba(124, 58, 237, 0.46)')),
					borderRadius: 6,
					borderSkipped: false,
					yAxisID: 'y1',
				},
			],
		};
	}, [mergedStateCounts]);

	const pincodeOrderBarData = useMemo(() => {
		const rows = orderReport?.pincodeCounts ?? [];
		const sorted = [...rows].sort((a, b) => b.count - a.count);
		const topCountPincodes = topLabelSet(sorted, (r) => r.count, (r) => String(r.pincode), 5);
		const topRevenuePincodes = topLabelSet(sorted, (r) => toFiniteNumber(r.revenue), (r) => String(r.pincode), 5);
		return {
			labels: sorted.map((r) => String(r.pincode)),
			datasets: [
				{
					label: 'Orders',
					data: sorted.map((r) => r.count),
					backgroundColor: sorted.map((r) => (topCountPincodes.has(String(r.pincode)) ? '#0d9488' : 'rgba(13, 148, 136, 0.28)')),
					hoverBackgroundColor: sorted.map((r) => (topCountPincodes.has(String(r.pincode)) ? '#0f766e' : 'rgba(13, 148, 136, 0.46)')),
					borderRadius: 6,
					borderSkipped: false,
					yAxisID: 'y',
				},
				{
					label: 'Revenue',
					data: sorted.map((r) => toFiniteNumber(r.revenue)),
					backgroundColor: sorted.map((r) => (topRevenuePincodes.has(String(r.pincode)) ? '#ea580c' : 'rgba(234, 88, 12, 0.28)')),
					hoverBackgroundColor: sorted.map((r) => (topRevenuePincodes.has(String(r.pincode)) ? '#c2410c' : 'rgba(234, 88, 12, 0.46)')),
					borderRadius: 6,
					borderSkipped: false,
					yAxisID: 'y1',
				},
			],
		};
	}, [orderReport]);

	useEffect(() => {
		let cancelled = false;
		setOrderReportLoading(true);
		setOrderReportError(null);
		fetchAnalyticsOrderReporting(dateRangeForApi.from, dateRangeForApi.to)
			.then((payload) => {
				if (!cancelled) {
					setOrderReport(payload);
					setOrderReportError(null);
				}
			})
			.catch((err) => {
				console.error('Failed to load order reporting', err);
				if (!cancelled) {
					setOrderReport(null);
					setOrderReportError('Could not load order reporting for this range.');
				}
			})
			.finally(() => {
				if (!cancelled) setOrderReportLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [dateRangeForApi.from, dateRangeForApi.to]);

	useEffect(() => {
		let cancelled = false;
		setTopCustomersLoading(true);
		setTopCustomersError(null);
		fetchTopPerformingCustomers(topCustomersDateRangeForApi.from, topCustomersDateRangeForApi.to, topCustomersType)
			.then((payload) => {
				if (!cancelled) {
					setTopCustomersData(payload);
					setTopCustomersError(null);
				}
			})
			.catch((err) => {
				console.error('Failed to load top performing customers', err);
				if (!cancelled) {
					setTopCustomersData(null);
					setTopCustomersError('Could not load top performing customers for this range.');
				}
			})
			.finally(() => {
				if (!cancelled) setTopCustomersLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [topCustomersDateRangeForApi.from, topCustomersDateRangeForApi.to, topCustomersType]);

	useEffect(() => {
		function onTopCustomersDocClick(e: MouseEvent) {
			if (!topCustomersShowCustom) return;
			const target = e.target as Node;
			if (topCustomersPopoverRef.current?.contains(target)) return;
			if (topCustomersCustomBtnRef.current?.contains(target)) return;
			setTopCustomersShowCustom(false);
		}
		document.addEventListener('click', onTopCustomersDocClick);
		return () => document.removeEventListener('click', onTopCustomersDocClick);
	}, [topCustomersShowCustom]);

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

	const stateBarScrollWidth = orderReportingScrollWidth(stateOrderBarData.labels.length);
	const pincodeBarScrollWidth = orderReportingScrollWidth(pincodeOrderBarData.labels.length);

	const geoStateOrderTotal = useMemo(
		() => mergedStateCounts.reduce((s, r) => s + r.count, 0),
		[mergedStateCounts],
	);
	const geoPincodeOrderTotal = useMemo(
		() => (orderReport?.pincodeCounts ?? []).reduce((s, r) => s + r.count, 0),
		[orderReport],
	);
	const geoStateRevenueTotal = useMemo(
		() => mergedStateCounts.reduce((s, r) => s + toFiniteNumber(r.revenue), 0),
		[mergedStateCounts],
	);
	const geoPincodeRevenueTotal = useMemo(
		() => (orderReport?.pincodeCounts ?? []).reduce((s, r) => s + toFiniteNumber(r.revenue), 0),
		[orderReport],
	);
	const geoBarOptions = useMemo((): ChartOptions<'bar'> => ({
		...ORDER_REPORTING_GEO_BAR_OPTIONS,
		plugins: {
			...ORDER_REPORTING_GEO_BAR_OPTIONS.plugins,
			legend: {
				display: true,
				position: 'bottom',
				labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8, padding: 14, font: { size: 11, weight: 600 } },
			},
			tooltip: {
				...ORDER_REPORTING_GEO_BAR_OPTIONS.plugins?.tooltip,
				callbacks: {
					label: (ctx) => (ctx.dataset.label === 'Revenue'
						? ` Revenue: ${formatCurrency(toFiniteNumber(ctx.parsed.y))}`
						: ` Orders: ${toFiniteNumber(ctx.parsed.y).toLocaleString()}`),
				},
			},
		},
		scales: {
			...ORDER_REPORTING_GEO_BAR_OPTIONS.scales,
			y: {
				...ORDER_REPORTING_GEO_BAR_OPTIONS.scales?.y,
				beginAtZero: true,
				ticks: { display: false },
				grid: { display: false },
				border: { display: false },
			},
			y1: {
				beginAtZero: true,
				position: 'right',
				ticks: { display: false },
				grid: { drawOnChartArea: false, display: false },
				border: { display: false },
			},
		},
	}), []);

	const statePotential = useMemo(() => {
		const rows = mergedStateCounts.map((r) => ({
			state: r.state,
			orders: r.count,
			revenue: toFiniteNumber(r.revenue),
			aov: r.count > 0 ? toFiniteNumber(r.revenue) / r.count : 0,
		}));
		const topOrders = [...rows].sort((a, b) => b.orders - a.orders).slice(0, 5);
		const topRevenue = [...rows].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
		const topAov = [...rows]
			.filter((r) => r.orders >= 5)
			.sort((a, b) => b.aov - a.aov)
			.slice(0, 5);
		const potentialRows = [...rows]
			.filter((r) => r.orders > 0)
			.sort((a, b) => b.revenue - a.revenue)
			.slice(0, 10);
		const getPotentialRead = (r: (typeof rows)[number]): string => {
			if (r.orders >= 60 && r.aov >= 2200) return 'Scale engine: defend share + improve AOV';
			if (r.orders >= 60) return 'High volume, under-monetized: upsell opportunity';
			if (r.aov >= 3500) return 'Premium value pool: expand aggressively';
			if (r.orders >= 40 && r.aov >= 1800) return 'Balanced market: optimize repeat and CAC';
			if (r.aov < 1800) return 'Volume-heavy, low ticket: bundle-led growth';
			return 'Growth market: improve reach and conversion';
		};
		return { topOrders, topRevenue, topAov, potentialRows, getPotentialRead };
	}, [mergedStateCounts]);

	return (
		<div className="dashboard">
			<div className="card dashboard-header-card">
				<div className="dashboard-header-title">Dashboard</div>
				<div className="dashboard-header-main">
					<div className="dashboard-header-filters-row">
						<div className="filter-group dashboard-header-filter-group">
							<RangeButton current={rangeKey} onClick={() => { setRangeKey('today'); setShowCustom(false); }} id="today">Today</RangeButton>
							<RangeButton current={rangeKey} onClick={() => { setRangeKey('yesterday'); setShowCustom(false); }} id="yesterday">Yesterday</RangeButton>
							<RangeButton current={rangeKey} onClick={() => { setRangeKey('last7'); setShowCustom(false); }} id="last7">Last 7 days</RangeButton>
							<RangeButton current={rangeKey} onClick={() => { setRangeKey('last30'); setShowCustom(false); }} id="last30">Last 30 days</RangeButton>
							<RangeButton current={rangeKey} onClick={() => { setRangeKey('currentMonth'); setShowCustom(false); }} id="currentMonth">Current Month</RangeButton>
							<RangeButton
								refEl={customBtnRef}
								current={rangeKey}
								isActive={rangeKey === 'custom' || showCustom}
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
								className="date-range-popover dashboard-header__popover dashboard-header__popover--open"
								style={{
									left: customBtnRef.current ? customBtnRef.current.offsetLeft : 0,
								}}
							>
								<div className="dashboard-header__popover-inner dashboard-header__popover-inner--pickers">
									<div className="dashboard-header__field">
										<span className="label" id="dashboard-custom-start-lab">Start</span>
										<DatePicker
											value={toInputDate(custom.start)}
											onChange={(v) => setCustom((prev) => ({ ...prev, start: dateFromInputString(v) }))}
											placeholder="Select start date"
										/>
									</div>
									<span className="dashboard-header__popover-sep" aria-hidden>—</span>
									<div className="dashboard-header__field">
										<span className="label" id="dashboard-custom-end-lab">End</span>
										<DatePicker
											value={toInputDate(custom.end)}
											onChange={(v) => setCustom((prev) => ({ ...prev, end: dateFromInputString(v) }))}
											placeholder="Select end date"
										/>
									</div>
									<button type="button" className="button" onClick={() => setShowCustom(false)}>Apply</button>
								</div>
							</div>
						) : null}
					</div>
					<div className="dashboard-header__meta">
					<span className="dashboard-pill">
						Range{' '}
						<strong>
							{orderReport?.filters?.from ?? dateRangeForApi.from} — {orderReport?.filters?.to ?? dateRangeForApi.to}
						</strong>
					</span>
					{orderReportLoading ? (
						<span className="dashboard-pill dashboard-pill--loading">
							<span className="dashboard-pill__dot" aria-hidden />
							Updating geography…
						</span>
					) : null}
					{orderReportError ? (
						<span className="dashboard-pill dashboard-pill--error" role="alert">
							{orderReportError}
						</span>
					) : null}
					</div>
				</div>
			</div>

			<section className="card dashboard-section dashboard-order-reporting" aria-labelledby="dashboard-geo-heading">
				<div className="dashboard-order-reporting__head">
					<div>
						<h2 id="dashboard-geo-heading" className="dashboard-order-reporting__title">Orders by geography</h2>
						<p className="dashboard-section__lead">
							Distribution from order reporting for the selected range. Scroll charts horizontally when there are many regions or pincodes.
						</p>
					</div>
					{orderReport && !orderReportError ? (
						<div className="dashboard-order-reporting__badges" aria-live="polite">
							<span className="dashboard-order-reporting__badge">
								States <strong>{mergedStateCounts.length}</strong>
							</span>
							<span className="dashboard-order-reporting__badge">
								Pincodes <strong>{orderReport.pincodeCounts?.length ?? 0}</strong>
							</span>
						</div>
					) : null}
				</div>
				{orderReportLoading && !orderReport ? (
					<div className="dashboard-skeleton" aria-busy="true" aria-label="Loading geography charts">
						<div className="dashboard-skeleton__bar dashboard-skeleton__bar--medium" />
						<div className="dashboard-skeleton__bar dashboard-skeleton__bar--short" />
						<div className="dashboard-skeleton__bar dashboard-skeleton__bar--medium" />
					</div>
				) : null}
				{orderReport && !orderReportError ? (
					<div className="dashboard-order-reporting-charts">
						<div className="dashboard-order-reporting-chart dashboard-order-reporting-chart--state">
							<h3 className="dashboard-order-reporting-chart__title">
								By state
								<span className="dashboard-order-reporting-chart__subtitle">
									{geoStateOrderTotal.toLocaleString()} orders - {formatCurrency(geoStateRevenueTotal)} revenue
								</span>
							</h3>
							{mergedStateCounts.length === 0 ? (
								<p className="dashboard-order-reporting-empty">No orders with state in this range.</p>
							) : (
								<div className="dashboard-order-reporting-chart__panel">
									<div className="dashboard-order-reporting-chart__kpis">
										<span className="dashboard-order-reporting-chart__kpi">
											<em>Orders</em>
											<strong>{geoStateOrderTotal.toLocaleString()}</strong>
										</span>
										<span className="dashboard-order-reporting-chart__kpi">
											<em>Revenue</em>
											<strong>{formatCurrency(geoStateRevenueTotal)}</strong>
										</span>
									</div>
									<div className="dashboard-order-reporting-chart__scroll">
										<div
											className="dashboard-order-reporting-chart__canvas"
											style={{ width: stateBarScrollWidth, height: ORDER_REPORT_CHART_HEIGHT }}
										>
											<Bar
												data={stateOrderBarData}
												options={geoBarOptions}
												plugins={[geoDualValueLabelsPlugin]}
											/>
										</div>
									</div>
								</div>
							)}
						</div>
						<div className="dashboard-order-reporting-chart dashboard-order-reporting-chart--pincode">
							<h3 className="dashboard-order-reporting-chart__title">
								By pincode
								<span className="dashboard-order-reporting-chart__subtitle">
									{geoPincodeOrderTotal.toLocaleString()} orders - {formatCurrency(geoPincodeRevenueTotal)} revenue
								</span>
							</h3>
							{(orderReport.pincodeCounts?.length ?? 0) === 0 ? (
								<p className="dashboard-order-reporting-empty">No orders with pincode in this range.</p>
							) : (
								<div className="dashboard-order-reporting-chart__panel">
									<div className="dashboard-order-reporting-chart__kpis">
										<span className="dashboard-order-reporting-chart__kpi">
											<em>Orders</em>
											<strong>{geoPincodeOrderTotal.toLocaleString()}</strong>
										</span>
										<span className="dashboard-order-reporting-chart__kpi">
											<em>Revenue</em>
											<strong>{formatCurrency(geoPincodeRevenueTotal)}</strong>
										</span>
									</div>
									<div className="dashboard-order-reporting-chart__scroll">
										<div
											className="dashboard-order-reporting-chart__canvas"
											style={{ width: pincodeBarScrollWidth, height: ORDER_REPORT_CHART_HEIGHT }}
										>
											<Bar
												data={pincodeOrderBarData}
												options={geoBarOptions}
												plugins={[geoDualValueLabelsPlugin]}
											/>
										</div>
									</div>
								</div>
							)}
						</div>
					</div>
				) : null}
			</section>

			<section className="card dashboard-section dashboard-table-card dashboard-top-customers-section" aria-labelledby="dashboard-top-customers-heading">
				<div className="dashboard-top-customers-toolbar">
					<div className="dashboard-top-customers-toolbar__left">
						<div className="dashboard-section__head dashboard-top-customers-head">
							<h2 id="dashboard-top-customers-heading" className="dashboard-section__title">Top performing customers</h2>
							<p className="dashboard-section__lead">
								Ranked by {topCustomersType === 'order' ? 'order count' : 'total spend'}
								{' '}
								(
								{topCustomersData?.filters?.from ?? topCustomersDateRangeForApi.from}
								{' '}
								—
								{' '}
								{topCustomersData?.filters?.to ?? topCustomersDateRangeForApi.to}
								).
							</p>
						</div>
						<div className="shopify-category-tabs dashboard-top-customers-tabs">
							<FilterButton active={topCustomersType === 'order'} onClick={() => setTopCustomersType('order')}>
								By Order
							</FilterButton>
							<FilterButton active={topCustomersType === 'amount'} onClick={() => setTopCustomersType('amount')}>
								By Amount
							</FilterButton>
						</div>
					</div>
					<div className="dashboard-top-customers-toolbar__right">
						<div className="filter-group shopify-header-filter-group dashboard-top-customers-filters">
							<FilterButton
								active={topCustomersRangeKey === 'currentMonth'}
								onClick={() => {
									setTopCustomersRangeKey('currentMonth');
									setTopCustomersShowCustom(false);
								}}
							>
								Current Month
							</FilterButton>
							<FilterButton
								active={topCustomersRangeKey === 'last3Months'}
								onClick={() => {
									setTopCustomersRangeKey('last3Months');
									setTopCustomersShowCustom(false);
								}}
							>
								Last 3 Months
							</FilterButton>
							<FilterButton
								active={topCustomersRangeKey === 'last6Months'}
								onClick={() => {
									setTopCustomersRangeKey('last6Months');
									setTopCustomersShowCustom(false);
								}}
							>
								Last 6 Months
							</FilterButton>
							<FilterButton
								active={topCustomersRangeKey === 'last1Year'}
								onClick={() => {
									setTopCustomersRangeKey('last1Year');
									setTopCustomersShowCustom(false);
								}}
							>
								Last 1 Year
							</FilterButton>
							<FilterButton
								refEl={topCustomersCustomBtnRef}
								active={topCustomersRangeKey === 'custom' || topCustomersShowCustom}
								onClick={() => {
									if (!topCustomersShowCustom) {
										setTopCustomersCustomDraft(topCustomersAppliedCustom);
									}
									setTopCustomersShowCustom((v) => !v);
								}}
							>
								Custom
							</FilterButton>
						</div>
						{topCustomersShowCustom ? (
							<div
								ref={topCustomersPopoverRef}
								className="date-range-popover shopify-date-range-popover dashboard-top-customers-date-popover"
								style={{ right: 0, left: 'auto' }}
							>
								<div className="shopify-date-range-inner">
									<div className="shopify-date-range-field">
										<label className="label shopify-date-range-label">Start</label>
										<div className="shopify-date-range-picker">
											<DatePicker
												value={toInputDate(topCustomersCustomDraft.start)}
												onChange={(v) =>
													setTopCustomersCustomDraft((prev) => ({
														...prev,
														start: dateFromInputString(v),
													}))
												}
												placeholder="Select start date"
											/>
										</div>
									</div>
									<span className="shopify-date-range-separator" aria-hidden>—</span>
									<div className="shopify-date-range-field">
										<label className="label shopify-date-range-label">End</label>
										<div className="shopify-date-range-picker">
											<DatePicker
												value={toInputDate(topCustomersCustomDraft.end)}
												onChange={(v) =>
													setTopCustomersCustomDraft((prev) => ({
														...prev,
														end: dateFromInputString(v),
													}))
												}
												placeholder="Select end date"
											/>
										</div>
									</div>
									<button
										type="button"
										className="button shopify-date-range-apply"
										onClick={() => {
											setTopCustomersAppliedCustom(topCustomersCustomDraft);
											setTopCustomersRangeKey('custom');
											setTopCustomersShowCustom(false);
										}}
									>
										Apply
									</button>
								</div>
							</div>
						) : null}
					</div>
				</div>
				{topCustomersLoading ? (
					<p className="dashboard-top-customers-status">
						<span className="dashboard-pill dashboard-pill--loading">
							<span className="dashboard-pill__dot" aria-hidden />
							Loading customers…
						</span>
					</p>
				) : null}
				{topCustomersError ? (
					<p className="dashboard-top-customers-status dashboard-top-customers-status--error" role="alert">
						{topCustomersError}
					</p>
				) : null}
				{!topCustomersLoading && !topCustomersError && topCustomersData ? (
					(topCustomersData.customers?.length ?? 0) === 0 ? (
						<p className="dashboard-top-customers-empty">No customers in this range.</p>
					) : (
						<div className="dashboard-table-scroll">
							<table className="dashboard-table dashboard-top-customers-table">
								<thead>
									<tr>
										<th scope="col">#</th>
										<th scope="col">Customer</th>
										<th scope="col" className="dashboard-table__num">Orders</th>
										<th scope="col" className="dashboard-table__num">Total amount</th>
										<th scope="col">Last order</th>
										<th scope="col">Platform</th>
										<th scope="col">Payment</th>
										<th scope="col">Status</th>
									</tr>
								</thead>
								<tbody>
									{topCustomersData.customers.map((customer, index) => {
										const phone = formatPhone(customer.countryCode, customer.phoneNumber);
										const lastOrder = customer.lastOrder;
										const deliveryStatus = mapDeliveryStatusFromTracking(
											lastOrder?.trackingStatus,
											lastOrder?.returnStatus,
										);
										return (
											<tr key={customer.customerId}>
												<td>{index + 1}</td>
												<td>
													<div className="shopify-customer-cell">
														<div className="shopify-customer-name-row">
															<span className="shopify-customer-name">{customer.name || '—'}</span>
														</div>
														{phone !== '—' ? (
															<span className="shopify-customer-phone">{phone}</span>
														) : (
															<span className="shopify-customer-phone shopify-customer-phone--empty">—</span>
														)}
													</div>
												</td>
												<td className="dashboard-table__num">{customer.orderCount.toLocaleString()}</td>
												<td className="dashboard-table__num">{formatCurrency(customer.totalAmount)}</td>
												<td>{formatLastOrderDate(lastOrder?.date ?? '')}</td>
												<td>
													<PlatformTag platform={lastOrder?.platform ?? ''} />
												</td>
												<td>
													<StatusTag kind={lastOrder?.paymentMode ?? ''} type="payment" />
												</td>
												<td>
													<div className="shopify-shipping-status-cell">
														<StatusTag kind={deliveryStatus} type="delivery" />
														{lastOrder?.referenceNo ? (
															<span className="dashboard-top-customers-ref">{lastOrder.referenceNo}</span>
														) : null}
													</div>
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)
				) : null}
			</section>

			{orderReport && !orderReportError ? (
				<section className="card dashboard-section" aria-labelledby="dashboard-potential-heading">
					<div className="dashboard-section__head">
						<h2 id="dashboard-potential-heading" className="dashboard-section__title">State Potential Analysis</h2>
						<p className="dashboard-section__lead">Live recommendations from the selected date range.</p>
					</div>
					<div className="dashboard-table-scroll dashboard-potential-table-wrap">
						<table className="dashboard-table dashboard-potential-table">
							<thead>
								<tr>
									<th scope="col">State</th>
									<th scope="col">Orders</th>
									<th scope="col">Revenue</th>
									<th scope="col">Approx AOV</th>
									<th scope="col">Potential Read</th>
								</tr>
							</thead>
							<tbody>
								{statePotential.potentialRows.map((r) => (
									<tr key={`potential-${r.state}`}>
										<td>{r.state}</td>
										<td>{r.orders.toLocaleString()}</td>
										<td>{formatCurrency(r.revenue)}</td>
										<td>{formatCurrency(r.aov)}</td>
										<td>{statePotential.getPotentialRead(r)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<div className="dashboard-potential-strategy">
						<div className="dashboard-potential-card">
							<h3 className="dashboard-potential-card__title">Recommended strategy</h3>
							<ul className="dashboard-potential-list">
								<li>
									<span>Defend scale states</span>
									<strong>{statePotential.topOrders.slice(0, 3).map((r) => r.state).join(', ')}</strong>
								</li>
								<li>
									<span>Expand premium states</span>
									<strong>{statePotential.topAov.slice(0, 3).map((r) => r.state).join(', ')}</strong>
								</li>
								<li>
									<span>Maximize revenue states</span>
									<strong>{statePotential.topRevenue.slice(0, 3).map((r) => r.state).join(', ')}</strong>
								</li>
							</ul>
						</div>
					</div>
				</section>
			) : null}

		</div>
	);
}

function RangeButton({
	children,
	onClick,
	current,
	id,
	refEl,
	isActive,
}: {
	children: string;
	onClick: () => void;
	current: string;
	id: string;
	refEl?: React.MutableRefObject<HTMLButtonElement | null>;
	isActive?: boolean;
}) {
	const active = isActive ?? (current === id);
	return (
		<button
			type="button"
			ref={refEl as React.Ref<HTMLButtonElement>}
			onClick={onClick}
			className={`filter-btn${active ? ' active' : ''}`}
		>
			{children}
		</button>
	);
}
