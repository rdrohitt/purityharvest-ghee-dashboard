import type { Followup } from '../../utils/followups';

export type FollowupsFilterParams = {
    searchQuery: string;
    callerFilter: string;
    feedbackFilter: string;
    monthFilter: string;
    yearFilter: string;
    callingDateFilter: string;
    upcomingFilter: string;
};

export function filterFollowups(rows: Followup[], p: FollowupsFilterParams): Followup[] {
    const now = new Date();
    return rows.filter((f) => {
        const matchesSearch =
            !p.searchQuery ||
            f.customerName.toLowerCase().includes(p.searchQuery.toLowerCase()) ||
            f.customerPhone.includes(p.searchQuery);

        const matchesCaller = !p.callerFilter || f.callerName === p.callerFilter;
        const matchesFeedback = !p.feedbackFilter || f.feedback === p.feedbackFilter;

        let matchesDate = true;
        if (p.monthFilter || p.yearFilter) {
            const lastOrderDate = new Date(f.lastOrder);
            const orderMonth = lastOrderDate.getMonth() + 1;
            const orderYear = lastOrderDate.getFullYear();

            if (p.monthFilter && orderMonth !== parseInt(p.monthFilter, 10)) {
                matchesDate = false;
            }
            if (p.yearFilter && matchesDate && orderYear !== parseInt(p.yearFilter, 10)) {
                matchesDate = false;
            }
        }

        let matchesCallingDate = true;
        if (p.callingDateFilter) {
            if (p.callingDateFilter === 'no-calling-date') {
                matchesCallingDate = !f.callingDate;
            } else if (!f.callingDate) {
                matchesCallingDate = false;
            } else {
                const callingDate = new Date(f.callingDate);
                const daysDiff = Math.floor((now.getTime() - callingDate.getTime()) / (1000 * 60 * 60 * 24));
                const threshold = parseInt(p.callingDateFilter.replace('more-than-', '').replace('-days', ''), 10);
                matchesCallingDate = daysDiff > threshold;
            }
        }

        let matchesUpcoming = true;
        if (p.upcomingFilter) {
            if (!f.callAgainDate) {
                matchesUpcoming = false;
            } else {
                const callAgainDate = new Date(f.callAgainDate);
                const today = new Date(now);
                today.setHours(0, 0, 0, 0);
                callAgainDate.setHours(0, 0, 0, 0);
                const daysFromNow = Math.floor((callAgainDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                if (p.upcomingFilter === 'today') {
                    matchesUpcoming = daysFromNow === 0;
                } else if (p.upcomingFilter === 'next-2-days') {
                    matchesUpcoming = daysFromNow >= 0 && daysFromNow <= 2;
                } else if (p.upcomingFilter === 'next-7-days') {
                    matchesUpcoming = daysFromNow >= 0 && daysFromNow <= 7;
                } else if (p.upcomingFilter === 'next-15-days') {
                    matchesUpcoming = daysFromNow >= 0 && daysFromNow <= 15;
                }
            }
        }

        return (
            matchesSearch &&
            matchesCaller &&
            matchesFeedback &&
            matchesDate &&
            matchesCallingDate &&
            matchesUpcoming
        );
    });
}
