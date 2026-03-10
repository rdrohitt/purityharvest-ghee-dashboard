import type { Order } from '../../../utils/orders';
import type { Platform, OrderType } from '../../../utils/orders';
import type { SpendRecord } from '../../../utils/marketing-spend';

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
}: {
    label: string;
    value: T | '';
    onChange: (val: T | '') => void;
    options: T[];
}) {
    return (
        <div className="shopify-status-filter">
            <label className="label">{label}</label>
            <select
                className="input"
                value={value}
                onChange={(e) => onChange(e.target.value as T | '')}
            >
                <option value="">All</option>
                {options.map((opt) => (
                    <option key={opt} value={opt}>
                        {opt}
                    </option>
                ))}
            </select>
        </div>
    );
}

export function StatusTag({ kind, type }: { kind: string; type: 'payment' | 'delivery' }) {
    let cls = 'tag info';
    if (type === 'payment') {
        if (kind === 'PAID') cls = 'tag success';
        else if (kind === 'COD') cls = 'tag warning';
        else cls = 'tag info';
    } else {
        if (kind === 'Delivered') cls = 'tag success shopify-tag-delivered';
        else if (kind === 'In Transit') cls = 'tag info';
        else if (kind === 'Pending Pickup') cls = 'tag warning';
        else if (kind === 'RTO') cls = 'tag danger';
    }
    return <span className={cls}>{kind}</span>;
}

export function PlatformTag({ platform }: { platform?: Platform | string }) {
    if (!platform) return <span>—</span>;
    const modifier =
        platform === 'Shopify' ? 'shopify-platform-tag--shopify' :
        platform === 'Whatsapp' ? 'shopify-platform-tag--whatsapp' :
        platform === 'Abandoned' ? 'shopify-platform-tag--abandoned' :
        'shopify-platform-tag--default';
    return <span className={`shopify-platform-tag ${modifier}`}>{platform}</span>;
}

export function TypeTag({ type }: { type?: OrderType | string }) {
    if (!type) return <span>—</span>;
    const modifier =
        type === 'New' ? 'shopify-type-tag--new' :
        type === 'Repeat' ? 'shopify-type-tag--repeat' :
        type === 'Reference' ? 'shopify-type-tag--reference' :
        'shopify-type-tag--default';
    return <span className={`shopify-type-tag ${modifier}`}>{type}</span>;
}
