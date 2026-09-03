import { type JSX, Show } from 'solid-js';
import cn from 'clsx';

import theme from 'panel/lib/theme';

import s from './Section.module.pcss';

type Props = {
    /** Shown above the card as a small tracked label, not as a heading. */
    title: string;
    /** Anchor for the sidebar's deep links, e.g. ?section=query-log. */
    id?: string;
    /** Rows, forms, whatever the section is made of. */
    children: JSX.Element;
    /**
     * A destructive action gets its own band on a recessed ground at the foot
     * of the card, rather than being one more row in the same reading flow as
     * the controls above it.
     */
    footer?: JSX.Element;
    class?: string;
};

/**
 * One settings section: a small uppercase label, then a bordered card holding
 * the rows.
 *
 * This is the NexGuard portal's arrangement — its .ng-section-header above its
 * .ng-settings-card — kept in one component so every page in this panel gets
 * the same thing.  Before, each page invented its own: some sections were a
 * 24px heading over bare rows on the page background, some were a row title
 * carrying a switch, and only one page had cards at all.
 */
export const Section = (props: Props) => (
    <section class={cn(s.section, props.class)}>
        <h2 class={cn(theme.text.t4, s.label)} id={props.id}>
            {props.title}
        </h2>

        <div class={s.card}>
            <div class={s.body}>{props.children}</div>

            <Show when={props.footer}>
                <div class={s.footer}>{props.footer}</div>
            </Show>
        </div>
    </section>
);
