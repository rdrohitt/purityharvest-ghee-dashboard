import React, { useMemo } from 'react';
import { ModernSelect, type ModernSelectOption } from '../sales/Shopify/ShopifyShared';
import {
    CALLER_OPTIONS,
    FEEDBACK_OPTIONS,
    FOLLOWUPS_CALL_AGAIN_VALUES,
    FOLLOWUPS_LAST_CALLING_DATE_VALUES,
} from './followupsConstants';
import { StatusFilter } from './FollowupFilterControls';
import { getFeedbackEmoji, getFeedbackSelectClass } from './followupsFormat';

const LAST_CALLING_DATE_LABELS: Record<(typeof FOLLOWUPS_LAST_CALLING_DATE_VALUES)[number], string> = {
    '': 'All',
    'no-calling-date': 'No date',
    'more-than-15-days': '> 15 days',
    'more-than-30-days': '> 30 days',
    'more-than-45-days': '> 45 days',
    'more-than-60-days': '> 60 days',
};

const CALL_AGAIN_LABELS: Record<(typeof FOLLOWUPS_CALL_AGAIN_VALUES)[number], string> = {
    '': 'All',
    today: 'Today',
    'next-2-days': 'Next 2 days',
    'next-7-days': 'Next 7 days',
    'next-15-days': 'Next 15 days',
};

type MonthOpt = { value: string; label: string };
type YearOpt = { value: string; label: string };

type Props = {
    searchQuery: string;
    setSearchQuery: (v: string) => void;
    callerFilter: string;
    setCallerFilter: (v: string) => void;
    feedbackFilter: string;
    setFeedbackFilter: (v: string) => void;
    monthFilter: string;
    yearFilter: string;
    monthDraft: string;
    setMonthDraft: (v: string) => void;
    yearDraft: string;
    setYearDraft: (v: string) => void;
    onApplyMonthYear: () => void;
    monthYearApplyDisabled: boolean;
    hasPendingMonthYear: boolean;
    callingDateFilter: string;
    setCallingDateFilter: (v: string) => void;
    upcomingFilter: string;
    setUpcomingFilter: (v: string) => void;
    monthOptions: MonthOpt[];
    yearOptions: YearOpt[];
    onClearAll: () => void;
};

export function FollowupsFiltersSection({
    searchQuery,
    setSearchQuery,
    callerFilter,
    setCallerFilter,
    feedbackFilter,
    setFeedbackFilter,
    monthFilter,
    yearFilter,
    monthDraft,
    setMonthDraft,
    yearDraft,
    setYearDraft,
    onApplyMonthYear,
    monthYearApplyDisabled,
    hasPendingMonthYear,
    callingDateFilter,
    setCallingDateFilter,
    upcomingFilter,
    setUpcomingFilter,
    monthOptions,
    yearOptions,
    onClearAll,
}: Props) {
    const feedbackFilterClass = `${getFeedbackSelectClass(feedbackFilter)}${feedbackFilter ? ' fu-feedback-sel--filled' : ''}`;

    const lastCallingDateOptions = useMemo((): ModernSelectOption<string>[] => {
        return FOLLOWUPS_LAST_CALLING_DATE_VALUES.map((v) => ({
            value: v,
            label: LAST_CALLING_DATE_LABELS[v],
        }));
    }, []);

    const callAgainOptions = useMemo((): ModernSelectOption<string>[] => {
        return FOLLOWUPS_CALL_AGAIN_VALUES.map((v) => ({
            value: v,
            label: CALL_AGAIN_LABELS[v],
        }));
    }, []);

    const hasActiveFilters =
        searchQuery ||
        callerFilter ||
        feedbackFilter ||
        monthFilter ||
        yearFilter ||
        callingDateFilter ||
        upcomingFilter ||
        hasPendingMonthYear;

    return (
        <div className="fu-body">
            <div className="fu-panel">
                <div className="fu-panel__head">
                    <span className="fu-panel__title">Filters</span>
                    {hasActiveFilters ? (
                        <button type="button" className="fu-btn-clear" onClick={onClearAll}>
                            Clear all
                        </button>
                    ) : null}
                </div>
                <div className="fu-panel__grid">
                    <div className="fu-search-wrap">
                        <label className="fu-flt__lab" htmlFor="followups-search">
                            Search
                        </label>
                        <div className="fu-search">
                            <svg
                                className="fu-search__icon"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                aria-hidden
                            >
                                <circle cx="11" cy="11" r="7" />
                                <path d="M21 21l-4.3-4.3" />
                            </svg>
                            <input
                                id="followups-search"
                                className="fu-search__input"
                                type="search"
                                placeholder="Name or phone number"
                                aria-label="Search by name or mobile"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                autoComplete="off"
                            />
                        </div>
                    </div>
                    <StatusFilter label="Caller" value={callerFilter} onChange={setCallerFilter} options={CALLER_OPTIONS} />
                    <StatusFilter
                        label="Feedback"
                        value={feedbackFilter}
                        onChange={setFeedbackFilter}
                        options={FEEDBACK_OPTIONS.map((opt) => `${getFeedbackEmoji(opt)} ${opt}`)}
                        optionValues={[...FEEDBACK_OPTIONS]}
                        selectClassName={`fu-flt__sel--interactive ${feedbackFilterClass}`}
                    />
                    <StatusFilter
                        label="Month"
                        value={monthDraft}
                        onChange={setMonthDraft}
                        options={monthOptions.map((m) => m.label)}
                        optionValues={monthOptions.map((m) => m.value)}
                        selectClassName={`fu-flt__sel--interactive fu-flt__sel--month${monthDraft ? ' fu-flt__sel--active' : ''}`}
                    />
                    <StatusFilter
                        label="Year"
                        value={yearDraft}
                        onChange={setYearDraft}
                        options={yearOptions.map((y) => y.label)}
                        optionValues={yearOptions.map((y) => y.value)}
                        selectClassName={`fu-flt__sel--interactive fu-flt__sel--year${yearDraft ? ' fu-flt__sel--active' : ''}`}
                    />
                    <div className="fu-flt fu-flt--apply">
                        <span className="fu-flt__lab fu-flt__lab--apply-spacer" aria-hidden>
                            &nbsp;
                        </span>
                        <button
                            type="button"
                            className="fu-btn-apply"
                            disabled={monthYearApplyDisabled}
                            onClick={onApplyMonthYear}
                        >
                            Apply
                        </button>
                    </div>
                </div>
            </div>
            <div className="fu-quick fu-quick--dropdowns">
                <div className="fu-flt fu-quick__flt">
                    <span className="fu-flt__lab">Last calling date</span>
                    <ModernSelect<string>
                        value={callingDateFilter}
                        onChange={setCallingDateFilter}
                        options={lastCallingDateOptions}
                        placeholder="All"
                        aria-label="Last calling date filter"
                        className="fu-followups-modern-select"
                    />
                </div>
                <div className="fu-flt fu-quick__flt">
                    <span className="fu-flt__lab">Call again</span>
                    <ModernSelect<string>
                        value={upcomingFilter}
                        onChange={setUpcomingFilter}
                        options={callAgainOptions}
                        placeholder="All"
                        aria-label="Call again filter"
                        className="fu-followups-modern-select"
                    />
                </div>
            </div>
        </div>
    );
}
