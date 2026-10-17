import { useCallback, useEffect, useMemo, useState } from 'react';
import { ModernSelect, type ModernSelectOption } from '../Shopify/ShopifyShared';
import '../Shopify/Shopify.scss';
import '../../Modules/Modules.scss';
import './SupplyVsDemand.scss';

type DayRow = {
    dateKey: string;
    demandCount: string;
    demandAmount: string;
    supplyCount: string;
    supplyAmount: string;
    rtoCount: string;
    rtoAmount: string;
};

type SavedDayRow = Partial<DayRow> & {
    /** Legacy fields from earlier UI versions. */
    demand?: string;
    supply?: string;
    shipmentAmount?: string;
    totalAmount?: string;
};

const MONTH_OPTIONS: ModernSelectOption<string>[] = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
];

const STORAGE_PREFIX = 'ph-supply-vs-demand:';

function buildYearOptions(): ModernSelectOption<string>[] {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, index) => {
        const year = String(currentYear + 1 - index);
        return { value: year, label: year };
    });
}

function daysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
}

function pad2(n: number): string {
    return String(n).padStart(2, '0');
}

function dateKey(year: number, month: number, day: number): string {
    return `${year}-${pad2(month)}-${pad2(day)}`;
}

function formatDayLabel(year: number, month: number, day: number): string {
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function parseNum(value: string): number {
    const n = Number(String(value).replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : 0;
}

function formatAmount(n: number): string {
    return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function emptyRow(key: string): DayRow {
    return {
        dateKey: key,
        demandCount: '',
        demandAmount: '',
        supplyCount: '',
        supplyAmount: '',
        rtoCount: '',
        rtoAmount: '',
    };
}

function normalizeSavedRow(key: string, row: SavedDayRow | undefined): DayRow {
    if (!row) return emptyRow(key);
    return {
        dateKey: key,
        demandCount: String(row.demandCount ?? row.demand ?? ''),
        demandAmount: String(row.demandAmount ?? ''),
        supplyCount: String(row.supplyCount ?? row.supply ?? ''),
        supplyAmount: String(row.supplyAmount ?? row.shipmentAmount ?? ''),
        rtoCount: String(row.rtoCount ?? ''),
        rtoAmount: String(row.rtoAmount ?? ''),
    };
}

function loadMonthRows(year: number, month: number): DayRow[] {
    const totalDays = daysInMonth(year, month);
    const keys = Array.from({ length: totalDays }, (_, i) => dateKey(year, month, i + 1));
    let saved: Record<string, SavedDayRow> = {};
    try {
        const raw = localStorage.getItem(`${STORAGE_PREFIX}${year}-${pad2(month)}`);
        if (raw) {
            const parsed = JSON.parse(raw) as unknown;
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                saved = parsed as Record<string, SavedDayRow>;
            }
        }
    } catch {
        saved = {};
    }
    return keys.map((key) => normalizeSavedRow(key, saved[key]));
}

function saveMonthRows(year: number, month: number, rows: DayRow[]) {
    const payload: Record<string, Omit<DayRow, 'dateKey'>> = {};
    for (const row of rows) {
        if (
            !row.demandCount &&
            !row.demandAmount &&
            !row.supplyCount &&
            !row.supplyAmount &&
            !row.rtoCount &&
            !row.rtoAmount
        ) {
            continue;
        }
        payload[row.dateKey] = {
            demandCount: row.demandCount,
            demandAmount: row.demandAmount,
            supplyCount: row.supplyCount,
            supplyAmount: row.supplyAmount,
            rtoCount: row.rtoCount,
            rtoAmount: row.rtoAmount,
        };
    }
    localStorage.setItem(`${STORAGE_PREFIX}${year}-${pad2(month)}`, JSON.stringify(payload));
}

function AmountInput({
    value,
    onChange,
    ariaLabel,
    placeholder = 'Amount',
}: {
    value: string;
    onChange: (value: string) => void;
    ariaLabel: string;
    placeholder?: string;
}) {
    return (
        <div className="svd-amount-wrap">
            <span className="svd-amount-wrap__prefix" aria-hidden>
                ₹
            </span>
            <input
                className="svd-input svd-input--amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                aria-label={ariaLabel}
            />
        </div>
    );
}

function CountInput({
    value,
    onChange,
    ariaLabel,
    placeholder = 'Count',
}: {
    value: string;
    onChange: (value: string) => void;
    ariaLabel: string;
    placeholder?: string;
}) {
    return (
        <input
            className="svd-input"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={ariaLabel}
        />
    );
}

export default function SupplyVsDemand() {
    const now = new Date();
    const [month, setMonth] = useState(String(now.getMonth() + 1));
    const [year, setYear] = useState(String(now.getFullYear()));
    const [rows, setRows] = useState<DayRow[]>(() =>
        loadMonthRows(now.getFullYear(), now.getMonth() + 1),
    );
    const yearOptions = useMemo(() => buildYearOptions(), []);

    const yearNum = Number(year);
    const monthNum = Number(month);

    useEffect(() => {
        setRows(loadMonthRows(yearNum, monthNum));
    }, [yearNum, monthNum]);

    const updateRow = useCallback(
        (dateKeyValue: string, field: keyof Omit<DayRow, 'dateKey'>, value: string) => {
            setRows((prev) => {
                const next = prev.map((row) =>
                    row.dateKey === dateKeyValue ? { ...row, [field]: value } : row,
                );
                saveMonthRows(yearNum, monthNum, next);
                return next;
            });
        },
        [yearNum, monthNum],
    );

    const totals = useMemo(() => {
        let demandCount = 0;
        let demandAmount = 0;
        let supplyCount = 0;
        let supplyAmount = 0;
        let rtoCount = 0;
        let rtoAmount = 0;
        for (const row of rows) {
            demandCount += parseNum(row.demandCount);
            demandAmount += parseNum(row.demandAmount);
            supplyCount += parseNum(row.supplyCount);
            supplyAmount += parseNum(row.supplyAmount);
            rtoCount += parseNum(row.rtoCount);
            rtoAmount += parseNum(row.rtoAmount);
        }
        return {
            demandCount,
            demandAmount,
            supplyCount,
            supplyAmount,
            rtoCount,
            rtoAmount,
            difference: supplyCount - demandCount,
        };
    }, [rows]);

    const monthLabel = MONTH_OPTIONS.find((m) => m.value === month)?.label ?? month;

    return (
        <div className="svd-page">
            <div className="card shopify-header-card shopify-header-card--orders svd-header">
                <div className="shopify-header-top">
                    <h2 className="shopify-header-title">Supply Vs Demand</h2>
                    <p className="svd-header__sub">
                        Track daily demand and supply for {monthLabel} {year}
                    </p>
                </div>

                <div className="svd-filters">
                    <div className="svd-filter">
                        <span className="svd-filter__lab">Month</span>
                        <ModernSelect<string>
                            value={month}
                            onChange={setMonth}
                            options={MONTH_OPTIONS}
                            aria-label="Month"
                        />
                    </div>
                    <div className="svd-filter">
                        <span className="svd-filter__lab">Year</span>
                        <ModernSelect<string>
                            value={year}
                            onChange={setYear}
                            options={yearOptions}
                            aria-label="Year"
                        />
                    </div>
                    <div className="svd-summary">
                        <div className="svd-summary__item">
                            <span className="svd-summary__lab">Demand</span>
                            <span className="svd-summary__hint">Shipment count</span>
                            <strong>{formatAmount(totals.demandCount)}</strong>
                            <span className="svd-summary__amount">
                                ₹{formatAmount(totals.demandAmount)}
                            </span>
                        </div>
                        <div className="svd-summary__item">
                            <span className="svd-summary__lab">Supply</span>
                            <span className="svd-summary__hint">Shipment count</span>
                            <strong>{formatAmount(totals.supplyCount)}</strong>
                            <span className="svd-summary__amount">
                                ₹{formatAmount(totals.supplyAmount)}
                            </span>
                        </div>
                        <div className="svd-summary__item svd-summary__item--rto">
                            <span className="svd-summary__lab">RTO</span>
                            <span className="svd-summary__hint">Shipment count</span>
                            <strong>{formatAmount(totals.rtoCount)}</strong>
                            <span className="svd-summary__amount">
                                ₹{formatAmount(totals.rtoAmount)}
                            </span>
                        </div>
                        <div
                            className={`svd-summary__item${
                                totals.difference === 0
                                    ? ' svd-summary__item--pos'
                                    : ' svd-summary__item--neg'
                            }`}
                        >
                            <span className="svd-summary__lab">Difference</span>
                            <span className="svd-summary__hint">Supply − Demand (count)</span>
                            <strong>{formatAmount(totals.difference)}</strong>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card modules-table-card svd-table-card">
                <div className="table-scroll-wrapper">
                    <table className="modules-table svd-table">
                        <thead>
                            <tr>
                                <th className="modules-th svd-th-date" rowSpan={2}>
                                    Date
                                </th>
                                <th className="modules-th svd-th-group svd-th-group--demand svd-col--demand-start" colSpan={2}>
                                    Demand
                                </th>
                                <th className="modules-th svd-th-group svd-th-group--supply svd-col--supply-start" colSpan={2}>
                                    Supply
                                </th>
                                <th className="modules-th svd-th-group svd-th-group--rto svd-col--rto-start" colSpan={2}>
                                    RTO
                                </th>
                                <th className="modules-th svd-col--diff-start" rowSpan={2}>
                                    <span className="svd-th-main">Difference</span>
                                    <span className="svd-th-sub">Supply − Demand</span>
                                </th>
                            </tr>
                            <tr>
                                <th className="modules-th svd-th-subcol svd-th-subcol--demand svd-col--demand-start">
                                    <span className="svd-th-main">Shipment count</span>
                                </th>
                                <th className="modules-th svd-th-subcol svd-th-subcol--demand">
                                    <span className="svd-th-main">Amount</span>
                                </th>
                                <th className="modules-th svd-th-subcol svd-th-subcol--supply svd-col--supply-start">
                                    <span className="svd-th-main">Shipment count</span>
                                </th>
                                <th className="modules-th svd-th-subcol svd-th-subcol--supply">
                                    <span className="svd-th-main">Amount</span>
                                </th>
                                <th className="modules-th svd-th-subcol svd-th-subcol--rto svd-col--rto-start">
                                    <span className="svd-th-main">Shipment count</span>
                                </th>
                                <th className="modules-th svd-th-subcol svd-th-subcol--rto">
                                    <span className="svd-th-main">Amount</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="svd-foot svd-foot--top">
                                <td>Month total</td>
                                <td className="svd-col--demand svd-col--demand-start">{formatAmount(totals.demandCount)}</td>
                                <td className="svd-col--demand">₹{formatAmount(totals.demandAmount)}</td>
                                <td className="svd-col--supply svd-col--supply-start">{formatAmount(totals.supplyCount)}</td>
                                <td className="svd-col--supply">₹{formatAmount(totals.supplyAmount)}</td>
                                <td className="svd-col--rto svd-col--rto-start">{formatAmount(totals.rtoCount)}</td>
                                <td className="svd-col--rto">₹{formatAmount(totals.rtoAmount)}</td>
                                <td
                                    className={`svd-col--diff-start${
                                        totals.difference === 0 ? ' svd-diff--pos' : ' svd-diff--neg'
                                    }`}
                                >
                                    {formatAmount(totals.difference)}
                                </td>
                            </tr>
                            {rows.map((row, index) => {
                                const day = index + 1;
                                const demandCount = parseNum(row.demandCount);
                                const supplyCount = parseNum(row.supplyCount);
                                const difference = supplyCount - demandCount;
                                const hasCountInputs = Boolean(row.demandCount || row.supplyCount);
                                return (
                                    <tr key={row.dateKey} className="svd-row">
                                        <td className="svd-date-cell" data-label="Date">
                                            <span className="svd-date-cell__day">{pad2(day)}</span>
                                            <span className="svd-date-cell__label">
                                                {formatDayLabel(yearNum, monthNum, day)}
                                            </span>
                                        </td>
                                        <td className="svd-col--demand svd-col--demand-start" data-label="Demand · Shipment count">
                                            <CountInput
                                                value={row.demandCount}
                                                placeholder="Count"
                                                ariaLabel={`Demand shipment count for ${row.dateKey}`}
                                                onChange={(value) =>
                                                    updateRow(row.dateKey, 'demandCount', value)
                                                }
                                            />
                                        </td>
                                        <td className="svd-col--demand" data-label="Demand · Amount">
                                            <AmountInput
                                                value={row.demandAmount}
                                                ariaLabel={`Demand amount for ${row.dateKey}`}
                                                onChange={(value) =>
                                                    updateRow(row.dateKey, 'demandAmount', value)
                                                }
                                            />
                                        </td>
                                        <td className="svd-col--supply svd-col--supply-start" data-label="Supply · Shipment count">
                                            <CountInput
                                                value={row.supplyCount}
                                                placeholder="Count"
                                                ariaLabel={`Supply shipment count for ${row.dateKey}`}
                                                onChange={(value) =>
                                                    updateRow(row.dateKey, 'supplyCount', value)
                                                }
                                            />
                                        </td>
                                        <td className="svd-col--supply" data-label="Supply · Amount">
                                            <AmountInput
                                                value={row.supplyAmount}
                                                ariaLabel={`Supply amount for ${row.dateKey}`}
                                                onChange={(value) =>
                                                    updateRow(row.dateKey, 'supplyAmount', value)
                                                }
                                            />
                                        </td>
                                        <td className="svd-col--rto svd-col--rto-start" data-label="RTO · Shipment count">
                                            <CountInput
                                                value={row.rtoCount}
                                                placeholder="Count"
                                                ariaLabel={`RTO shipment count for ${row.dateKey}`}
                                                onChange={(value) =>
                                                    updateRow(row.dateKey, 'rtoCount', value)
                                                }
                                            />
                                        </td>
                                        <td className="svd-col--rto" data-label="RTO · Amount">
                                            <AmountInput
                                                value={row.rtoAmount}
                                                ariaLabel={`RTO amount for ${row.dateKey}`}
                                                onChange={(value) =>
                                                    updateRow(row.dateKey, 'rtoAmount', value)
                                                }
                                            />
                                        </td>
                                        <td className="svd-col--diff-start" data-label="Difference">
                                            <input
                                                className={`svd-input svd-input--diff${
                                                    hasCountInputs
                                                        ? difference === 0
                                                            ? ' svd-input--pos'
                                                            : ' svd-input--neg'
                                                        : ''
                                                }`}
                                                type="text"
                                                readOnly
                                                tabIndex={-1}
                                                value={hasCountInputs ? formatAmount(difference) : ''}
                                                placeholder="—"
                                                aria-label={`Difference for ${row.dateKey}`}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
