import { createStore } from 'solid-js/store';
import { untrack } from 'solid-js';

import { queryLog } from 'panel/api/generated';
import { normalizeLogs, type NormalizedQueryLogItem } from 'panel/helpers/helpers';

/**
 * A short poll over the newest query log entries, kept separate from the
 * queryLogs store on purpose: that store owns the Query log page's paging,
 * filters and `oldest` cursor, and a background poller writing into it would
 * fight whatever the operator is doing on that page.
 *
 * The resolver has no push channel — no websocket, no SSE, no `since`
 * parameter — so "live" here means asking for the newest page every couple of
 * seconds and keeping the entries that are new.
 */

/** How often the stream asks for new entries. */
const POLL_MS = 2000;

/**
 * Entries requested per poll.  The window only has to cover one interval; at
 * 30 entries the stream keeps up with roughly 15 queries a second before it
 * starts missing some.
 */
const FETCH_LIMIT = 30;

/** Entries kept in memory.  Anything older belongs on the Query log page. */
const KEEP = 60;

type LiveStreamState = {
    items: NormalizedQueryLogItem[];

    /** Whether the poller is running. */
    streaming: boolean;

    /** Set after a failed poll, so the header can say the feed went stale. */
    failed: boolean;
};

const [state, setState] = createStore<LiveStreamState>({
    items: [],
    streaming: false,
    failed: false,
});

/**
 * Identifies an entry across polls.  The log has no ids, so this is the
 * narrowest tuple that stays unique: two queries for the same name from the
 * same client would have to land in the same nanosecond to collide.
 */
const keyOf = (item: NormalizedQueryLogItem): string =>
    `${item.time}|${item.domain}|${item.type}|${item.client}`;

let timer: ReturnType<typeof setTimeout> | null = null;

/** Guards against stacking requests when a poll outlives its interval. */
let inFlight = false;

const merge = (incoming: NormalizedQueryLogItem[]) => {
    const seen = new Set(untrack(() => state.items).map(keyOf));
    const fresh = incoming.filter((item) => !seen.has(keyOf(item)));

    if (fresh.length === 0) {
        return;
    }

    // The API returns newest first, so prepending preserves that order.
    setState('items', (prev) => [...fresh, ...prev].slice(0, KEEP));
};

const poll = async () => {
    if (inFlight) {
        return;
    }

    inFlight = true;
    try {
        const raw = await queryLog({ limit: FETCH_LIMIT, older_than: '' });
        merge(normalizeLogs(raw.data || []));
        setState('failed', false);
    } catch {
        // A failed poll must not stop the stream — the resolver may just be
        // restarting.  The flag lets the header say so instead of the feed
        // silently freezing.
        setState('failed', true);
    } finally {
        inFlight = false;
    }
};

export const startLiveStream = () => {
    stopLiveStream();
    setState('streaming', true);

    const tick = () => {
        void poll().finally(() => {
            if (untrack(() => state.streaming)) {
                timer = setTimeout(tick, POLL_MS);
            }
        });
    };

    tick();
};

/** Stops the poller and keeps what has already been collected on screen. */
export const stopLiveStream = () => {
    if (timer) {
        clearTimeout(timer);
        timer = null;
    }

    setState('streaming', false);
};

export const toggleLiveStream = () => {
    if (untrack(() => state.streaming)) {
        stopLiveStream();
    } else {
        startLiveStream();
    }
};

export const liveStreamState = untrack(() => state);
