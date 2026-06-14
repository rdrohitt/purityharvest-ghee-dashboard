import React, {
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { createPortal } from 'react-dom';
import type { Order } from '../../../utils/orders';
import type { Platform, OrderType, PaymentStatus, FulfillmentStatus, DeliveryStatus } from '../../../utils/orders';
import { DELIVERY_STATUSES, deliveryStatusLabel, normalizeDeliveryStatus } from '../../../utils/orders';
import type { SpendRecord } from '../../../utils/marketing-spend';

function MsIcon({ children }: { children: React.ReactNode }) {
    return (
	<svg
		className="shopify-modern-select__ms-icon"
		width="15"
		height="15"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden
	>
	{children}
        </svg>
    );
}

function iconAll() {
    return (
	<MsIcon>
		<line x1="8" y1="6" x2="21" y2="6" />
		<line x1="8" y1="12" x2="21" y2="12" />
		<line x1="8" y1="18" x2="21" y2="18" />
		<line x1="3" y1="6" x2="3.01" y2="6" />
		<line x1="3" y1="12" x2="3.01" y2="12" />
		<line x1="3" y1="18" x2="3.01" y2="18" />
	</MsIcon>
    );
}

function iconPlaceholder() {
    return (
	<MsIcon>
		<circle cx="12" cy="12" r="10" />
		<path d="M12 16v-4M12 8h.01" />
	</MsIcon>
    );
}

function platformIcon(platform: string) {
    const p = platform.toLowerCase();
    if (p === 'shopify')
	return (
		<MsIcon>
			<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
			<line x1="3" y1="6" x2="21" y2="6" />
			<path d="M16 10a4 4 0 0 1-8 0" />
		</MsIcon>
	);
    if (p === 'abandoned')
	return (
		<MsIcon>
			<circle cx="9" cy="21" r="1" />
			<circle cx="20" cy="21" r="1" />
			<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
			<line x1="10" y1="11" x2="22" y2="3" />
		</MsIcon>
	);
    if (p === 'whatsapp')
	return (
		<MsIcon>
			<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
		</MsIcon>
	);
    if (p === 'amazon' || p === 'flipkart')
	return (
		<MsIcon>
			<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
			<polyline points="3.27 6.96 12 12.01 20.73 6.96" />
			<line x1="12" y1="22.08" x2="12" y2="12" />
		</MsIcon>
	);
    if (p === 'calling')
	return (
		<MsIcon>
			<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
		</MsIcon>
	);
    return platformIcon('shopify');
}

function paymentIcon(mode: string) {
    if (mode === 'PAID')
	return (
		<MsIcon>
			<rect x="2" y="5" width="20" height="14" rx="2" />
			<line x1="2" y1="10" x2="22" y2="10" />
		</MsIcon>
	);
    if (mode === 'COD')
	return (
		<MsIcon>
			<rect x="2" y="7" width="20" height="14" rx="2" />
			<path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
			<line x1="12" y1="18" x2="12.01" y2="18" />
		</MsIcon>
	);
    return iconPlaceholder();
}

function fulfillmentIcon(status: string) {
    if (status === 'Fulfilled')
	return (
		<MsIcon>
			<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
			<polyline points="22 4 12 14.01 9 11.01" />
		</MsIcon>
	);
    if (status === 'Partial')
	return (
		<MsIcon>
			<path
				d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
				strokeDasharray="3 3"
			/>
			<polyline points="3.27 6.96 12 12.01 20.73 6.96" />
		</MsIcon>
	);
    return (
	<MsIcon>
		<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
		<polyline points="3.27 6.96 12 12.01 20.73 6.96" />
		<line x1="12" y1="22.08" x2="12" y2="12" />
	</MsIcon>
    );
}

function deliveryIcon(status: string) {
    const k = normalizeDeliveryStatus(status);
    if (k === 'delivered')
	return (
		<MsIcon>
			<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
			<polyline points="22 4 12 14.01 9 11.01" />
		</MsIcon>
	);
    if (k === 'in_transit')
	return (
		<MsIcon>
			<rect x="1" y="3" width="15" height="13" />
			<polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
			<circle cx="5.5" cy="18.5" r="2.5" />
			<circle cx="18.5" cy="18.5" r="2.5" />
		</MsIcon>
	);
    if (k === 'rto')
	return (
		<MsIcon>
			<polyline points="1 4 1 10 7 10" />
			<path d="M3.51 15a9 9 0 0 1 14.85-3.36L23 10M1 10l4 4 4-4" />
		</MsIcon>
	);
    if (k === 'pending_pickup')
	return (
		<MsIcon>
			<circle cx="12" cy="12" r="10" />
			<polyline points="12 6 12 12 16 14" />
		</MsIcon>
	);
    return iconPlaceholder();
}

function orderTypeIcon(t: string) {
    if (t === 'New')
	return (
		<MsIcon>
			<path d="M12 5v14M5 12h14" />
		</MsIcon>
	);
    if (t === 'Repeat')
	return (
		<MsIcon>
			<polyline points="17 1 21 5 17 9" />
			<path d="M3 11V9a4 4 0 0 1 4-4h14" />
			<polyline points="7 23 3 19 7 15" />
			<path d="M21 13v2a4 4 0 0 1-4 4H3" />
		</MsIcon>
	);
    if (t === 'Reference')
	return (
		<MsIcon>
			<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
			<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
		</MsIcon>
	);
    return iconPlaceholder();
}

function statusFilterOptionIcon(filterLabel: string, value: string): React.ReactNode {
    if (value === '') return iconAll();
    const L = filterLabel.toLowerCase();
    if (L === 'payment' || L.startsWith('payment ')) return paymentIcon(value);
    if (L === 'fulfill' || L === 'fulfillment') return fulfillmentIcon(value);
    if (L === 'delivery' || L === 'shipping' || L === 'status') return deliveryIcon(value);
    if (L === 'platform') return platformIcon(value);
    if (L === 'type') return orderTypeIcon(value);
    return iconPlaceholder();
}

export type ModernSelectOption<T extends string = string> = {
    value: T | '';
    label: string;
    icon?: React.ReactNode;
    /** Optional visual tone for colored dropdowns (e.g. RTO condition). */
    tone?: string;
};

export function ModernSelect<T extends string>({
    value,
    onChange,
    options,
    placeholder,
    disabled,
    variant = 'default',
    className = '',
    'aria-label': ariaLabel,
}: {
    value: T | '';
    onChange: (v: T | '') => void;
    options: ModernSelectOption<T>[];
    placeholder?: string;
    disabled?: boolean;
    variant?: 'default' | 'ribbon';
    className?: string;
    'aria-label'?: string;
}) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const listId = useId();
    const [menuRect, setMenuRect] = useState<
        | { placement: 'below'; top: number; left: number; width: number; maxHeight: number }
        | { placement: 'above'; bottom: number; left: number; width: number; maxHeight: number }
        | null
    >(null);

    const selected = options.find((o) => o.value === value);
    const displayLabel = selected?.label ?? placeholder ?? 'Select…';
    const displayIcon = selected?.icon;
    const selectedTone = selected?.tone;

    useLayoutEffect(() => {
        if (!open) {
            setMenuRect(null);
            return;
        }
        function place() {
            const el = triggerRef.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            const gap = 4;
            const edge = 8;
            const vh = window.innerHeight;
            const spaceBelow = vh - r.bottom - gap - edge;
            const spaceAbove = r.top - gap - edge;
            const w = Math.max(r.width, 140);
            const maxOpen = 280;
            /** Never exceed viewport; avoid old bug: min 120px forced menu past bottom of screen */
            const clampH = (space: number) => Math.max(0, Math.min(maxOpen, space));
            let openDown = spaceBelow >= spaceAbove;
            let maxH = clampH(openDown ? spaceBelow : spaceAbove);
            const altH = clampH(openDown ? spaceAbove : spaceBelow);
            if (altH > maxH + 20) {
                openDown = !openDown;
                maxH = altH;
            }
            if (openDown) {
                setMenuRect({
                    placement: 'below',
                    top: r.bottom + gap,
                    left: r.left,
                    width: w,
                    maxHeight: maxH,
                });
            } else {
                setMenuRect({
                    placement: 'above',
                    bottom: vh - r.top + gap,
                    left: r.left,
                    width: w,
                    maxHeight: maxH,
                });
            }
        }
        place();
        window.addEventListener('scroll', place, true);
        window.addEventListener('resize', place);
        return () => {
            window.removeEventListener('scroll', place, true);
            window.removeEventListener('resize', place);
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        function onDoc(e: MouseEvent) {
            const t = e.target as Node;
            if (rootRef.current?.contains(t)) return;
            if (listRef.current?.contains(t)) return;
            setOpen(false);
        }
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') setOpen(false);
        }
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);

    const listNode =
	open && menuRect && typeof document !== 'undefined' ? (
		createPortal(
		<ul
			ref={listRef}
			id={listId}
			className={`shopify-modern-select__list shopify-modern-select__list--portal${variant === 'ribbon' ? ' shopify-modern-select__list--ribbon-portal' : ''}`.trim()}
			role="listbox"
			style={{
				position: 'fixed',
				left: menuRect.left,
				width: menuRect.width,
				maxHeight: menuRect.maxHeight,
				...(menuRect.placement === 'below'
					? { top: menuRect.top, bottom: 'auto' as const }
					: { top: 'auto' as const, bottom: menuRect.bottom }),
			}}
		>
			{options.map((opt) => (
				<li key={String(opt.value) + opt.label} role="presentation">
					<button
						type="button"
						className={`shopify-modern-select__option${opt.value === value ? ' is-active' : ''}${
							opt.tone ? ` shopify-modern-select__option--tone-${opt.tone}` : ''
						}`}
						role="option"
						aria-selected={opt.value === value}
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => {
							onChange(opt.value as T | '');
							setOpen(false);
						}}
					>
						{opt.icon ? (
							<span className="shopify-modern-select__option-icon">{opt.icon}</span>
						) : null}
						<span className="shopify-modern-select__option-label">{opt.label}</span>
					</button>
				</li>
			))}
		</ul>,
		document.body
		)
	) : null;

    return (
	<div
		ref={rootRef}
		className={`shopify-modern-select shopify-modern-select--${variant}${open ? ' is-open' : ''}${
			selectedTone ? ` shopify-modern-select--tone-${selectedTone}` : ''
		} ${className}`.trim()}
	>
		<button
			ref={triggerRef}
			type="button"
			className={`shopify-modern-select__trigger${
				selectedTone ? ` shopify-modern-select__trigger--tone-${selectedTone}` : ''
			}`}
			aria-haspopup="listbox"
			aria-expanded={open}
			aria-controls={listId}
			aria-label={ariaLabel}
			disabled={disabled}
			onClick={() => !disabled && setOpen((o) => !o)}
		>
			<span className="shopify-modern-select__trigger-inner">
				{displayIcon ? (
					<span className="shopify-modern-select__trigger-icon">{displayIcon}</span>
				) : null}
				<span
					className={`shopify-modern-select__label${!selected && placeholder ? ' is-placeholder' : ''}`}
				>
					{displayLabel}
				</span>
			</span>
			<span className="shopify-modern-select__chev" aria-hidden />
		</button>
		{listNode}
        </div>
    );
}

