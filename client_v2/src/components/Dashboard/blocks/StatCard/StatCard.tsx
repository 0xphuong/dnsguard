import { createMemo, Show, untrack } from 'solid-js';
import cn from 'clsx';
import {
    Chart,
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Tooltip,
    Filler,
    type ScriptableContext,
} from 'chart.js';
import { Link } from 'panel/common/ui/Link';
import { type RoutePathKey } from 'panel/components/Routes/Paths';

import { formatNumber } from 'panel/helpers/helpers';
import {
    useChart,
    createCursorLinePlugin,
    createExternalTooltipHandler,
} from 'panel/helpers/useChart';
import intl from 'panel/common/intl';
import { useThemeTokens, withAlpha } from 'panel/helpers/useThemeToken';
import theme from 'panel/lib/theme';

import s from './StatCard.module.pcss';

Chart.register(
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Tooltip,
    Filler,
);

export const CARDS_THEME = {
    QUERIES: 'queries',
    ADS: 'ads',
    THREATS: 'threats',
    ADULT: 'adult',
};

// The chart colours live in CSS so that light and dark can differ; canvas
// cannot read custom properties, so the card resolves them at runtime.  See
// useThemeTokens for why the resolution is tied to the data-theme attribute.
const CARD_TOKENS: Record<(typeof CARDS_THEME)[keyof typeof CARDS_THEME], string> = {
    [CARDS_THEME.QUERIES]: '--chart-queries',
    [CARDS_THEME.ADS]: '--chart-ads',
    [CARDS_THEME.THREATS]: '--chart-threats',
    [CARDS_THEME.ADULT]: '--chart-adult',
};

const formatDate = (date: Date): string => {
    return date.toLocaleDateString(intl.getUILanguage(), {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
};

export type StatCardProps = {
    value: number;
    label: string;
    data: number[];
    percentValue?: number;
    cardTheme: (typeof CARDS_THEME)[keyof typeof CARDS_THEME];
    linkTo?: RoutePathKey;
    query?: Record<string, string | number | boolean>;
};

export const StatCard = (props: StatCardProps) => {
    const tokens = useThemeTokens({
        queries: CARD_TOKENS[CARDS_THEME.QUERIES],
        ads: CARD_TOKENS[CARDS_THEME.ADS],
        threats: CARD_TOKENS[CARDS_THEME.THREATS],
        adult: CARD_TOKENS[CARDS_THEME.ADULT],
    });

    // Falls back to the light-theme grey until the tokens resolve on mount, so
    // the first paint never draws an invisible line.
    const color = () => {
        const t = tokens();
        switch (props.cardTheme) {
            case CARDS_THEME.ADS:
                return t.ads || '#e9653a';
            case CARDS_THEME.THREATS:
                return t.threats || '#d58500';
            case CARDS_THEME.ADULT:
                return t.adult || '#a870b2';
            default:
                return t.queries || '#7f7f7f';
        }
    };

    // Ensure the chart has at least 2 data points
    const paddedData = () => (props.data.length < 2 ? [0, ...props.data] : props.data);

    const chartData = createMemo(() => {
        const data = paddedData();
        const labels = data.map((_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (data.length - 1 - i));
            return formatDate(date);
        });
        return {
            labels,
            datasets: [
                {
                    data: data,
                    borderColor: color(),
                    borderWidth: 1,
                    backgroundColor: (context: ScriptableContext<'line'>) => {
                        const ctx = context.chart.ctx;
                        const gradient = ctx.createLinearGradient(
                            0,
                            0,
                            0,
                            context.chart.height || 100,
                        );
                        gradient.addColorStop(0, withAlpha(color(), 0.3));
                        gradient.addColorStop(1, withAlpha(color(), 0));
                        return gradient;
                    },
                    fill: true,
                    clip: false as const,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    pointHoverBackgroundColor: color(),
                    tension: 0.4,
                },
            ],
        };
    });

    const cursorLinePlugin = createCursorLinePlugin(color);

    const externalTooltipHandler = createExternalTooltipHandler(
        () => tooltipEl,
        (dataPoint) => {
            const raw = dataPoint.raw as number;
            const label = dataPoint.label || '';
            return `<div class="${s.chartTooltipValue}">${formatNumber(raw)}</div><div class="${s.chartTooltipDate}">${label}</div>`;
        },
    );

    let tooltipEl!: HTMLDivElement;
    const setTooltipRef = (el: HTMLDivElement) => {
        tooltipEl = el;
    };

    const chartOptions = createMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        animation: false as const,
        layout: {
            padding: { top: 6, bottom: 12 },
        },
        plugins: {
            tooltip: {
                enabled: false,
                external: externalTooltipHandler,
            },
            legend: { display: false },
        },
        scales: {
            x: { display: false },
            y: { display: false, min: 0 },
        },
        interaction: {
            intersect: false,
            mode: 'index' as const,
        },
        elements: {
            line: { tension: 0.4 },
        },
    }));

    const percent = () => props.percentValue ?? 0;

    const setCanvasRef = untrack(() => useChart(chartData, chartOptions, [cursorLinePlugin]));

    return (
        <div
            class={cn(s.statCard, {
                [s.statCardQueries]: props.cardTheme === CARDS_THEME.QUERIES,
                [s.statCardAds]: props.cardTheme === CARDS_THEME.ADS,
                [s.statCardThreats]: props.cardTheme === CARDS_THEME.THREATS,
                [s.statCardAdult]: props.cardTheme === CARDS_THEME.ADULT,
            })}
        >
            <div class={s.statCardInner}>
                <div class={s.statCardHeader}>
                    <div class={cn(theme.text.t4, s.statCardLabel)}>
                        <Show when={props.linkTo} fallback={props.label}>
                            <Link to={props.linkTo!} query={props.query} class={s.statLabelLink}>
                                {props.label}
                            </Link>
                        </Show>
                    </div>

                    <Show when={props.cardTheme !== CARDS_THEME.QUERIES}>
                        <div class={cn(theme.text.t4, s.statCardPercent)}>
                            {percent().toFixed(0)}%
                        </div>
                    </Show>
                </div>

                <div class={s.statCardValue}>{formatNumber(props.value)}</div>

                <div class={s.statCardChart}>
                    <div ref={setTooltipRef} class={s.chartTooltip} />
                    <canvas ref={setCanvasRef} />
                </div>
            </div>
        </div>
    );
};
