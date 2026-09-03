import { type JSX, Show } from 'solid-js';
import cn from 'clsx';

import theme from 'panel/lib/theme';

import s from './PageHeader.module.pcss';

type Props = {
    title: string;
    /** One line saying what the page is for.  Optional, but preferred. */
    subtitle?: string;
    /** The page-level action, if it has one. */
    actions?: JSX.Element;
    class?: string;
    titleId?: string;
};

/**
 * The band every page opens with: a rule beneath the title, the page's name,
 * one line saying what it is for, and the page-level action on the right.
 *
 * Ported from the NexGuard portal, where the same band heads all
 * twenty-four screens.  Before this, a page here was a bare h1 with no
 * subtitle and no separation from its content, so nothing told a reader what
 * a screen was for before they started reading its controls.
 */
export const PageHeader = (props: Props) => (
    <header class={cn(s.header, props.class)}>
        <div class={s.text}>
            <h1
                id={props.titleId}
                class={cn(theme.title.h4, theme.title.h3_tablet, s.title)}
            >
                {props.title}
            </h1>

            <Show when={props.subtitle}>
                <p class={cn(theme.text.t3, s.subtitle)}>{props.subtitle}</p>
            </Show>
        </div>

        <Show when={props.actions}>
            <div class={s.actions}>{props.actions}</div>
        </Show>
    </header>
);
