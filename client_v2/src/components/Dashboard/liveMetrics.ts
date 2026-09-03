/**
 * The dashboard's status band shows three numbers the API does not return: a
 * query rate, a blocked share, and a verdict on whether that share is unusual.
 * All three are derived from the hourly series `/control/stats` already sends,
 * so the band costs no extra request and no server work.
 *
 * The series is ordered oldest-first and its last element is the hour still in
 * progress — see `loadUnits` in `internal/stats/stats.go`, which appends the
 * current unit last.  Every calculation here therefore treats the last element
 * as partial: the rate divides it by the minutes it has actually run, and the
 * baseline is taken from the completed hours before it.
 */

/** Completed hours the baseline is taken from. */
const BASELINE_HOURS = 24;

/**
 * Completed hours carrying traffic that must exist before a verdict is offered.
 * Below this one quiet night makes the median meaningless.
 */
const MIN_BASELINE_SAMPLES = 6;

/**
 * Queries needed in the hour in progress before it is judged.  Two blocked out
 * of three is 67% and means nothing.
 */
const MIN_CURRENT_QUERIES = 20;

/** How far above the baseline counts as elevated, in share points. */
const ELEVATED_MARGIN = 0.15;

export type AnomalyLevel = 'normal' | 'elevated' | 'unknown';

export type LiveMetrics = {
    /** Queries in the hour so far, per minute.  Null when not derivable. */
    ratePerMinute: number | null;

    /** Blocked share of the hour so far, 0..1.  Null when no queries yet. */
    blockedShare: number | null;

    /** Blocked share across the baseline hours, 0..1.  Null when unknown. */
    baselineShare: number | null;

    level: AnomalyLevel;
};

type Input = {
    /** Queries per time unit, oldest first. */
    queries: number[];

    /** Blocked queries per time unit, oldest first. */
    blocked: number[];

    /**
     * Whether the series is hourly.  A daily series — which the server sends
     * for periods over a week — is too coarse to say anything about now.
     */
    hourly: boolean;

    /** Minutes elapsed in the hour in progress, 0..59. */
    minutesIntoHour: number;
};

const median = (values: number[]): number => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    return sorted.length % 2 === 0
        ? (sorted[middle - 1] + sorted[middle]) / 2
        : sorted[middle];
};

export const getLiveMetrics = (input: Input): LiveMetrics => {
    if (!input.hourly || input.queries.length === 0) {
        return {
            ratePerMinute: null,
            blockedShare: null,
            baselineShare: null,
            level: 'unknown',
        };
    }

    const last = input.queries.length - 1;
    const currentQueries = input.queries[last] ?? 0;
    const currentBlocked = input.blocked[last] ?? 0;

    // Clamped from below because a poll at the top of the hour would otherwise
    // divide by zero, and from above because a clock skew must not deflate the
    // rate.
    const minutes = Math.min(60, Math.max(1, input.minutesIntoHour));

    const metrics: LiveMetrics = {
        ratePerMinute: currentQueries / minutes,
        blockedShare: currentQueries > 0 ? currentBlocked / currentQueries : null,
        baselineShare: null,
        level: 'unknown',
    };

    // Completed hours only: the hour in progress cannot be part of the
    // baseline it is being compared against.
    const from = Math.max(0, last - BASELINE_HOURS);
    const shares: number[] = [];
    for (let i = from; i < last; i += 1) {
        const queries = input.queries[i] ?? 0;
        if (queries > 0) {
            shares.push((input.blocked[i] ?? 0) / queries);
        }
    }

    if (shares.length < MIN_BASELINE_SAMPLES) {
        return metrics;
    }

    metrics.baselineShare = median(shares);

    if (metrics.blockedShare === null || currentQueries < MIN_CURRENT_QUERIES) {
        return metrics;
    }

    metrics.level =
        metrics.blockedShare - metrics.baselineShare >= ELEVATED_MARGIN ? 'elevated' : 'normal';

    return metrics;
};