const PLATFORMS: Platform[] = ['Shopify', 'Abandoned', 'Whatsapp', 'Amazon', 'Flipkart', 'Calling', 'Collaboration'];

export const ORDER_MODAL_TYPE_OPTIONS: ModernSelectOption<OrderType | ''>[] = [
    { value: '', label: 'Select Type', icon: iconPlaceholder() },
    { value: 'New', label: 'New', icon: orderTypeIcon('New') },
    { value: 'Repeat', label: 'Repeat', icon: orderTypeIcon('Repeat') },
    { value: 'Reference', label: 'Reference', icon: orderTypeIcon('Reference') },
];

export const ORDER_MODAL_PLATFORM_OPTIONS: ModernSelectOption<Platform | ''>[] = [
    { value: '', label: 'Select Platform', icon: iconPlaceholder() },
    ...PLATFORMS.map((p) => ({ value: p, label: p, icon: platformIcon(p) })),
];

export const ORDER_MODAL_PAYMENT_OPTIONS: ModernSelectOption<PaymentStatus | ''>[] = [
    { value: '', label: 'Select Payment Mode', icon: iconPlaceholder() },
    { value: 'COD', label: 'COD', icon: paymentIcon('COD') },
    { value: 'PAID', label: 'PAID', icon: paymentIcon('PAID') },
];

