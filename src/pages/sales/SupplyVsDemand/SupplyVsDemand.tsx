import { useCallback, useEffect, useMemo, useState } from 'react';
import { Spinner } from '../../../components/Spinner';
import {
    buildMonthRows,
    fetchDemandSupply,
    saveDemandSupplyDay,
    type DemandSupplyDayRow,
} from '../../../utils/demand-supply';
import { ModernSelect, type ModernSelectOption } from '../Shopify/ShopifyShared';
import '../Shopify/Shopify.scss';
import '../../Modules/Modules.scss';
import './SupplyVsDemand.scss';

type DayRow = DemandSupplyDayRow;

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

function buildYearOptions(): ModernSelectOption<string>[] {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, index) => {
        const year = String(currentYear + 1 - index);
        return { value: year, label: year };
    });
}

function pad2(n: number): string {
    return String(n).padStart(2, '0');
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

function AmountInput({
    value,
    onChange,
    ariaLabel,
    placeholder = 'Amount',
    disabled,
}: {
    value: string;
    onChange: (value: string) => void;
    ariaLabel: string;
    placeholder?: string;
    disabled?: boolean;
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
                disabled={disabled}
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
    disabled,
}: {
    value: string;
    onChange: (value: string) => void;
    ariaLabel: string;
    placeholder?: string;
    disabled?: boolean;
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
            disabled={disabled}
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
        buildMonthRows(now.getFullYear(), now.getMonth() + 1),
    );
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [savingDate, setSavingDate] = useState<string | null>(null);
    const [saveFeedback, setSaveFeedback] = useState<Record<string, 'ok' | 'err'>>({});
    const yearOptions = useMemo(() => buildYearOptions(), []);

    const yearNum = Number(year);
    const monthNum = Number(month);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        setSaveFeedback({});
        setSavingDate(null);
        setRows(buildMonthRows(yearNum, monthNum));

        fetchDemandSupply(monthNum, yearNum)
            .then((next) => {
                if (!cancelled) setRows(next);
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load demand/supply');
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [yearNum, monthNum]);

    const updateRow = useCallback(
        (dateKeyValue: string, field: keyof Omit<DayRow, 'dateKey'>, value: string) => {
            setRows((prev) =>
                prev.map((row) =>
                    row.dateKey === dateKeyValue ? { ...row, [field]: value } : row,
                ),
            );
            setSaveFeedback((prev) => {
                if (!(dateKeyValue in prev)) return prev;
                const next = { ...prev };
                delete next[dateKeyValue];
                return next;
            });
        },
        [],
    );

    const handleSaveRow = useCallback(async (row: DayRow) => {
        setSavingDate(row.dateKey);
        setError(null);
        try {
            await saveDemandSupplyDay(row);
            setSaveFeedback((prev) => ({ ...prev, [row.dateKey]: 'ok' }));
        } catch (err) {
            setSaveFeedback((prev) => ({ ...prev, [row.dateKey]: 'err' }));
            setError(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setSavingDate(null);
        }
    }, []);

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
                            disabled={loading}
                        />
                    </div>
                    <div className="svd-filter">
                        <span className="svd-filter__lab">Year</span>
                        <ModernSelect<string>
                            value={year}
                            onChange={setYear}
                            options={yearOptions}
                            aria-label="Year"
                            disabled={loading}
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
                {error ? <p className="svd-error">{error}</p> : null}
            </div>

            <div className="card modules-table-card svd-table-card">
                {loading ? <Spinner overlay message="Loading demand & supply…" /> : null}
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
                                <th className="modules-th svd-th-action" rowSpan={2}>
                                    <span className="svd-th-main">Action</span>
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
                                <td className="svd-col--action" aria-hidden />
                            </tr>
                            {rows.map((row, index) => {
                                const day = index + 1;
                                const demandCount = parseNum(row.demandCount);
                                const supplyCount = parseNum(row.supplyCount);
                                const difference = supplyCount - demandCount;
                                const hasCountInputs = Boolean(row.demandCount || row.supplyCount);
                                const isSaving = savingDate === row.dateKey;
                                const feedback = saveFeedback[row.dateKey];
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
                                                disabled
                                                ariaLabel={`Demand shipment count for ${row.dateKey}`}
                                                onChange={(value) =>
                                                    updateRow(row.dateKey, 'demandCount', value)
                                                }
                                            />
                                        </td>
                                        <td className="svd-col--demand" data-label="Demand · Amount">
                                            <AmountInput
                                                value={row.demandAmount}
                                                disabled
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
                                                disabled={loading}
                                                ariaLabel={`Supply shipment count for ${row.dateKey}`}
                                                onChange={(value) =>
                                                    updateRow(row.dateKey, 'supplyCount', value)
                                                }
                                            />
                                        </td>
                                        <td className="svd-col--supply" data-label="Supply · Amount">
                                            <AmountInput
                                                value={row.supplyAmount}
                                                disabled={loading}
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
                                                disabled
                                                ariaLabel={`RTO shipment count for ${row.dateKey}`}
                                                onChange={(value) =>
                                                    updateRow(row.dateKey, 'rtoCount', value)
                                                }
                                            />
                                        </td>
                                        <td className="svd-col--rto" data-label="RTO · Amount">
                                            <AmountInput
                                                value={row.rtoAmount}
                                                disabled
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
                                        <td className="svd-col--action" data-label="Action">
                                            <button
                                                type="button"
                                                className={`svd-save-btn${
                                                    feedback === 'ok'
                                                        ? ' svd-save-btn--ok'
                                                        : feedback === 'err'
                                                          ? ' svd-save-btn--err'
                                                          : ''
                                                }`}
                                                disabled={loading || isSaving || savingDate != null}
                                                onClick={() => void handleSaveRow(row)}
                                            >
                                                {isSaving ? 'Saving…' : feedback === 'ok' ? 'Saved' : 'Save'}
                                            </button>
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
