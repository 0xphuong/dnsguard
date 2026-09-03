import { createMemo, createSignal, For, Show } from 'solid-js';
import cn from 'clsx';

import intl from 'panel/common/intl';
import theme from 'panel/lib/theme';
import { Button } from 'panel/common/ui/Button';
import { formatCompactNumber } from 'panel/helpers/helpers';
import { blockDomain } from 'panel/stores/filtering';
import { addErrorToast } from 'panel/stores/toasts';

import s from './TopTalkers.module.pcss';

/** Rows shown.  This is a shortlist to act on, not a table to study. */
const ROWS = 5;

type DomainInfo = {
    name: string;
    count: number;
};

type Props = {
    /**
     * Top queried domains.  The resolver only counts a domain here when the
     * query was *not* filtered — see `unit.add` in `internal/stats/unit.go`,
     * which increments `domains` only for `RNotFiltered` — so every row is a
     * domain currently getting through, which is exactly what makes a Block
     * button meaningful.
     */
    topQueriedDomains: DomainInfo[];
    numDnsQueries: number;
};

/**
 * The shortlist of what the resolver is letting through most.  The statistics
 * grid below has the same numbers with sorting and tracker detail; this card
 * exists to be acted on, and so carries the action instead.
 */
export const TopTalkers = (props: Props) => {
    const [pending, setPending] = createSignal<string[]>([]);
    const [blocked, setBlocked] = createSignal<string[]>([]);

    const rows = createMemo(() => props.topQueriedDomains.slice(0, ROWS));

    const handleBlock = async (domain: string) => {
        setPending((prev) => [...prev, domain]);
        try {
            const ok = await blockDomain(domain);
            if (ok) {
                // The statistics only drop the domain on their next refresh,
                // so the row says so itself in the meantime.
                setBlocked((prev) => [...prev, domain]);
            }
        } catch (error) {
            addErrorToast({ error });
        } finally {
            setPending((prev) => prev.filter((d) => d !== domain));
        }
    };

    return (
        <section class={s.card} data-testid="top-talkers">
            <header class={s.header}>
                <h2 class={cn(theme.text.t4, s.title)}>{intl.getMessage('top_talkers_title')}</h2>
                <span class={cn(theme.text.t4, s.subtitle)}>
                    {intl.getMessage('top_talkers_subtitle')}
                </span>
            </header>

            <Show
                when={rows().length > 0}
                fallback={
                    <p class={cn(theme.text.t3, s.empty)}>
                        {intl.getMessage('top_talkers_empty')}
                    </p>
                }
            >
                <For each={rows()}>
                    {(row) => {
                        const share = createMemo(() =>
                            props.numDnsQueries > 0 ? (row.count / props.numDnsQueries) * 100 : 0,
                        );

                        return (
                            <div class={s.row}>
                                <span class={cn(theme.text.t3, s.domain)} title={row.name}>
                                    {row.name}
                                </span>

                                <span
                                    class={cn(theme.text.t4, s.count)}
                                    title={intl.getMessage('queries_tooltip', {
                                        value: String(row.count),
                                    })}
                                >
                                    {formatCompactNumber(row.count)}
                                    <span class={s.share}> ({share().toFixed(1)}%)</span>
                                </span>

                                <Show
                                    when={!blocked().includes(row.name)}
                                    fallback={
                                        <span class={cn(theme.text.t4, s.blockedLabel)}>
                                            {intl.getMessage('blocked')}
                                        </span>
                                    }
                                >
                                    <Button
                                        variant="secondary-danger"
                                        size="very-small"
                                        compact
                                        class={s.blockButton}
                                        disabled={pending().includes(row.name)}
                                        aria-label={intl.getMessage('live_stream_block_domain', {
                                            value: row.name,
                                        })}
                                        onClick={() => void handleBlock(row.name)}
                                    >
                                        {intl.getMessage('block')}
                                    </Button>
                                </Show>
                            </div>
                        );
                    }}
                </For>
            </Show>
        </section>
    );
};
