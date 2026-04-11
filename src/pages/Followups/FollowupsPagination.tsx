import React from 'react';
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
            <label className="fu-pagination__size">
                <span className="fu-pagination__size-lab">Rows per page</span>
                <select
                    className="fu-pagination__select"
                    value={pageSize}
                    disabled={loading}
                    aria-label="Rows per page"
                    onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                    }}
                >
                    {pageSizeOptions.map((n) => (
                        <option key={n} value={n}>
                            {n}
                        </option>
                    ))}
                </select>
            </label>
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
