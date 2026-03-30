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
import type {
    Platform,
    OrderType,
    PaymentStatus,
    FulfillmentStatus,
    DeliveryStatus,
} from '../../../utils/orders';
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
    if (status === 'Delivered')
	return (
		<MsIcon>
			<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
			<polyline points="22 4 12 14.01 9 11.01" />
		</MsIcon>
	);
    if (status === 'In Transit')
	return (
		<MsIcon>
			<rect x="1" y="3" width="15" height="13" />
			<polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
			<circle cx="5.5" cy="18.5" r="2.5" />
			<circle cx="18.5" cy="18.5" r="2.5" />
		</MsIcon>
	);
    if (status === 'RTO')
	return (
		<MsIcon>
			<polyline points="1 4 1 10 7 10" />
			<path d="M3.51 15a9 9 0 0 1 14.85-3.36L23 10M1 10l4 4 4-4" />
		</MsIcon>
	);
    if (status === 'Pending Pickup')
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
    if (L === 'payment') return paymentIcon(value);
    if (L === 'fulfill' || L === 'fulfillment') return fulfillmentIcon(value);
    if (L === 'delivery' || L === 'shipping') return deliveryIcon(value);
    if (L === 'platform') return platformIcon(value);
    if (L === 'type') return orderTypeIcon(value);
    return iconPlaceholder();
}

export type ModernSelectOption<T extends string = string> = {
    value: T | '';
    label: string;
    icon?: React.ReactNode;
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
    const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

    const selected = options.find((o) => o.value === value);
    const displayLabel = selected?.label ?? placeholder ?? 'Select…';
    const displayIcon = selected?.icon;

    useLayoutEffect(() => {
        if (!open) {
            setMenuRect(null);
            return;
        }
        function place() {
            const el = triggerRef.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            const maxH = Math.max(120, Math.min(280, window.innerHeight - r.bottom - 12));
            setMenuRect({
                top: r.bottom + 4,
                left: r.left,
                width: Math.max(r.width, 140),
                maxHeight: maxH,
            });
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
				top: menuRect.top,
				left: menuRect.left,
				width: menuRect.width,
				maxHeight: menuRect.maxHeight,
			}}
		>
			{options.map((opt) => (
				<li key={String(opt.value) + opt.label} role="presentation">
					<button
						type="button"
						className={`shopify-modern-select__option${opt.value === value ? ' is-active' : ''}`}
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
		className={`shopify-modern-select shopify-modern-select--${variant}${open ? ' is-open' : ''} ${className}`.trim()}
	>
		<button
			ref={triggerRef}
			type="button"
			className="shopify-modern-select__trigger"
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

const PLATFORMS: Platform[] = ['Shopify', 'Abandoned', 'Whatsapp', 'Amazon', 'Flipkart', 'Calling'];

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

export const ORDER_MODAL_DELIVERY_OPTIONS: ModernSelectOption<DeliveryStatus>[] = (
    ['In Transit', 'Delivered', 'RTO', 'Pending Pickup'] as DeliveryStatus[]
).map((p) => ({ value: p, label: p, icon: deliveryIcon(p) }));

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

export function generateWhatsAppSummary(date: string, orders: Order[], marketingSpend: SpendRecord[]): string {
    const platformNewTotals: { [key: string]: number } = {};
    const platformRepeatTotals: { [key: string]: number } = {};

    orders.forEach((order) => {
        const platform = order.platform || 'Unknown';
        if (order.type === 'New') {
            platformNewTotals[platform] = (platformNewTotals[platform] || 0) + order.amount;
        }
        if (order.type === 'Repeat') {
            platformRepeatTotals[platform] = (platformRepeatTotals[platform] || 0) + order.amount;
        }
    });

    const dateParts = date.split('-');
    const months: { [key: string]: string } = {
        Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
        Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
    };
    const dateStr = `${dateParts[2]}-${months[dateParts[1]]}-${dateParts[0]}`;

    const metaSpendForDate = marketingSpend
        .filter((spend) => {
            const spendDate = spend.date.split('T')[0];
            return spendDate === dateStr;
        })
        .reduce((sum, spend) => sum + spend.amount, 0);

    let message = `📊 *Daily Sales Summary*\n\n`;
    message += `📅 *Date:* ${date}\n\n`;

    if (Object.keys(platformNewTotals).length > 0) {
        message += `*Platform-wise (New Orders Only):*\n`;
        Object.entries(platformNewTotals)
            .sort((a, b) => b[1] - a[1])
            .forEach(([platform, total]) => {
                message += `• ${platform}: ${formatCurrency(total)}\n`;
            });
        message += `\n`;
    }

    if (Object.keys(platformRepeatTotals).length > 0) {
        message += `*Platform-wise (Repeat Orders Only):*\n`;
        Object.entries(platformRepeatTotals)
            .sort((a, b) => b[1] - a[1])
            .forEach(([platform, total]) => {
                message += `• ${platform}: ${formatCurrency(total)}\n`;
            });
        message += `\n`;
    }

    const grandTotal = orders.reduce((sum, o) => sum + o.amount, 0);
    message += `💰 *Grand Total:* ${formatCurrency(grandTotal)}\n\n`;
    message += `📊 *Meta Spend:* ${formatCurrency(metaSpendForDate)}`;

    return message;
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

export function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return <td className="shopify-td" style={style}>{children}</td>;
}

export function StatusFilter<T extends string>({
    label,
    value,
    onChange,
    options,
    layout = 'default',
}: {
    label: string;
    value: T | '';
    onChange: (val: T | '') => void;
    options: T[];
    /** `ribbon`: compact pill used on Shopify filter bar */
    layout?: 'default' | 'ribbon';
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
            label: opt,
            icon: statusFilterOptionIcon(label, opt),
        }));
        return [all, ...rest];
    }, [label, options]);

    return (
        <div className={`shopify-status-filter${ribbon ? ' shopify-status-filter--ribbon' : ''}`}>
            <label className={ribbon ? 'shopify-status-filter__label' : 'label'}>{label}</label>
            <ModernSelect<T>
                variant={ribbon ? 'ribbon' : 'default'}
                className={ribbon ? 'shopify-status-filter__modern' : 'shopify-status-filter__modern shopify-status-filter__modern--stacked'}
                value={value}
                onChange={onChange}
                options={modernOptions}
                aria-label={label}
            />
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
    const mod =
        kind === 'Delivered'
            ? 'shopify-delivery-tag--delivered'
            : kind === 'In Transit'
              ? 'shopify-delivery-tag--transit'
              : kind === 'Pending Pickup'
                ? 'shopify-delivery-tag--pending'
                : kind === 'RTO'
                  ? 'shopify-delivery-tag--rto'
                  : 'shopify-delivery-tag--default';
    return <span className={`shopify-delivery-tag ${mod}`}>{kind}</span>;
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
