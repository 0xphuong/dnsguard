import { type JSX, Show, createMemo } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import cn from 'clsx';

import { Switch } from 'panel/common/controls/Switch';
import { Icon } from 'panel/common/ui/Icon';

import s from './SettingRow.module.pcss';
import theme from 'panel/lib/theme';

type SettingRowVariant = 'switch' | 'link' | 'switch-link';

type Props = {
    id: string;
    title: string;
    titleClass?: string;
    description?: string | JSX.Element;
    descriptionClass?: string;
    value?: string;
    variant: SettingRowVariant;
    checked?: boolean;
    disabled?: boolean;
    onChange?: (checked: boolean) => void;
    onClick?: () => void;
    class?: string;
    children?: JSX.Element;
    divider?: boolean;
    align?: 'top' | 'center';
    /**
     * Element to render the title as.  A row that heads a section needs to be
     * a real heading: three of this page's section titles looked identical at
     * 24px, but only one was an h2, so two sections were missing from the
     * document outline entirely.
     */
    titleAs?: 'div' | 'h2' | 'h3';
    titleId?: string;
    /**
     * Sets the value line in the monospace face with tabular figures.  Opt-in
     * rather than default, because the same slot carries prose summaries
     * elsewhere — "Last 90 days" has no business being monospaced — while on
     * the DNS page it holds resolver URLs, IPv4 and IPv6 literals, and
     * numbers with units.
     */
    valueMono?: boolean;
    largeTitle?: boolean;
    inputClass?: string;
};

export const SettingRow = (props: Props) => {
    let inputRef: HTMLInputElement | undefined;

    /**
     * Two rows on the settings page are both titled "Ignored domains" — one
     * scoped to the query log, one to the statistics.  Their section headings
     * tell them apart visually, but a screen reader listing form controls gets
     * neither the heading nor the column, so it hears the same name twice.
     * Tying the control to its own description fixes that with the strings the
     * page already has, rather than lengthening the visible titles.
     */
    const descriptionId = createMemo(() => (props.description ? `${props.id}-desc` : undefined));

    const isSwitch = createMemo(() => props.variant === 'switch');
    const isLink = createMemo(() => props.variant === 'link');
    const isSwitchLink = createMemo(() => props.variant === 'switch-link');

    const handleRowClick = (e?: MouseEvent) => {
        if (props.disabled) {
            return;
        }
        // Skip programmatic click if the user already clicked the switch/label
        // — the native label behaviour already toggles it.
        if (e) {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.closest('label')) {
                return;
            }
        }
        if (isSwitch()) {
            inputRef?.click();
        } else if (isLink() || isSwitchLink()) {
            props.onClick?.();
        }
    };

    const handleSwitchChange = (e: Event) => {
        e.stopPropagation();
        if (props.disabled) {
            return;
        }
        const target = e.target as HTMLInputElement;
        props.onChange?.(target.checked);
    };

    const handleLinkClick = (e: Event) => {
        e.stopPropagation();
        if (props.disabled) {
            return;
        }
        props.onClick?.();
    };

    const handleInputClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const isSwitchClick = target.tagName === 'INPUT' || !!target.closest('label');

        // Native label click already toggled the switch — don't double-fire.
        if (isSwitchClick) {
            return;
        }

        if ((isSwitch() || isSwitchLink()) && !props.disabled) {
            e.stopPropagation();
            inputRef?.click();
        }
    };

    const isSwitchVariant = () => isSwitch() || isSwitchLink();

    const isLinkVariant = () => isLink();

    return (
        <div
            class={cn(s.switch, props.class, {
                [s.switchDisabled]: props.disabled,
            })}
            role="button"
            tabIndex={props.disabled ? -1 : 0}
            onClick={handleRowClick}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleRowClick();
                }
            }}
        >
            <div
                class={cn(s.row, {
                    [s.rowTop]: props.align === 'top',
                    [s.rowCenter]: props.align === 'center',
                })}
            >
                <div class={s.text}>
                    <Dynamic
                        component={props.titleAs || 'div'}
                        id={props.titleId}
                        class={cn(s.title, props.titleClass, {
                            [s.titleDisabled]: props.disabled,
                        })}
                    >
                        {props.title}
                    </Dynamic>
                    <Show when={props.description}>
                        <div
                            id={descriptionId()}
                            class={cn(s.desc, props.descriptionClass, theme.text.t3, {
                                [s.descDisabled]: props.disabled,
                            })}
                        >
                            {props.description}
                        </div>
                    </Show>
                    <Show when={props.value}>
                        <div
                            /* The value line is clamped to two lines and then
                             * ellipsised, so a longer list of bootstrap servers
                             * or allowed clients loses content with nothing to
                             * recover it from. */
                            title={props.value}
                            class={cn(s.value, theme.text.t3, {
                                [s.valueDisabled]: props.disabled,
                                [s.valueMono]: props.valueMono,
                            })}
                        >
                            {props.value}
                        </div>
                    </Show>
                </div>
                <Show when={isSwitchLink() && props.divider}>
                    <div class={s.divider} />
                </Show>
                <div
                    class={cn(s.input, props.inputClass, props.largeTitle && s.largeTitle)}
                    onClick={handleInputClick}
                >
                    <Show when={isSwitchVariant()}>
                        <Switch
                            id={props.id}
                            aria-describedby={descriptionId()}
                            withState
                            checked={!!props.checked}
                            disabled={!!props.disabled}
                            onChange={handleSwitchChange}
                            ref={(el: HTMLInputElement) => {
                                inputRef = el;
                            }}
                        />
                    </Show>
                    {/* The row wrapper is already role="button", so a
                        switch-link row is clickable — but nothing said so, and
                        Safe search and both Ignored domains lists were
                        reachable only by guessing.  Decorative rather than a
                        second control: the row carries the accessible name,
                        and the switch beside it is its own control. */}
                    <Show when={isSwitchVariant()}>
                        <span
                            class={cn(s.staticArrow, { [s.staticArrowEmpty]: !isSwitchLink() })}
                            aria-hidden="true"
                        >
                            <Icon icon="arrow" class={s.arrow} />
                        </span>
                    </Show>
                    <Show when={isLinkVariant()}>
                        <button
                            type="button"
                            class={s.link}
                            aria-label={props.title}
                            aria-describedby={descriptionId()}
                            disabled={!!props.disabled}
                            onClick={handleLinkClick}
                        >
                            <Icon icon="arrow" class={s.arrow} />
                        </button>
                    </Show>
                </div>
            </div>
            <Show when={props.children}>
                <div class={s.content}>{props.children}</div>
            </Show>
        </div>
    );
};
