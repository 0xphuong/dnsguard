import { createMemo, createSignal, For, Show } from 'solid-js';
import cn from 'clsx';

import intl from 'panel/common/intl';
import theme from 'panel/lib/theme';
import { Icon } from 'panel/common/ui/Icon';
import { formatNumber, formatCompactNumber } from 'panel/helpers/helpers';

import {
    buildDevices,
    matchesFilter,
    summarize,
    BLOCKED_HEAVY_THRESHOLD,
    type Device,
    type DeviceFilter,
} from './devices';

import type { Client } from 'panel/api/model/client';
import type { ClientAuto } from 'panel/api/model/clientAuto';

import s from './DeviceGrid.module.pcss';

const FILTERS: { key: DeviceFilter; label: () => string }[] = [
    { key: 'all', label: () => intl.getMessage('devices_filter_all') },
    { key: 'active', label: () => intl.getMessage('devices_filter_active') },
    { key: 'blocked_heavy', label: () => intl.getMessage('devices_filter_blocked_heavy') },
    { key: 'unconfigured', label: () => intl.getMessage('devices_filter_unconfigured') },
];

const formatShare = (share: number | null): string =>
    share === null ? '—' : `${(share * 100).toFixed(share > 0 && share < 0.1 ? 1 : 0)}%`;

type Props = {
    clients: Client[];
    autoClients: ClientAuto[];
    topClients: { name: string; count: number }[];
    topBlockedClients: { name: string; count: number }[];
    onEdit: (clientName: string) => void;
    onAdd: (address: string) => void;
};

/**
 * The network as a set of devices rather than two tables of configuration.
 *
 * The tables that used to be the whole page answer "what have I configured"
 * and "what has the resolver discovered", which are questions about the
 * config.  A DNS firewall is operated by asking a question about the traffic:
 * which device is generating it, and how much of it is being filtered.  That
 * is what a card says, and it is why each one carries its own blocked share —
 * a number the resolver only started counting for this view.
 *
 * What the mockup for this view showed and the API still cannot supply is a
 * per-device sparkline: the statistics keep no per-client time series, only
 * totals over the selected period.  Rather than draw a shape from data that
 * does not exist, each card shows the split it can prove — allowed against
 * blocked — as a single bar.
 */
