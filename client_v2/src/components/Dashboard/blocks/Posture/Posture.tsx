import { createSignal, Show, For } from 'solid-js';
import cn from 'clsx';

import intl from 'panel/common/intl';
import theme from 'panel/lib/theme';
import { Switch } from 'panel/common/controls/Switch';
import { Dropdown } from 'panel/common/ui/Dropdown';
import { Icon } from 'panel/common/ui/Icon';
import { DISABLE_PROTECTION_TIMINGS, ONE_SECOND_IN_MS } from 'panel/helpers/constants';
import { msToSeconds, msToMinutes, msToHours } from 'panel/helpers/helpers';

import type { LiveMetrics } from '../../liveMetrics';

import s from './Posture.module.pcss';

const DISABLE_PROTECTION_ITEMS = [
    { key: 'half_minute', time: DISABLE_PROTECTION_TIMINGS.HALF_MINUTE },
    { key: 'minute', time: DISABLE_PROTECTION_TIMINGS.MINUTE },
    { key: 'ten_minutes', time: DISABLE_PROTECTION_TIMINGS.TEN_MINUTES },
    { key: 'hour', time: DISABLE_PROTECTION_TIMINGS.HOUR },
    { key: 'tomorrow', time: DISABLE_PROTECTION_TIMINGS.TOMORROW },
];

const getDisableText = (key: string, time: number) => {
    switch (key) {
        case 'half_minute':
            return intl.getPlural('pause_for_seconds', msToSeconds(time));
        case 'minute':
        case 'ten_minutes':
            return intl.getPlural('pause_for_minutes', msToMinutes(time));
        case 'hour':
            return intl.getMessage('pause_for_hour', { count: msToHours(time) });
        case 'tomorrow': {
            const now = new Date();
            const tomorrowTime = now.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
            });
            return intl.getMessage('pause_until_tomorrow', { time: tomorrowTime });
        }
        default:
            return '';
    }
};

const getRemainingTimeText = (milliseconds: number) => {
    if (!milliseconds) return '';

    const date = new Date(milliseconds);
    const hh = date.getUTCHours();
    const mm = `0${date.getUTCMinutes()}`.slice(-2);
    const ss = `0${date.getUTCSeconds()}`.slice(-2);
    const formattedHH = `0${hh}`.slice(-2);

    return hh ? `${formattedHH}:${mm}:${ss}` : `${mm}:${ss}`;
};

const formatShare = (share: number | null): string =>
    share === null ? '—' : `${(share * 100).toFixed(share < 0.1 ? 1 : 0)}%`;

const formatRate = (rate: number | null): string => {
    if (rate === null) return '—';

    return rate >= 10 ? rate.toFixed(0) : rate.toFixed(1);
};

type Props = {
    protectionEnabled: boolean;
    processingProtection: boolean;
    remainingTime: number | null;
    /** Whether TLS is switched on at all. */
    encryptionEnabled: boolean;
    /** Ports for DoH, DoT and DoQ.  A falsy port means that protocol is off. */
    portHttps: number | string;
    portTls: number | string;
    portQuic: number | string;
    dnsAddresses: string[];
    dnsPort: number;
    avgProcessingTime: number;
    /** Rate, blocked share and verdict, all derived from the hourly series. */
    metrics: LiveMetrics;
    onToggleProtection: (enabled: boolean, duration?: number) => void;
};

/**
 * Posture answers the question the counters below it do not: is this resolver
 * protecting anything right now, and is what it is doing normal.
 *
 * The counters report volume over a whole period — they read the same whether
 * DNS is encrypted or wide open, and whether the block rate just tripled or
 * has not moved in a week.  Everything in this band is about *now*.
 */
