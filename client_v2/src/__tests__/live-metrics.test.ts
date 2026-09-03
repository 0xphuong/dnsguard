import { describe, it, expect } from 'vitest';

import { getLiveMetrics } from 'panel/components/Dashboard/liveMetrics';

/** Builds an hourly series whose last element is the hour in progress. */
const series = (completed: number[], current: number) => [...completed, current];

describe('getLiveMetrics', () => {
    it('reports nothing for a daily series', () => {
        const got = getLiveMetrics({
            queries: [100, 200, 300],
            blocked: [10, 20, 30],
            hourly: false,
            minutesIntoHour: 30,
        });

        expect(got).toEqual({
            ratePerMinute: null,
            blockedShare: null,
            baselineShare: null,
            level: 'unknown',
        });
    });

    it('divides the hour in progress by the minutes it has run', () => {
        const got = getLiveMetrics({
            queries: series([], 120),
            blocked: series([], 0),
            hourly: true,
            minutesIntoHour: 30,
        });

        expect(got.ratePerMinute).toBe(4);
    });

    it('never divides by zero at the top of the hour', () => {
        const got = getLiveMetrics({
            queries: series([], 7),
            blocked: series([], 0),
            hourly: true,
            minutesIntoHour: 0,
        });

        expect(got.ratePerMinute).toBe(7);
    });

    it('leaves the share null when the hour has no queries yet', () => {
        const got = getLiveMetrics({
            queries: series([100, 100, 100, 100, 100, 100], 0),
            blocked: series([10, 10, 10, 10, 10, 10], 0),
            hourly: true,
            minutesIntoHour: 1,
        });

        expect(got.blockedShare).toBeNull();
        expect(got.level).toBe('unknown');
    });

    it('withholds a verdict until enough completed hours carry traffic', () => {
        // Five hours with traffic, one without: one short of the minimum.
        const got = getLiveMetrics({
            queries: series([100, 100, 100, 100, 100, 0], 100),
            blocked: series([10, 10, 10, 10, 10, 0], 90),
            hourly: true,
            minutesIntoHour: 30,
        });

        expect(got.baselineShare).toBeNull();
        expect(got.level).toBe('unknown');
    });

    it('withholds a verdict when the current hour is too small to judge', () => {
        const got = getLiveMetrics({
            queries: series([100, 100, 100, 100, 100, 100], 3),
            blocked: series([10, 10, 10, 10, 10, 10], 3),
            hourly: true,
            minutesIntoHour: 5,
        });

        expect(got.baselineShare).toBeCloseTo(0.1);
        expect(got.blockedShare).toBe(1);
        expect(got.level).toBe('unknown');
    });

    it('calls a steady block rate normal', () => {
        const got = getLiveMetrics({
            queries: series([100, 100, 100, 100, 100, 100], 100),
            blocked: series([10, 12, 8, 11, 9, 10], 14),
            hourly: true,
            minutesIntoHour: 30,
        });

        expect(got.baselineShare).toBeCloseTo(0.105);
        expect(got.blockedShare).toBeCloseTo(0.14);
        expect(got.level).toBe('normal');
    });

    it('calls a block rate well above the median elevated', () => {
        const got = getLiveMetrics({
            queries: series([100, 100, 100, 100, 100, 100], 100),
            blocked: series([10, 12, 8, 11, 9, 10], 40),
            hourly: true,
            minutesIntoHour: 30,
        });

        expect(got.level).toBe('elevated');
    });

    it('excludes the hour in progress from its own baseline', () => {
        // Every completed hour blocks nothing, so a baseline that included the
        // current hour would be dragged upwards and hide the spike.
        const got = getLiveMetrics({
            queries: series([100, 100, 100, 100, 100, 100], 100),
            blocked: series([0, 0, 0, 0, 0, 0], 50),
            hourly: true,
            minutesIntoHour: 30,
        });

        expect(got.baselineShare).toBe(0);
        expect(got.level).toBe('elevated');
    });

    it('takes the baseline from at most the last 24 completed hours', () => {
        // Thirty quiet hours followed by 24 hours blocking half, then a
        // current hour that matches the recent half — normal, not elevated.
        const quiet = Array.from({ length: 30 }, () => 100);
        const busy = Array.from({ length: 24 }, () => 100);

        const got = getLiveMetrics({
            queries: series([...quiet, ...busy], 100),
            blocked: series([...quiet.map(() => 0), ...busy.map(() => 50)], 50),
            hourly: true,
            minutesIntoHour: 30,
        });

        expect(got.baselineShare).toBe(0.5);
        expect(got.level).toBe('normal');
    });
});