export const DeviceGrid = (props: Props) => {
    const [filter, setFilter] = createSignal<DeviceFilter>('all');

    const devices = createMemo(() =>
        buildDevices({
            clients: props.clients,
            autoClients: props.autoClients,
            topClients: props.topClients,
            topBlockedClients: props.topBlockedClients,
        }),
    );

    const summary = createMemo(() => summarize(devices()));

    const counts = createMemo(() => {
        const all = devices();

        return {
            all: all.length,
            active: all.filter((d) => matchesFilter(d, 'active')).length,
            blocked_heavy: all.filter((d) => matchesFilter(d, 'blocked_heavy')).length,
            unconfigured: all.filter((d) => matchesFilter(d, 'unconfigured')).length,
        };
    });

    const visible = createMemo(() => devices().filter((d) => matchesFilter(d, filter())));

    const isHeavy = (device: Device) =>
        device.blockedShare !== null && device.blockedShare >= BLOCKED_HEAVY_THRESHOLD;

    return (
        <div data-testid="device-grid">
            <div class={s.toolbar}>
                <div class={s.filters} role="group" aria-label={intl.getMessage('devices_title')}>
                    <For each={FILTERS}>
                        {(item) => (
                            <button
                                type="button"
                                class={cn(theme.text.t4, s.filter, {
                                    [s.filterOn]: filter() === item.key,
                                })}
                                aria-pressed={filter() === item.key}
                                onClick={() => setFilter(item.key)}
                            >
                                {item.label()}
                                <span class={s.filterCount}>{counts()[item.key]}</span>
                            </button>
                        )}
                    </For>
                </div>

                <dl class={s.summary}>
                    <div class={s.summaryItem}>
                        <dt class={cn(theme.text.t4, s.summaryLabel)}>
                            {intl.getMessage('queries')}
                        </dt>
                        <dd class={cn(theme.text.t3, s.summaryValue)}>
                            {formatNumber(summary().queries)}
                        </dd>
                    </div>

                    <div class={s.summaryItem}>
                        <dt class={cn(theme.text.t4, s.summaryLabel)}>
                            {intl.getMessage('blocked')}
                        </dt>
                        <dd class={cn(theme.text.t3, s.summaryValue, s.summaryValueBlocked)}>
                            {formatShare(summary().blockedShare)}
                        </dd>
                    </div>

                    <div class={s.summaryItem}>
                        <dt class={cn(theme.text.t4, s.summaryLabel)}>
                            {intl.getMessage('devices_filter_blocked_heavy')}
                        </dt>
                        <dd class={cn(theme.text.t3, s.summaryValue)}>
                            {summary().blockedHeavy}
                        </dd>
                    </div>
                </dl>
            </div>

            <Show
                when={visible().length > 0}
                fallback={
                    <p class={cn(theme.text.t3, s.empty)}>{intl.getMessage('devices_empty')}</p>
                }
            >
                <ul class={s.grid}>
                    <For each={visible()}>
                        {(device) => (
                            <li class={s.card}>
                                <div class={s.cardHeader}>
                                    <Icon
                                        icon={device.clientName ? 'user' : 'connections'}
                                        class={s.cardIcon}
                                    />

                                    <div class={s.cardIdentity}>
                                        <h3
                                            class={cn(theme.text.t2, s.cardName)}
                                            title={device.name}
                                        >
                                            {device.name}
                                        </h3>

                                        {/* Separated by space rather than by
                                            a middot: the line wraps on a
                                            narrow card, and a wrapped list of
                                            middots leaves one stranded at the
                                            end of the line. */}
                                        <p class={cn(theme.text.t4, s.cardMeta)}>
                                            <span class={s.mono}>{device.address}</span>
                                            <Show when={device.mac}>
                                                <span class={s.mono}>{device.mac}</span>
                                            </Show>
                                            <Show when={device.source}>
                                                <span>{device.source}</span>
                                            </Show>
                                            <Show when={device.location}>
                                                <span>{device.location}</span>
                                            </Show>
                                        </p>
                                    </div>

                                    <Show
                                        when={device.clientName}
                                        fallback={
                                            <span class={cn(theme.text.t4, s.badge, s.badgeNew)}>
                                                {intl.getMessage('devices_badge_unconfigured')}
                                            </span>
                                        }
                                    >
                                        <span
                                            class={cn(theme.text.t4, s.badge, {
                                                [s.badgeCustom]: !device.usesGlobalSettings,
                                            })}
                                        >
                                            {device.usesGlobalSettings
                                                ? intl.getMessage('devices_badge_global')
                                                : intl.getMessage('devices_badge_custom')}
                                        </span>
                                    </Show>
                                </div>

                                <div class={s.figures}>
                                    <div class={s.figure}>
                                        <span class={cn(theme.text.t4, s.figureLabel)}>
                                            {intl.getMessage('queries')}
                                        </span>
                                        <span class={s.figureValue}>
                                            {formatCompactNumber(device.queries)}
                                        </span>
                                    </div>

                                    <div class={s.figure}>
                                        <span class={cn(theme.text.t4, s.figureLabel)}>
                                            {intl.getMessage('blocked')}
                                        </span>
                                        <span
                                            class={cn(s.figureValue, {
                                                [s.figureValueHeavy]: isHeavy(device),
                                            })}
                                        >
                                            {formatShare(device.blockedShare)}
                                        </span>
                                    </div>
                                </div>

                                {/* One bar, two segments: the split the server
                                    can prove.  A time series per device does
                                    not exist, so none is drawn. */}
                                <div
                                    class={s.bar}
                                    role="img"
                                    aria-label={intl.getMessage('devices_split_label', {
                                        allowed: String(device.queries - device.blocked),
                                        blocked: String(device.blocked),
                                    })}
                                >
                                    <Show when={device.blockedShare !== null}>
                                        <span
                                            class={s.barAllowed}
                                            style={{
                                                width: `${(1 - device.blockedShare!) * 100}%`,
                                            }}
                                        />
                                        <span
                                            class={s.barBlocked}
                                            style={{ width: `${device.blockedShare! * 100}%` }}
                                        />
                                    </Show>
                                </div>

                                <div class={s.cardFooter}>
                                    <Show when={device.tags.length > 0}>
                                        <span class={cn(theme.text.t4, s.tags)}>
                                            {device.tags.join(', ')}
                                        </span>
                                    </Show>

                                    <Show
                                        when={device.clientName}
                                        fallback={
                                            <button
                                                type="button"
                                                class={cn(theme.text.t4, s.action)}
                                                onClick={() => props.onAdd(device.address)}
                                            >
                                                {intl.getMessage('devices_action_add')}
                                            </button>
                                        }
                                    >
                                        <button
                                            type="button"
                                            class={cn(theme.text.t4, s.action)}
                                            onClick={() => props.onEdit(device.clientName!)}
                                        >
                                            {intl.getMessage('devices_action_edit')}
                                        </button>
                                    </Show>
                                </div>
                            </li>
                        )}
                    </For>
                </ul>
            </Show>
        </div>
    );
};
