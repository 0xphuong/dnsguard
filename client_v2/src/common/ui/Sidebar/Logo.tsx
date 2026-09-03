import { Show } from 'solid-js';
import cn from 'clsx';

import s from './styles.module.pcss';

type Props = {
    /** Kept for call-site compatibility; nothing in the markup needs it now. */
    id?: string;
    /**
     * Renders the full lock-up — shield and wordmark as one image — instead of
     * the shield beside live text.
     *
     * Only for light grounds.  The wordmark artwork is drawn in navy: its
     * darkest pixels measure #081a30 and #02172c, which is 1.02:1 and 1.01:1
     * against the sidebar's #0f172a, so on the dark chrome the word would
     * simply not be there.  The sidebar therefore keeps the shield with live
     * text, which follows whatever the theme sets.
     */
    full?: boolean;
    class?: string;
};

export const Logo = (props: Props) => (
    <Show
        when={props.full}
        fallback={
            <span class={cn(s.logo, props.class)}>
                <img
                    src="assets/logo-shield.png"
                    width="24"
                    height="24"
                    alt=""
                    class={s.logoMark}
                />
                <span class={s.logoText}>
                    <span class={s.logoCompany}>DNS</span>
                    <span class={s.logoProduct}>Guard</span>
                </span>
            </span>
        }
    >
        <img
            src="assets/logo-full.png"
            width="168"
            height="56"
            alt="DNSGuard"
            class={cn(s.logoFull, props.class)}
        />
    </Show>
);