export const ORDER_MODAL_FULFILLMENT_OPTIONS: ModernSelectOption<FulfillmentStatus>[] = (
    ['Unfulfilled', 'Fulfilled', 'Partial'] as FulfillmentStatus[]
).map((p) => ({ value: p, label: p, icon: fulfillmentIcon(p) }));

export const ORDER_MODAL_DELIVERY_OPTIONS: ModernSelectOption<DeliveryStatus>[] = DELIVERY_STATUSES.map((p) => ({
    value: p,
    label: deliveryStatusLabel(p),
    icon: deliveryIcon(p),
}));

/** Carrier options for order tracking (Shopify add/edit modal). */
export type TrackingCompany = 'Delhivery' | 'Amazon' | 'Shiprocket';

function trackingCompanyIcon(company: TrackingCompany | ''): React.ReactNode {
    if (company === 'Delhivery')
        return (
            <MsIcon>
                <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
                <path d="M15 18h2" />
                <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
                <circle cx="17" cy="18" r="2" />
                <circle cx="7" cy="18" r="2" />
            </MsIcon>
        );
    if (company === 'Amazon') return platformIcon('Amazon');
    if (company === 'Shiprocket')
        return (
            <MsIcon>
                <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
                <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
                <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
            </MsIcon>
        );
    return iconPlaceholder();
}

