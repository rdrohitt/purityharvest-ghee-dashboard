import React, { useMemo } from 'react';
import { ModernSelect, type ModernSelectOption } from '../sales/Shopify/ShopifyShared';
import { FOLLOWUPS_PAGE_SIZE_OPTIONS } from './followupsConstants';

type DashboardMeta = {
    total: number;
    totalPages: number;
    count: number;
    page: number;
    limit: number;
};

type Props = {
    loading: boolean;
    dashboardMeta: DashboardMeta | null;
    totalRecords: number;
    totalPages: number;
    rangeStart: number;
    rangeEnd: number;
    page: number;
    pageSize: number;
    setPage: React.Dispatch<React.SetStateAction<number>>;
    setPageSize: React.Dispatch<React.SetStateAction<number>>;
    /** Defaults to followups page-size options. */
    pageSizeOptions?: readonly number[];
    /** `aria-label` on the pagination footer. */
    ariaLabel?: string;
};

export function FollowupsPagination({
    loading,
    dashboardMeta,
    totalRecords,
    totalPages,
    rangeStart,
    rangeEnd,
    page,
    pageSize,
    setPage,
    setPageSize,
    pageSizeOptions = FOLLOWUPS_PAGE_SIZE_OPTIONS,
    ariaLabel = 'Followups pagination',
}: Props) {
    const sizeOptions = useMemo((): ModernSelectOption<string>[] => {
        return pageSizeOptions.map((n) => ({ value: String(n), label: String(n) }));
    }, [pageSizeOptions]);

    return (
        <footer className="fu-pagination" aria-label={ariaLabel}>
            <div className="fu-pagination__range">
                {loading ? (
                    <span className="fu-pagination__muted">Loading…</span>
                ) : dashboardMeta ? (
                    dashboardMeta.count === 0 && totalRecords > 0 ? (
                        <>
                            No rows on this page · <strong>{totalRecords.toLocaleString()}</strong> total
                        </>
                    ) : (
                        <>
                            Showing{' '}
                            <strong>
                                {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()}
                            </strong>{' '}
                            of <strong>{totalRecords.toLocaleString()}</strong>
                        </>
                    )
                ) : (
                    <span className="fu-pagination__muted">Total unavailable</span>
                )}
            </div>
            <div className="fu-pagination__size" role="group" aria-labelledby="fu-pagination-rows-label">
                <span className="fu-pagination__size-lab" id="fu-pagination-rows-label">
                    Rows per page
                </span>
                <ModernSelect<string>
                    className="fu-pagination__modern-select"
                    value={String(pageSize)}
                    onChange={(v) => {
                        if (!v) return;
                        const n = Number(v);
                        if (Number.isFinite(n)) {
                            setPageSize(n);
                            setPage(1);
                        }
                    }}
                    options={sizeOptions}
                    disabled={loading}
                    aria-label="Rows per page"
                />
            </div>
            <div className="fu-pagination__nav">
                <button type="button" className="fu-page-btn" disabled={loading || page <= 1} onClick={() => setPage(1)}>
                    First
                </button>
                <button
                    type="button"
                    className="fu-page-btn"
                    disabled={loading || page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                    Prev
                </button>
                <span className="fu-pagination__page-of">
                    Page <strong>{page}</strong> of <strong>{totalPages}</strong>
                </span>
                <button
                    type="button"
                    className="fu-page-btn"
                    disabled={loading || page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                >
                    Next
                </button>
                <button
                    type="button"
                    className="fu-page-btn"
                    disabled={loading || page >= totalPages}
                    onClick={() => setPage(totalPages)}
                >
                    Last
                </button>
            </div>
        </footer>
    );
}
