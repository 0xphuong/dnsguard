import { createSignal, createMemo, createEffect, onCleanup, Show } from 'solid-js';

import theme from 'panel/lib/theme';
import { PageLoader } from 'panel/common/ui/Loader';
import { dashboardState, toggleProtection, getClients } from 'panel/stores/dashboard';
import { statsState, getStats, getStatsConfig } from 'panel/stores/stats';
import { accessState, getAccessList } from 'panel/stores/access';
import { encryptionState, getTlsStatus } from 'panel/stores/encryption';
import { ONE_SECOND_IN_MS, HOUR, DAY, STATS_INTERVALS_DAYS } from 'panel/helpers/constants';

import { Header, getPeriodLabel } from './blocks/Header/Header';
import { Posture } from './blocks/Posture';
import { StatCards } from './blocks/StatCards';
import { EmptyState } from './blocks/EmptyState/EmptyState';
import { GeneralStatistics } from './blocks/GeneralStatistics';
import { TopClients } from './blocks/TopClients';
import { TopQueriedDomains } from './blocks/TopQueriedDomains';
import { TopBlockedDomains } from './blocks/TopBlockedDomains';
import { TopUpstreams } from './blocks/TopUpstreams';
import { UpstreamAvgTime } from './blocks/UpstreamAvgTime';

import s from './Dashboard.module.pcss';

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
                    // Distinct clients seen in the selected period, so this
                    // agrees with the Top clients card rather than counting
                    // configured and auto-discovered entries.
                    clientCount={statsState.topClients.length}
                    avgProcessingTime={statsState.avgProcessingTime}
                    onToggleProtection={handleToggleProtection}
                />

                <Show
                    when={!isLoading()}
                    fallback={
                        <div class={s.loader}>
                            <PageLoader />
                        </div>
                    }
                >
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
