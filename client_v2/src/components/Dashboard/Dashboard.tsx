import { createSignal, createMemo, createEffect, onCleanup, onMount, Show } from 'solid-js';
import cn from 'clsx';

import intl from 'panel/common/intl';
import theme from 'panel/lib/theme';
import { PageLoader } from 'panel/common/ui/Loader';
import { dashboardState, toggleProtection, getClients } from 'panel/stores/dashboard';
import { statsState, getStats, getStatsConfig } from 'panel/stores/stats';
import { accessState, getAccessList } from 'panel/stores/access';
import { encryptionState, getTlsStatus } from 'panel/stores/encryption';
import {
    ONE_SECOND_IN_MS,
    HOUR,
    DAY,
    STATS_INTERVALS_DAYS,
    TIME_UNITS,
} from 'panel/helpers/constants';

import { getLiveMetrics } from './liveMetrics';
import { Header, getPeriodLabel } from './blocks/Header/Header';
import { Posture } from './blocks/Posture';
import { QueryStream } from './blocks/QueryStream';
import { TopTalkers } from './blocks/TopTalkers';
import { StatCards } from './blocks/StatCards';
import { EmptyState } from './blocks/EmptyState/EmptyState';
import { GeneralStatistics } from './blocks/GeneralStatistics';
import { TopClients } from './blocks/TopClients';
import { TopQueriedDomains } from './blocks/TopQueriedDomains';
import { TopBlockedDomains } from './blocks/TopBlockedDomains';
import { TopUpstreams } from './blocks/TopUpstreams';
import { UpstreamAvgTime } from './blocks/UpstreamAvgTime';

import s from './Dashboard.module.pcss';

/** How often the status band's numbers are refetched. */
const STATS_REFRESH_MS = 30_000;

