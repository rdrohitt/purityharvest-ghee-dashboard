export const FEEDBACK_OPTIONS = [
    'Excellent ghee',
    'Average ghee',
    'Smell issue',
    'High price',
    'Packaging issue',
    'Delayed delivery',
    'Not Answering',
    'Other feedback',
] as const;

export const CALLER_OPTIONS = ['Monia', 'Sarita'] as const;

export const FOLLOWUPS_PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 500] as const;

/** Values match {@link filterFollowups} `callingDateFilter`. */
export const FOLLOWUPS_LAST_CALLING_DATE_VALUES = [
    '',
    'no-calling-date',
    'more-than-15-days',
    'more-than-30-days',
    'more-than-45-days',
    'more-than-60-days',
] as const;

/** Values match {@link filterFollowups} `upcomingFilter`. */
export const FOLLOWUPS_CALL_AGAIN_VALUES = ['', 'today', 'next-2-days', 'next-7-days', 'next-15-days'] as const;
