import { useMemo, useState, type ReactNode } from 'react';
import { PlatformTag } from '../sales/Shopify/ShopifyShared';
import '../sales/Shopify/Shopify.scss';
import '../Modules/Modules.scss';
import './Performance.scss';

type PerformanceViewTab = 'platform' | 'month';

const PERFORMANCE_VIEW_TABS: { id: PerformanceViewTab; label: string }[] = [
    { id: 'platform', label: 'Platform Wise' },
    { id: 'month', label: 'Month Wise' },
];

type PlatformPerformanceRow = {
    platform: string;
    orders: number;
    sales: number;
    ebitda: number;
    marketingSpend: number;
};

type MonthPerformanceRow = {
    month: string;
    orders: number;
    sales: number;
    ebitda: number;
    marketingSpend: number;
};

function formatCurrency(value: number): string {
    return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function PerformanceTh({ children }: { children: string }) {
    return <th className="modules-th">{children}</th>;
}

function PerformanceTd({ children, className }: { children: ReactNode; className?: string }) {
    const cls = className ? `modules-td ${className}` : 'modules-td';
    return <td className={cls}>{children}</td>;
}

function PlatformWiseTable({ rows }: { rows: PlatformPerformanceRow[] }) {
    return (
        <div className="table-scroll-wrapper">
            <table className="modules-table performance-table">
                <thead>
                    <tr className="modules-row-header">
                        <PerformanceTh>Platform</PerformanceTh>
                        <PerformanceTh>Orders</PerformanceTh>
                        <PerformanceTh>Sales</PerformanceTh>
                        <PerformanceTh>EBITDA</PerformanceTh>
                        <PerformanceTh>Marketing Spend</PerformanceTh>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.platform} className="modules-row">
                            <PerformanceTd>
                                <PlatformTag platform={row.platform} />
                            </PerformanceTd>
                            <PerformanceTd className="performance-amount">{row.orders.toLocaleString('en-IN')}</PerformanceTd>
                            <PerformanceTd className="performance-amount">{formatCurrency(row.sales)}</PerformanceTd>
                            <PerformanceTd className="performance-amount">{formatCurrency(row.ebitda)}</PerformanceTd>
                            <PerformanceTd className="performance-amount">{formatCurrency(row.marketingSpend)}</PerformanceTd>
                        </tr>
                    ))}
                    {rows.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="modules-empty">
                                No platform performance data yet.
                            </td>
                        </tr>
                    ) : null}
                </tbody>
            </table>
        </div>
    );
}

function MonthWiseTable({ rows }: { rows: MonthPerformanceRow[] }) {
    return (
        <div className="table-scroll-wrapper">
            <table className="modules-table performance-table">
                <thead>
                    <tr className="modules-row-header">
                        <PerformanceTh>Month</PerformanceTh>
                        <PerformanceTh>Orders</PerformanceTh>
                        <PerformanceTh>Sales</PerformanceTh>
                        <PerformanceTh>EBITDA</PerformanceTh>
                        <PerformanceTh>Marketing Spend</PerformanceTh>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.month} className="modules-row">
                            <PerformanceTd className="performance-month-cell">{row.month}</PerformanceTd>
                            <PerformanceTd className="performance-amount">{row.orders.toLocaleString('en-IN')}</PerformanceTd>
                            <PerformanceTd className="performance-amount">{formatCurrency(row.sales)}</PerformanceTd>
                            <PerformanceTd className="performance-amount">{formatCurrency(row.ebitda)}</PerformanceTd>
                            <PerformanceTd className="performance-amount">{formatCurrency(row.marketingSpend)}</PerformanceTd>
                        </tr>
                    ))}
                    {rows.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="modules-empty">
                                No month-wise performance data yet.
                            </td>
                        </tr>
                    ) : null}
                </tbody>
            </table>
        </div>
    );
}

export default function Performance() {
    const [viewTab, setViewTab] = useState<PerformanceViewTab>('platform');

    const platformRows = useMemo<PlatformPerformanceRow[]>(() => [], []);
    const monthRows = useMemo<MonthPerformanceRow[]>(() => [], []);

    const countBarLabel = useMemo(() => {
        if (viewTab === 'platform') {
            const count = platformRows.length;
            return count === 0
                ? 'Platform performance overview'
                : `${count.toLocaleString()} platform${count === 1 ? '' : 's'}`;
        }
        const count = monthRows.length;
        return count === 0
            ? 'Month-wise performance overview'
            : `${count.toLocaleString()} month${count === 1 ? '' : 's'}`;
    }, [viewTab, platformRows.length, monthRows.length]);

    return (
        <section className="modules-page">
            <div className="card modules-header-card">
                <div className="modules-header-title">Performance</div>
                <div className="modules-header-row performance-page-header-row">
                    <div className="performance-view-tabs" role="tablist" aria-label="Performance view">
                        {PERFORMANCE_VIEW_TABS.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={viewTab === tab.id}
                                id={`performance-view-tab-${tab.id}`}
                                className={`performance-view-tab performance-view-tab--${tab.id}${
                                    viewTab === tab.id ? ' is-active' : ''
                                }`}
                                onClick={() => setViewTab(tab.id)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="card modules-table-card">
                <div className="modules-count-bar">{countBarLabel}</div>
                {viewTab === 'platform' ? <PlatformWiseTable rows={platformRows} /> : <MonthWiseTable rows={monthRows} />}
            </div>
        </section>
    );
}
