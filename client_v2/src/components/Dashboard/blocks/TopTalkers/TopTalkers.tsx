import { createMemo, createSignal, For, Match, Show, Switch } from 'solid-js';
import cn from 'clsx';

import intl from 'panel/common/intl';
import theme from 'panel/lib/theme';
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
                        const state = () => ruleState(row.name);

                        return (
                            <div class={s.row}>
                                {/* The state is a dot rather than a word: the
                                    rail has room for one action, and the
                                    action already names the state — a row
                                    offering Unblock is a blocked row. */}
                                <Show
                                    when={state() !== 'none'}
                                    fallback={<span class={s.dotCell} />}
                                >
                                    <span
                                        class={cn(s.dotCell, s.dot, {
                                            [s.dotBlocked]: state() === 'blocked',
                                            [s.dotAllowed]: state() === 'allowed',
                                        })}
                                        role="img"
                                        aria-label={
                                            state() === 'blocked'
                                                ? intl.getMessage('blocked')
                                                : intl.getMessage('top_talkers_allowed_by_rule')
                                        }
                                        title={
                                            state() === 'blocked'
                                                ? intl.getMessage('blocked')
                                                : intl.getMessage('top_talkers_allowed_by_rule')
                                        }
                                    />
                                </Show>

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
                                </span>

                                <Switch>
                                    <Match when={state() === 'blocked'}>
                                        <button
                                            type="button"
                                            class={cn(theme.text.t4, s.action, s.actionUndo)}
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
                                        </button>
                                    </Match>

                                    {/* An exception already overrides any block,
                                        so offering one here would do nothing. */}
                                    <Match when={state() === 'allowed'}>
                                        <span class={s.action} />
                                    </Match>

                                    <Match when={true}>
                                        <button
                                            type="button"
                                            class={cn(theme.text.t4, s.action, s.actionBlock)}
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
                                        </button>
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