export const Posture = (props: Props) => {
    const [protectionMenuOpen, setProtectionMenuOpen] = createSignal(false);
    const [selectedDisableTime, setSelectedDisableTime] = createSignal<number | null>(null);

    const handleToggleProtection = () => {
        props.onToggleProtection(props.protectionEnabled);
    };

    const handleDisableProtection = (time: number) => {
        setSelectedDisableTime(time);
        props.onToggleProtection(props.protectionEnabled, time - ONE_SECOND_IN_MS);
        setProtectionMenuOpen(false);
    };

    // DoH, DoT and DoQ are protocol names rather than prose, so they are not
    // translated.  A protocol counts as on only when TLS is enabled and that
    // specific port is set, which is exactly what the resolver requires.
    const encryptedProtocols = () => {
        if (!props.encryptionEnabled) return [];

        return [
            Number(props.portHttps) ? 'DoH' : null,
            Number(props.portTls) ? 'DoT' : null,
            Number(props.portQuic) ? 'DoQ' : null,
        ].filter(Boolean) as string[];
    };

    /**
     * Four states rather than two.  "Active" and "Normal" differ on purpose:
     * the first says the filter is on, the second adds that its block rate
     * looks like the last day's, which is a claim that needs history to make.
     */
    const verdict = (): 'paused' | 'attention' | 'normal' | 'active' => {
        if (!props.protectionEnabled) return 'paused';
        if (props.metrics.level === 'elevated') return 'attention';
        if (props.metrics.level === 'normal') return 'normal';

        return 'active';
    };

    const verdictLabel = () => {
        switch (verdict()) {
            case 'paused':
                return intl.getMessage('posture_paused');
            case 'attention':
                return intl.getMessage('posture_attention');
            case 'normal':
                return intl.getMessage('posture_normal');
            default:
                return intl.getMessage('posture_active');
        }
    };

    const note = () => {
        const baseline = formatShare(props.metrics.baselineShare);

        switch (verdict()) {
            case 'paused':
                return intl.getMessage('posture_note_paused');
            case 'attention':
                return intl.getMessage('posture_note_elevated', {
                    current: formatShare(props.metrics.blockedShare),
                    baseline,
                });
            case 'normal':
                return intl.getMessage('posture_note_normal', { baseline });
            default:
                return intl.getMessage('posture_note_unknown');
        }
    };

    const protectionMenu = (
        <div class={s.protectionMenu}>
            <For each={DISABLE_PROTECTION_ITEMS}>
                {(item) => (
                    <div
                        class={cn(
                            theme.select.option,
                            theme.select.option_check,
                            theme.text.t2,
                            theme.text.condenced,
                        )}
                        onMouseDown={() => handleDisableProtection(item.time)}
                    >
                        <Show
                            when={selectedDisableTime() === item.time && props.remainingTime}
                            fallback={<Icon icon="dot" class={theme.select.icon} />}
                        >
                            <Icon icon="check_tiny" class={theme.select.icon} />
                        </Show>
                        {getDisableText(item.key, item.time)}
                    </div>
                )}
            </For>
        </div>
    );

    return (
        <div class={s.posture} data-testid="dashboard-posture">
            <div class={s.segments}>
                <div class={cn(s.segment, s.segmentProtection)}>
                    <div class={s.segmentBody}>
                        <div class={cn(theme.text.t4, s.label)}>
                            {intl.getMessage('protection')}
                        </div>

                        <div class={s.stateRow}>
                            <span
                                class={cn(s.dot, {
                                    [s.dotOn]: verdict() === 'normal' || verdict() === 'active',
                                    [s.dotWarn]: verdict() === 'attention',
                                    [s.dotOff]: verdict() === 'paused',
                                })}
                                aria-hidden="true"
                            />
                            <span class={s.value}>{verdictLabel()}</span>
                            <Show when={props.remainingTime && props.remainingTime > 0}>
                                <span class={cn(theme.text.t4, s.countdown)}>
                                    {getRemainingTimeText(props.remainingTime!)}
                                </span>
                            </Show>
                        </div>
                    </div>

                    <div class={s.controls}>
                        <Switch
                            id="protection_toggle"
                            data-testid="protection-toggle"
                            checked={!!props.protectionEnabled}
                            onChange={handleToggleProtection}
                            disabled={props.processingProtection}
                        />

                        <Dropdown
                            menu={protectionMenu}
                            position="bottomLeft"
                            open={protectionMenuOpen()}
                            onOpenChange={setProtectionMenuOpen}
                            disabled={!props.protectionEnabled}
                            noIcon
                        >
                            <button
                                type="button"
                                class={s.dropdownTrigger}
                                aria-label={intl.getMessage('disable_protection_btn')}
                                disabled={!props.protectionEnabled}
                            >
                                <Icon icon="bullets" />
                            </button>
                        </Dropdown>
                    </div>
                </div>

                <div class={s.segment}>
                    <div class={cn(theme.text.t4, s.label)}>{intl.getMessage('posture_rate')}</div>
                    <div class={s.stateRow}>
                        <span class={cn(s.value, s.valueMono)}>
                            {formatRate(props.metrics.ratePerMinute)}
                        </span>
                    </div>
                </div>

                <div class={s.segment}>
                    <div class={cn(theme.text.t4, s.label)}>{intl.getMessage('blocked')}</div>
                    <div class={s.stateRow}>
                        <span
                            class={cn(s.value, s.valueMono, {
                                [s.valueWarn]: verdict() === 'attention',
                            })}
                        >
                            {formatShare(props.metrics.blockedShare)}
                        </span>
                    </div>
                </div>

                <div class={s.segment}>
                    <div class={cn(theme.text.t4, s.label)}>
                        {intl.getMessage('posture_avg_response')}
                    </div>
                    <div class={s.stateRow}>
                        <span class={cn(s.value, s.valueMono)}>
                            {intl.getMessage('processing_time_ms', {
                                // The store already runs secondsToMilliseconds
                                // on the API value, so this must not scale it
                                // again.
                                value: (props.avgProcessingTime ?? 0).toFixed(0),
                            })}
                        </span>
                    </div>
                </div>

                <div class={s.segment}>
                    <div class={cn(theme.text.t4, s.label)}>
                        {intl.getMessage('encryption_title')}
                    </div>
                    <div class={s.stateRow}>
                        <Show
                            when={encryptedProtocols().length > 0}
                            fallback={
                                <>
                                    <span class={cn(s.dot, s.dotWarn)} aria-hidden="true" />
                                    <span class={cn(s.value, s.valueMuted)}>
                                        {intl.getMessage('posture_not_configured')}
                                    </span>
                                </>
                            }
                        >
                            <span class={cn(s.dot, s.dotOn)} aria-hidden="true" />
                            <span class={cn(s.value, s.valueMono)}>
                                {encryptedProtocols().join(' · ')}
                            </span>
                        </Show>
                    </div>
                </div>

                <div class={s.segment}>
                    <div class={cn(theme.text.t4, s.label)}>
                        {intl.getMessage('posture_listening')}
                    </div>
                    <div class={s.stateRow}>
                        <span class={cn(s.value, s.valueMono)}>:{props.dnsPort}</span>
                        <span class={cn(theme.text.t4, s.valueMuted)}>
                            {props.dnsAddresses.length}
                        </span>
                    </div>
                </div>
            </div>

            {/* The band states facts; this line states what they mean.  It is
                deliberately a sentence: a verdict without its basis is not
                something an operator can check. */}
            <p class={cn(theme.text.t4, s.note)}>{note()}</p>
        </div>
    );
};
