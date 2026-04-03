import React from 'react';
import { CALLER_OPTIONS, FEEDBACK_OPTIONS } from './followupsConstants';
import { CallingDateFilterButton, StatusFilter } from './FollowupFilterControls';

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
    setMonthFilter: (v: string) => void;
    yearFilter: string;
    setYearFilter: (v: string) => void;
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
    setMonthFilter,
    yearFilter,
    setYearFilter,
    callingDateFilter,
    setCallingDateFilter,
    upcomingFilter,
    setUpcomingFilter,
    monthOptions,
    yearOptions,
    onClearAll,
}: Props) {
    const hasActiveFilters =
        searchQuery ||
        callerFilter ||
        feedbackFilter ||
        monthFilter ||
        yearFilter ||
        callingDateFilter ||
        upcomingFilter;

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
                    <StatusFilter label="Feedback" value={feedbackFilter} onChange={setFeedbackFilter} options={[...FEEDBACK_OPTIONS]} />
                    <StatusFilter
                        label="Month"
                        value={monthFilter}
                        onChange={setMonthFilter}
                        options={monthOptions.map((m) => m.label)}
                        optionValues={monthOptions.map((m) => m.value)}
                    />
                    <StatusFilter
                        label="Year"
                        value={yearFilter}
                        onChange={setYearFilter}
                        options={yearOptions.map((y) => y.label)}
                        optionValues={yearOptions.map((y) => y.value)}
                    />
                </div>
            </div>
            <div className="fu-quick">
                <div className="fu-quick__block">
                    <span className="fu-quick__label">Last calling date</span>
                    <div className="fu-pill-group" role="group" aria-label="Calling date filters">
                        <CallingDateFilterButton
                            active={callingDateFilter === 'no-calling-date'}
                            onClick={() => setCallingDateFilter(callingDateFilter === 'no-calling-date' ? '' : 'no-calling-date')}
                        >
                            No date
                        </CallingDateFilterButton>
                        <CallingDateFilterButton
                            active={callingDateFilter === 'more-than-15-days'}
                            onClick={() => setCallingDateFilter(callingDateFilter === 'more-than-15-days' ? '' : 'more-than-15-days')}
                        >
                            &gt; 15 days
                        </CallingDateFilterButton>
                        <CallingDateFilterButton
                            active={callingDateFilter === 'more-than-30-days'}
                            onClick={() => setCallingDateFilter(callingDateFilter === 'more-than-30-days' ? '' : 'more-than-30-days')}
                        >
                            &gt; 30 days
                        </CallingDateFilterButton>
                        <CallingDateFilterButton
                            active={callingDateFilter === 'more-than-45-days'}
                            onClick={() => setCallingDateFilter(callingDateFilter === 'more-than-45-days' ? '' : 'more-than-45-days')}
                        >
                            &gt; 45 days
                        </CallingDateFilterButton>
                        <CallingDateFilterButton
                            active={callingDateFilter === 'more-than-60-days'}
                            onClick={() => setCallingDateFilter(callingDateFilter === 'more-than-60-days' ? '' : 'more-than-60-days')}
                        >
                            &gt; 60 days
                        </CallingDateFilterButton>
                    </div>
                </div>
                <div className="fu-quick__block">
                    <span className="fu-quick__label">Call again</span>
                    <div className="fu-pill-group" role="group" aria-label="Upcoming followup filters">
                        <CallingDateFilterButton
                            active={upcomingFilter === 'today'}
                            onClick={() => setUpcomingFilter(upcomingFilter === 'today' ? '' : 'today')}
                        >
                            Today
                        </CallingDateFilterButton>
                        <CallingDateFilterButton
                            active={upcomingFilter === 'next-2-days'}
                            onClick={() => setUpcomingFilter(upcomingFilter === 'next-2-days' ? '' : 'next-2-days')}
                        >
                            Next 2 days
                        </CallingDateFilterButton>
                        <CallingDateFilterButton
                            active={upcomingFilter === 'next-7-days'}
                            onClick={() => setUpcomingFilter(upcomingFilter === 'next-7-days' ? '' : 'next-7-days')}
                        >
                            Next 7 days
                        </CallingDateFilterButton>
                        <CallingDateFilterButton
                            active={upcomingFilter === 'next-15-days'}
                            onClick={() => setUpcomingFilter(upcomingFilter === 'next-15-days' ? '' : 'next-15-days')}
                        >
                            Next 15 days
                        </CallingDateFilterButton>
                    </div>
                </div>
            </div>
        </div>
    );
}