export const Dashboard = () => {
    const [remainingTime, setRemainingTime] = createSignal<number | null>(null);
    const [selectedPeriod, setSelectedPeriod] = createSignal(DAY);
    let timerRef: ReturnType<typeof setInterval> | null = null;

    const startCountdown = (duration: number) => {
        if (timerRef) {
            clearInterval(timerRef);
        }
        setRemainingTime(duration);
        timerRef = setInterval(() => {
            const prev = remainingTime();
            if (prev !== null && prev > ONE_SECOND_IN_MS) {
                setRemainingTime(prev - ONE_SECOND_IN_MS);
            } else {
                if (timerRef) {
                    clearInterval(timerRef);
                    timerRef = null;
                }
                toggleProtection(null);
                setRemainingTime(null);
            }
        }, ONE_SECOND_IN_MS);
    };

    createEffect(() => {
        const protectionDisabledDuration = dashboardState.protectionDisabledDuration;
        if (protectionDisabledDuration && protectionDisabledDuration > 0 && timerRef === null) {
            startCountdown(protectionDisabledDuration);
        }
    });

    onCleanup(() => {
        if (timerRef) {
            clearInterval(timerRef);
        }
    });

    const effectiveMaxStatsInterval = createMemo(() => {
        const maxStatsInterval = statsState.interval || DAY;
        return maxStatsInterval >= HOUR ? maxStatsInterval : DAY;
    });

    const periodIntervals = createMemo(() => {
        const intervals = STATS_INTERVALS_DAYS.filter(
            (interval) => interval <= effectiveMaxStatsInterval(),
        );

        if (!intervals.includes(effectiveMaxStatsInterval())) {
            intervals.push(effectiveMaxStatsInterval());
        }

        return intervals.sort((a, b) => a - b);
    });

    const periodOptions = createMemo(() =>
        periodIntervals().map((interval) => ({
            value: interval,
            label: getPeriodLabel(interval),
        })),
    );

    createEffect(() => {
        const maxAvailable = periodIntervals()[periodIntervals().length - 1];
        if (maxAvailable && selectedPeriod() > maxAvailable) {
            setSelectedPeriod(maxAvailable);
        }
    });

    createEffect(() => {
        const period = selectedPeriod();
        getStats(period);
        getStatsConfig();
        getClients();
        getAccessList();
        // The posture row needs to know which encrypted protocols are live.
        // handleTLSStatus only marshals already-cached config, so this costs a
        // round trip and no server work.
        getTlsStatus();
    });

    const handleRefreshStats = () => {
        getStats(selectedPeriod());
        getStatsConfig();
        getClients();
        getAccessList();
    };

    const handleToggleProtection = (enabled: boolean, duration?: number) => {
        if (!enabled && timerRef) {
            clearInterval(timerRef);
            timerRef = null;
            setRemainingTime(null);
        }
        toggleProtection(enabled ? duration : null);
    };

    const handlePeriodChange = (period: number) => {
        setSelectedPeriod(period);
    };

    const isLoading = () =>
        statsState.processingStats || statsState.processingGetConfig || accessState.processing;

    /**
     * Reading the series inside the memo is what ties the clock reading to the
     * fetch: the rate has to be "queries per minute of the hour as it stood
     * when this snapshot was taken", not "minutes since the page loaded",
     * which would make the number sag the longer the tab stayed open.
     */
    const metrics = createMemo(() =>
        getLiveMetrics({
            queries: [...statsState.dnsQueries],
            blocked: [...statsState.blockedFiltering],
            hourly: statsState.timeUnits === TIME_UNITS.HOURS,
            minutesIntoHour: new Date().getMinutes(),
        }),
    );

    // The feed beside the band updates every couple of seconds, so the band
    // cannot be left to the Refresh button alone — a live stream next to a
    // half-hour-old block rate is worse than no band at all.  Only the
    // statistics are refetched here; clients, access and TLS do not move on
    // this timescale.
    onMount(() => {
        const statsTimer = setInterval(() => {
            getStats(selectedPeriod());
        }, STATS_REFRESH_MS);

        onCleanup(() => clearInterval(statsTimer));
    });

    return (
        <div class={theme.layout.container}>
            <div class={theme.layout.containerIn}>
                <Header
                    selectedPeriod={selectedPeriod()}
                    periodOptions={periodOptions()}
                    isLoading={isLoading()}
                    onRefreshStats={handleRefreshStats}
                    onPeriodChange={handlePeriodChange}
                />

                <Posture
                    protectionEnabled={!!dashboardState.protectionEnabled}
                    processingProtection={dashboardState.processingProtection}
                    remainingTime={remainingTime()}
                    encryptionEnabled={!!encryptionState.enabled}
                    portHttps={encryptionState.port_https}
                    portTls={encryptionState.port_dns_over_tls}
                    portQuic={encryptionState.port_dns_over_quic}
                    dnsAddresses={dashboardState.dnsAddresses}
                    dnsPort={dashboardState.dnsPort}
                    avgProcessingTime={statsState.avgProcessingTime}
                    metrics={metrics()}
                    onToggleProtection={handleToggleProtection}
                />

                {/* The console sits outside the statistics loader on purpose:
                    the feed has its own source and fills in immediately, so
                    the page shows live traffic while the counters load. */}
                <div class={s.console}>
                    <QueryStream />

                    <TopTalkers
                        topQueriedDomains={statsState.topQueriedDomains}
                        numDnsQueries={statsState.numDnsQueries}
                    />
                </div>

                <Show
                    when={!isLoading()}
                    fallback={
                        <div class={s.loader}>
                            <PageLoader />
                        </div>
                    }
                >
                    <h2 class={cn(theme.title.h5, s.sectionTitle)}>
                        {intl.getMessage('dashboard_statistics')}
                    </h2>

                    <StatCards
                        numDnsQueries={statsState.numDnsQueries}
                        numBlockedFiltering={statsState.numBlockedFiltering}
                        numReplacedSafebrowsing={statsState.numReplacedSafebrowsing}
                        numReplacedParental={statsState.numReplacedParental}
                        dnsQueries={statsState.dnsQueries}
                        blockedFiltering={statsState.blockedFiltering}
                        replacedSafebrowsing={statsState.replacedSafebrowsing}
                        replacedParental={statsState.replacedParental}
                    />

                    <Show
                        when={statsState.enabled}
                        fallback={<EmptyState mode="disabled" class={s.emptyState} />}
                    >
                        <div class={s.statContainer}>
                            <GeneralStatistics
                                numDnsQueries={statsState.numDnsQueries}
                                numBlockedFiltering={statsState.numBlockedFiltering}
                                numReplacedSafebrowsing={statsState.numReplacedSafebrowsing}
                                numReplacedParental={statsState.numReplacedParental}
                                numReplacedSafesearch={statsState.numReplacedSafesearch}
                                avgProcessingTime={statsState.avgProcessingTime}
                            />

                            <TopClients
                                topClients={statsState.topClients}
                                numDnsQueries={statsState.numDnsQueries}
                            />

                            <TopQueriedDomains
                                topQueriedDomains={statsState.topQueriedDomains}
                                numDnsQueries={statsState.numDnsQueries}
                            />

                            <TopBlockedDomains
                                topBlockedDomains={statsState.topBlockedDomains}
                                numBlockedFiltering={statsState.numBlockedFiltering}
                            />

                            <TopUpstreams
                                topUpstreamsResponses={statsState.topUpstreamsResponses}
                                numDnsQueries={statsState.numDnsQueries}
                            />

                            <UpstreamAvgTime
                                topUpstreamsAvgTime={statsState.topUpstreamsAvgTime}
                                avgProcessingTime={statsState.avgProcessingTime}
                            />
                        </div>
                    </Show>
                </Show>
            </div>
        </div>
    );
};
