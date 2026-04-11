import React, { useLayoutEffect, useMemo, useState } from 'react';
import type { Followup } from '../../utils/followups';
import { FollowupTableRow } from './FollowupTableRow';
import { Th } from './FollowupsTableCells';

/** Below this many rows, render the full table at once. */
const PROGRESSIVE_ROW_THRESHOLD = 45;
const PROGRESSIVE_INITIAL_ROWS = 25;
const PROGRESSIVE_CHUNK_ROWS = 55;

type Props = {
    loading: boolean;
    filtered: Followup[];
    baseFollowups: Followup[];
    onCustomerClick: (f: Followup) => void;
    onOpenHistory: (f: Followup) => void;
    onUpdate: (id: string, field: keyof Followup, value: string | null) => void;
};

export function FollowupsTable({
    loading,
    filtered,
    baseFollowups,
    onCustomerClick,
    onOpenHistory,
    onUpdate,
}: Props) {
    const totalRows = filtered.length;
    const useProgressive = totalRows > PROGRESSIVE_ROW_THRESHOLD;

    const [visibleRowCap, setVisibleRowCap] = useState(PROGRESSIVE_INITIAL_ROWS);

    useLayoutEffect(() => {
        if (!useProgressive) {
            setVisibleRowCap(totalRows);
            return;
        }
        const initial = Math.min(PROGRESSIVE_INITIAL_ROWS, totalRows);
        setVisibleRowCap(initial);
        if (initial >= totalRows) return;

        let cancelled = false;
        let cap = initial;
        let idleId = 0;
        let rafId = 0;

        const bump = () => {
            if (cancelled) return;
            cap = Math.min(totalRows, cap + PROGRESSIVE_CHUNK_ROWS);
            setVisibleRowCap(cap);
            if (cap < totalRows) scheduleNext();
        };

        const scheduleNext = () => {
            if (cancelled) return;
            if (typeof requestIdleCallback !== 'undefined') {
                idleId = requestIdleCallback(bump, { timeout: 200 });
            } else {
                rafId = requestAnimationFrame(bump);
            }
        };

        scheduleNext();

        return () => {
            cancelled = true;
            if (idleId !== 0) cancelIdleCallback(idleId);
            if (rafId !== 0) cancelAnimationFrame(rafId);
        };
    }, [filtered, totalRows, useProgressive]);

    const displayRows = useMemo(() => {
        if (!useProgressive || visibleRowCap >= totalRows) {
            return filtered;
        }
        return filtered.slice(0, visibleRowCap);
    }, [filtered, totalRows, useProgressive, visibleRowCap]);

    return (
        <>
            {!loading && useProgressive && visibleRowCap < totalRows ? (
                <div className="fu-table-progressive-hint" aria-live="polite">
                    Showing {Math.min(visibleRowCap, totalRows).toLocaleString()} of {totalRows.toLocaleString()} rows…
                </div>
            ) : null}
            <div className="table-scroll-wrapper">
                <table className="fu-table fu-table--followups">
                    <colgroup>
                        <col className="fu-col fu-col--call" />
                        <col className="fu-col fu-col--200" />
                        <col className="fu-col fu-col--148" />
                        <col className="fu-col fu-col--100" />
                        <col className="fu-col fu-col--180" />
                        <col className="fu-col fu-col--flex140" />
                        <col className="fu-col fu-col--180" />
                        <col className="fu-col fu-col--200" />
                        <col className="fu-col fu-col--180" />
                    </colgroup>
                    <thead>
                        <tr className="fu-table__head-row">
                            <Th className="fu-th--call-col">Call</Th>
                            <Th>Customer</Th>
                            <Th>Last Order</Th>
                            <Th>Total Orders</Th>
                            <Th>Last Order</Th>
                            <Th>Feedback</Th>
                            <Th>Calling Date</Th>
                            <Th>Calling Detail</Th>
                            <Th>Call Again Date</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {!loading
                            ? displayRows.map((f) => (
                                  <FollowupTableRow
                                      key={f.id}
                                      followup={f}
                                      onCustomerClick={onCustomerClick}
                                      onOpenHistory={onOpenHistory}
                                      onUpdate={onUpdate}
                                  />
                              ))
                            : null}
                        {!loading && filtered.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="fu-table-empty">
                                    {baseFollowups.length > 0
                                        ? 'No rows match your filters. Use Clear all in the Filters panel.'
                                        : 'No followups found'}
                                </td>
                            </tr>
                        ) : null}
                    </tbody>
                </table>
            </div>
        </>
    );
}
