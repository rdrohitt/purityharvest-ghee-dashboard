import React from 'react';
import type { Followup } from '../../utils/followups';
import { FollowupTableRow } from './FollowupTableRow';
import { Th } from './FollowupsTableCells';

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
    return (
        <>
            <div className="table-scroll-wrapper">
                <table className="fu-table fu-table--followups">
                    <colgroup>
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
                            ? filtered.map((f) => (
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
                                <td colSpan={8} className="fu-table-empty">
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
