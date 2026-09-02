import { type JSX, Show } from 'solid-js';
import cn from 'clsx';

import s from './Switch.module.pcss';

type Props = Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> & {
    id: string;
    checked: boolean;
    disabled?: boolean;
    labelClass?: string;
    class?: string;
    wrapperClass?: string;
    onChange: (e: Event) => void;
    children?: JSX.Element;
    ref?: HTMLInputElement | ((el: HTMLInputElement) => void);
    /**
     * Forwarded explicitly rather than by spreading the rest of the props.
     * Props extends InputHTMLAttributes, so the type checker accepted these
     * already, but the input never received them — three call sites were
     * passing a data-testid that never reached the DOM.  Spreading the
     * remainder does deliver them, but it switches Solid to its spread path
     * and the reactive `checked` binding stops reverting, which the DHCP
     * toggle test catches.
     */
    'data-testid'?: string;
    'aria-describedby'?: string;
    'aria-label'?: string;
};

export const Switch = (props: Props) => {
    const setRef = (el: HTMLInputElement) => {
        if (typeof props.ref === 'function') {
            props.ref(el);
        }
    };

    const switchControls = (
        <>
            <input
                id={props.id}
                data-testid={props['data-testid']}
                aria-describedby={props['aria-describedby']}
                aria-label={props['aria-label']}
                type="checkbox"
                class={s.input}
                onChange={(e) => props.onChange?.(e)}
                checked={props.checked}
                disabled={props.disabled}
                ref={(el) => setRef(el)}
            />
            <div class={s.handler} />
            <Show when={props.children}>
                <div class={cn(s.label, props.labelClass)}>{props.children}</div>
            </Show>
        </>
    );

    return (
        <label for={props.id} class={cn(s.switch, props.class, { [s.disabled]: props.disabled })}>
            <Show when={props.wrapperClass} fallback={switchControls}>
                <div class={props.wrapperClass}>{switchControls}</div>
            </Show>
        </label>
    );
};