export const ORDER_MODAL_TRACKING_COMPANY_OPTIONS: ModernSelectOption<TrackingCompany>[] = [
    { value: '', label: 'Select carrier', icon: trackingCompanyIcon('') },
    { value: 'Delhivery', label: 'Delhivery', icon: trackingCompanyIcon('Delhivery') },
    { value: 'Amazon', label: 'Amazon', icon: trackingCompanyIcon('Amazon') },
    { value: 'Shiprocket', label: 'Shiprocket', icon: trackingCompanyIcon('Shiprocket') },
];

export function toInputDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function formatCurrency(n: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export function formatDate(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

/** Product tab on the Shopify orders page — drives the WhatsApp summary title (e.g. Milk vs Ghee). */
export type WhatsAppSummaryCategoryTab = 'all' | 'milk' | 'ghee' | 'oils';

function whatsAppSummaryTitlePrefix(tab: WhatsAppSummaryCategoryTab): string {
    switch (tab) {
        case 'milk':
            return 'Milk Summary';
        case 'oils':
            return 'Oils Summary';
        case 'all':
            return 'Summary';
        case 'ghee':
        default:
            return 'Ghee Summary';
    }
}

/**
 * WhatsApp prefill text for a single calendar day (`date` is the table group label, e.g. `02-May-2026`).
 * Total revenue, order count, and ROAS use Shopify-platform orders only; spend matches marketing records for that day.
 */
export function generateWhatsAppSummary(
    date: string,
    orders: Order[],
    marketingSpend: SpendRecord[],
    categoryTab: WhatsAppSummaryCategoryTab = 'ghee',
): string {
    const dateParts = date.split('-');
    const months: { [key: string]: string } = {
        Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
        Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
    };
    const ymd =
        dateParts.length === 3 && months[dateParts[1]]
            ? `${dateParts[2]}-${months[dateParts[1]]}-${dateParts[0]}`
            : '';

    const totalSpend =
        ymd === ''
            ? 0
            : marketingSpend
                  .filter((spend) => spend.date.split('T')[0] === ymd)
                  .reduce((sum, spend) => sum + spend.amount, 0);

    const shopifyOrders = orders.filter((o) => (o.platform || '').toLowerCase() === 'shopify');
    const totalRevenue = shopifyOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
    const orderCount = shopifyOrders.length;

    const roas =
        totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) : '—';

    return [
        `*${whatsAppSummaryTitlePrefix(categoryTab)} ${date}*`,
        '',
        `Total Spend: ${formatCurrency(totalSpend)}`,
        `Total Revenue: ${formatCurrency(totalRevenue)}`,
        `Order Count: ${orderCount}`,
        `ROAS: ${roas}`,
    ].join('\n');
}

export function FilterButton({
    active,
    onClick,
    children,
    refEl,
}: {
    active: boolean;
    onClick: () => void;
    children: string;
    refEl?: React.MutableRefObject<HTMLButtonElement | null>;
}) {
    return (
        <button ref={refEl as any} onClick={onClick} className={`filter-btn ${active ? 'active' : ''}`}>
            {children}
        </button>
    );
}

export function Th({ children, align = 'left' }: { children: string; align?: 'left' | 'center' | 'right' }) {
    const alignClass = align === 'center' ? ' shopify-th--center' : align === 'right' ? ' shopify-th--right' : '';
    return <th className={`shopify-th${alignClass}`}>{children}</th>;
}

export function Td({
    children,
    style,
    className,
    dataLabel,
}: {
    children: React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
    /** Used for responsive stacked tables (e.g. customer profile modal). */
    dataLabel?: string;
}) {
    const cls = ['shopify-td', className].filter(Boolean).join(' ');
    return (
        <td
            className={cls || undefined}
            style={style}
            {...(dataLabel != null && dataLabel !== '' ? { 'data-label': dataLabel } : {})}
        >
            {children}
        </td>
    );
}

export function StatusFilter<T extends string>({
    label,
    value,
    onChange,
    options,
    layout = 'default',
    formatOptionLabel,
}: {
    label: string;
    value: T | '';
    onChange: (val: T | '') => void;
    options: T[];
    /** `ribbon`: compact pill used on Shopify filter bar */
    layout?: 'default' | 'ribbon';
    /** When option values are API codes, use this for visible labels (e.g. shipping status). */
    formatOptionLabel?: (opt: T) => string;
}) {
    const ribbon = layout === 'ribbon';
    const modernOptions = useMemo((): ModernSelectOption<T>[] => {
        const all: ModernSelectOption<T> = {
            value: '' as T | '',
            label: 'All',
            icon: statusFilterOptionIcon(label, ''),
        };
        const rest = options.map((opt) => ({
            value: opt,
            label: formatOptionLabel ? formatOptionLabel(opt) : opt,
            icon: statusFilterOptionIcon(label, opt),
        }));
        return [all, ...rest];
    }, [label, options, formatOptionLabel]);

    return (
        <div className={`shopify-status-filter${ribbon ? ' shopify-status-filter--ribbon' : ''}`}>
            {ribbon ? (
                <div className="shopify-status-filter__ribbon-shell">
                    <span className="label shopify-status-filter__ribbon-label">{label}</span>
                    <ModernSelect<T>
                        variant="ribbon"
                        className="shopify-status-filter__modern"
                        value={value}
                        onChange={onChange}
                        options={modernOptions}
                        aria-label={label}
                    />
                </div>
            ) : (
                <>
                    <label className="label">{label}</label>
                    <ModernSelect<T>
                        variant="default"
                        className="shopify-status-filter__modern shopify-status-filter__modern--stacked"
                        value={value}
                        onChange={onChange}
                        options={modernOptions}
                        aria-label={label}
                    />
                </>
            )}
        </div>
    );
}

export function StatusTag({ kind, type }: { kind: string; type: 'payment' | 'delivery' }) {
    if (type === 'payment') {
        const mod =
            kind === 'PAID'
                ? 'shopify-payment-tag--paid'
                : kind === 'COD'
                  ? 'shopify-payment-tag--cod'
                  : 'shopify-payment-tag--default';
        return <span className={`shopify-payment-tag ${mod}`}>{kind}</span>;
    }
    const d = normalizeDeliveryStatus(kind);
    const mod =
        d === 'delivered'
            ? 'shopify-delivery-tag--delivered'
            : d === 'in_transit'
              ? 'shopify-delivery-tag--transit'
              : d === 'pending_pickup'
                ? 'shopify-delivery-tag--pending'
                : d === 'rto'
                  ? 'shopify-delivery-tag--rto'
                  : 'shopify-delivery-tag--default';
    return <span className={`shopify-delivery-tag ${mod}`}>{deliveryStatusLabel(d)}</span>;
}

export function PlatformTag({ platform }: { platform?: Platform | string }) {
    if (!platform) return <span>—</span>;

    const raw = String(platform);
    const lower = raw.toLowerCase();

    const modifier =
        lower === 'shopify'
            ? 'shopify-platform-tag--shopify'
            : lower === 'whatsapp'
              ? 'shopify-platform-tag--whatsapp'
              : lower === 'abandoned'
                ? 'shopify-platform-tag--abandoned'
                : lower === 'calling'
                  ? 'shopify-platform-tag--calling'
                  : lower === 'collaboration'
                    ? 'shopify-platform-tag--collaboration'
                    : lower === 'amazon'
                    ? 'shopify-platform-tag--amazon'
                    : lower === 'flipkart'
                      ? 'shopify-platform-tag--flipkart'
                      : 'shopify-platform-tag--default';

    // Normalize label casing in UI (e.g. "abandoned" -> "Abandoned")
    const label =
        lower === 'shopify'
            ? 'Shopify'
            : lower === 'whatsapp'
              ? 'Whatsapp'
              : lower === 'abandoned'
                ? 'Abandoned'
                : lower === 'calling'
                  ? 'Calling'
                  : lower === 'collaboration'
                    ? 'Collaboration'
                    : lower === 'amazon'
                    ? 'Amazon'
                    : lower === 'flipkart'
                      ? 'Flipkart'
                      : raw;

    return (
        <span className={`shopify-platform-tag ${modifier}`}>
            <span className="shopify-platform-tag__mark" aria-hidden />
            {label}
        </span>
    );
}

export function TypeTag({ type }: { type?: OrderType | string }) {
    if (!type) return <span>—</span>;
    const modifier =
        type === 'New' ? 'shopify-type-tag--new' :
        type === 'Repeat' ? 'shopify-type-tag--repeat' :
        type === 'Reference' ? 'shopify-type-tag--reference' :
        'shopify-type-tag--default';
    return (
        <span className={`shopify-type-tag ${modifier}`}>
            <span className="shopify-type-tag__glyph" aria-hidden>
                {String(type).charAt(0)}
            </span>
            {type}
        </span>
    );
}
