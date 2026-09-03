import { createMemo, createSignal, For, Match, Show, Switch } from 'solid-js';
import cn from 'clsx';

import intl from 'panel/common/intl';
import theme from 'panel/lib/theme';
import { Button } from 'panel/common/ui/Button';
import { formatCompactNumber } from 'panel/helpers/helpers';
import { blockDomain, removeDomainBlock, filteringState } from 'panel/stores/filtering';
import { getDomainRuleState } from 'panel/helpers/domainRules';
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
};

/**
 * The shortlist of what the resolver is letting through most.  The statistics
 * grid below has the same numbers with sorting and tracker detail; this card
 * exists to be acted on, and so carries the action instead.
 */
export const TopTalkers = (props: Props) => {
    const [pending, setPending] = createSignal<string[]>([]);

    const rows = createMemo(() => props.topQueriedDomains.slice(0, ROWS));

    /**
     * Read from the user's rules rather than remembered locally.  A signal in
     * this component was the original defect: it could not survive a refresh,
     * knew nothing about rules made on the Logs or User rules pages, and left
     * a blocked row with no way back.
     */
    const ruleState = (domain: string) =>
        getDomainRuleState(filteringState.userRules, domain);

    const run = async (domain: string, action: () => Promise<boolean>) => {
        setPending((prev) => [...prev, domain]);
        try {
            await action();
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
                        return (
                            <div class={s.row}>
                                <span class={cn(theme.text.t3, s.domain)} title={row.name}>
                                    {row.name}
                                </span>

                                {/* No share here.  A blocked row carries a
                                    state and an undo as well, and four things
                                    do not fit the rail — the full table below
                                    is where the percentages belong. */}
                                <span
                                    class={cn(theme.text.t4, s.count)}
                                    title={intl.getMessage('queries_tooltip', {
                                        value: String(row.count),
                                    })}
                                >
                                    {formatCompactNumber(row.count)}
                                </span>

                                {/* Three states, because "nothing blocks
                                    this" and "you allowed this on purpose"
                                    are different facts in a firewall and used
                                    to look identical. */}
                                <Switch>
                                    <Match when={ruleState(row.name) === 'blocked'}>
                                        <span class={s.stateCell}>
                                            <span class={cn(theme.text.t4, s.blockedLabel)}>
                                                {intl.getMessage('blocked')}
                                            </span>
                                            <Button
                                                variant="secondary"
                                                size="very-small"
                                                compact
                                                class={s.blockButton}
                                                disabled={pending().includes(row.name)}
                                                aria-label={intl.getMessage(
                                                    'top_talkers_unblock_domain',
                                                    { value: row.name },
                                                )}
                                                onClick={() =>
                                                    void run(row.name, () =>
                                                        removeDomainBlock(row.name),
                                                    )
                                                }
                                            >
                                                {intl.getMessage('unblock')}
                                            </Button>
                                        </span>
                                    </Match>

                                    <Match when={ruleState(row.name) === 'allowed'}>
                                        <span class={cn(theme.text.t4, s.allowedLabel)}>
                                            {intl.getMessage('top_talkers_allowed_by_rule')}
                                        </span>
                                    </Match>

                                    <Match when={true}>
                                        <Button
                                            variant="secondary-danger"
                                            size="very-small"
                                            compact
                                            class={s.blockButton}
                                            disabled={pending().includes(row.name)}
                                            aria-label={intl.getMessage(
                                                'live_stream_block_domain',
                                                { value: row.name },
                                            )}
                                            onClick={() =>
                                                void run(row.name, () => blockDomain(row.name))
                                            }
                                        >
                                            {intl.getMessage('block')}
                                        </Button>
                                    </Match>
                                </Switch>
                            </div>
                        );
                    }}
                </For>
            </Show>
        </section>
    );
};
