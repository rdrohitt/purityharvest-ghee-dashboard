import React from 'react';

type Props = {
    loading: boolean;
    visibleCount: number;
    dashboardMeta: { total: number } | null;
    totalRecords: number;
};

export function FollowupsHeader({ loading, visibleCount, dashboardMeta, totalRecords }: Props) {
    return (
        <header className="fu-top">
            <div className="fu-top__lead">
                <h1 className="fu-title">Followups</h1>
                <p className="fu-sub">Customer call queue and follow-up dates</p>
            </div>
            <div className="fu-top__meta">
                <span className="fu-count-pill" title={loading ? undefined : 'Rows on this page after filters'}>
                    <span className="fu-count-pill__n">{loading ? '—' : visibleCount}</span>
                    <span className="fu-count-pill__lbl">{loading ? 'Loading…' : 'visible'}</span>
                </span>
                <span
                    className="fu-count-pill fu-count-pill--total"
                    title={loading || dashboardMeta == null ? undefined : 'Total followup records from server'}
                >
                    <span className="fu-count-pill__n">{loading || dashboardMeta == null ? '—' : totalRecords.toLocaleString()}</span>
                    <span className="fu-count-pill__lbl">{loading ? '…' : 'total'}</span>
                </span>
            </div>
        </header>
    );
}
