import { createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import cn from 'clsx';

import intl from 'panel/common/intl';
import theme from 'panel/lib/theme';
import { Button } from 'panel/common/ui/Button';
import { FILTERED_STATUS } from 'panel/helpers/constants';
import { blockDomain } from 'panel/stores/filtering';
import { addErrorToast } from 'panel/stores/toasts';
import {
    liveStreamState,
    startLiveStream,
    stopLiveStream,
    toggleLiveStream,
} from 'panel/stores/liveStream';
import { formatLogTime, getQueryStatusKey } from 'panel/components/QueryLog/helpers';

import type { NormalizedQueryLogItem } from 'panel/helpers/helpers';

import s from './QueryStream.module.pcss';

type ChipKey = 'all' | 'blocked' | 'threats' | 'errors';

const CHIPS: { key: ChipKey; label: () => string }[] = [
    { key: 'all', label: () => intl.getMessage('live_stream_all') },
    { key: 'blocked', label: () => intl.getMessage('blocked') },
    { key: 'threats', label: () => intl.getMessage('live_stream_threats') },
    { key: 'errors', label: () => intl.getMessage('live_stream_errors') },
];

const THREAT_REASONS: string[] = [
    FILTERED_STATUS.FILTERED_SAFE_BROWSING,
    FILTERED_STATUS.FILTERED_PARENTAL,
];

/**
 * A threat is called out separately from an ordinary blocklist hit: one is a
 * tracker, the other is a site the resolver believes is malicious, and an
 * operator scanning the feed needs to tell them apart at a glance.
 */
const isThreat = (item: NormalizedQueryLogItem) => THREAT_REASONS.includes(item.reason ?? '');

const matchesChip = (item: NormalizedQueryLogItem, chip: ChipKey): boolean => {
    if (chip === 'all') {
        return true;
    }

    const status = getQueryStatusKey(item.reason ?? '', item.originalResponse ?? []);

    switch (chip) {
        case 'blocked':
            return status === 'blocked';
        case 'threats':
            return isThreat(item);
        case 'errors':
            return status === 'error';
        default:
            return true;
    }
};

const statusLabel = (item: NormalizedQueryLogItem): string => {
    if (isThreat(item)) {
        return intl.getMessage('live_stream_threat');
    }

    switch (getQueryStatusKey(item.reason ?? '', item.originalResponse ?? [])) {
        case 'blocked':
            return intl.getMessage('query_log_blocked');
        case 'allowed':
            return intl.getMessage('query_log_allowed');
        case 'rewritten':
            return intl.getMessage('query_log_rewritten');
        case 'error':
            return intl.getMessage('error');
        default:
            return intl.getMessage('query_log_processed');
    }
};

/**
 * The live query feed, and the reason the dashboard now leads with a console
 * rather than counters: the counters answer "how much" over a whole day, which
 * reads the same whether the resolver is healthy or under a flood.  This
 * answers "what is happening right now", and puts the one action that follows
 * from reading it — block that domain — on the row itself.
 */
export const QueryStream = () => {
    const [chip, setChip] = createSignal<ChipKey>('all');
    const [pending, setPending] = createSignal<string[]>([]);

    onMount(() => {
        startLiveStream();
        onCleanup(stopLiveStream);
    });

    const visible = createMemo(() =>
        liveStreamState.items.filter((item) => matchesChip(item, chip())),
    );

    const handleBlock = async (domain: string) => {
        setPending((prev) => [...prev, domain]);
        try {
            await blockDomain(domain);
        } catch (error) {
            addErrorToast({ error });
        } finally {
            setPending((prev) => prev.filter((d) => d !== domain));
        }
    };

    return (
        <section class={s.card} data-testid="query-stream">
            <header class={s.header}>
                <h2 class={cn(theme.text.t4, s.title)}>{intl.getMessage('live_stream_title')}</h2>

                <div class={s.chips} role="group" aria-label={intl.getMessage('live_stream_title')}>
                    <For each={CHIPS}>
                        {(item) => (
                            <button
                                type="button"
                                class={cn(theme.text.t4, s.chip, {
                                    [s.chipOn]: chip() === item.key,
                                })}
                                aria-pressed={chip() === item.key}
                                onClick={() => setChip(item.key)}
                            >
                                {item.label()}
                            </button>
                        )}
                    </For>
                </div>

                {/* The visible text names the current state, because that is
                    what a glance at a feed needs to know.  The accessible name
                    names the action instead, so a screen reader is not told
                    "Streaming" for a control that pauses. */}
                <button
                    type="button"
                    class={cn(theme.text.t4, s.streamToggle)}
                    aria-label={
                        liveStreamState.streaming
                            ? intl.getMessage('live_stream_pause_action')
                            : intl.getMessage('live_stream_resume_action')
                    }
                    onClick={toggleLiveStream}
                >
                    <span
                        class={cn(s.pulse, {
                            [s.pulseOn]: liveStreamState.streaming && !liveStreamState.failed,
                            [s.pulseStale]: liveStreamState.failed,
                        })}
                        aria-hidden="true"
                    />
                    {liveStreamState.failed
                        ? intl.getMessage('live_stream_stale')
                        : liveStreamState.streaming
                          ? intl.getMessage('live_stream_streaming')
                          : intl.getMessage('live_stream_paused')}
                </button>
            </header>

            <div class={s.feed}>
                <Show
                    when={visible().length > 0}
                    fallback={
                        <p class={cn(theme.text.t3, s.empty)}>
                            {intl.getMessage('live_stream_empty')}
                        </p>
                    }
                >
                    <For each={visible()}>
                        {(item) => {
                            const status = () =>
                                getQueryStatusKey(item.reason ?? '', item.originalResponse ?? []);

                            return (
                                <div
                                    class={cn(s.row, {
                                        [s.rowBlocked]: status() === 'blocked' && !isThreat(item),
                                        [s.rowThreat]: isThreat(item),
                                        [s.rowError]: status() === 'error',
                                    })}
                                >
                                    <span class={cn(theme.text.t4, s.time)}>
                                        {formatLogTime(item.time)}
                                    </span>

                                    <span class={cn(theme.text.t3, s.domain)} title={item.domain}>
                                        {item.unicodeName || item.domain}
                                    </span>

                                    <span
                                        class={cn(theme.text.t4, s.status, {
                                            [s.statusBlocked]: status() === 'blocked',
                                            [s.statusAllowed]: status() === 'allowed',
                                            [s.statusRewritten]: status() === 'rewritten',
                                            [s.statusError]: status() === 'error',
                                            [s.statusThreat]: isThreat(item),
                                        })}
                                    >
                                        <span class={s.statusDot} aria-hidden="true" />
                                        {statusLabel(item)}
                                    </span>

                                    <span class={cn(theme.text.t4, s.client)} title={item.client}>
                                        {item.client}
                                    </span>

                                    {/* Blocking what is already blocked is a
                                        no-op, so the action only appears where
                                        it would change something. */}
                                    <span class={s.action}>
                                        <Show when={status() !== 'blocked' && item.domain}>
                                            <Button
                                                variant="secondary-danger"
                                                size="very-small"
                                                compact
                                                class={s.blockButton}
                                                disabled={pending().includes(item.domain)}
                                                aria-label={intl.getMessage(
                                                    'live_stream_block_domain',
                                                    { value: item.domain },
                                                )}
                                                onClick={() => void handleBlock(item.domain)}
                                            >
                                                {intl.getMessage('block')}
                                            </Button>
                                        </Show>
                                    </span>
                                </div>
                            );
                        }}
                    </For>
                </Show>
            </div>
        </section>
    );
};
