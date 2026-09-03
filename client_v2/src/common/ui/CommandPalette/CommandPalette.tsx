import { createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import cn from 'clsx';

import intl from 'panel/common/intl';
import { Icon } from 'panel/common/ui/Icon';
import { Paths, RoutePath, type RoutePathKey } from 'panel/components/Routes/Paths';
import { blockDomain } from 'panel/stores/filtering';
import { addSuccessToast, addErrorToast } from 'panel/stores/toasts';

import s from './CommandPalette.module.pcss';

/** Pages worth jumping to, in the order an operator is likely to want them. */
const DESTINATIONS: { key: RoutePathKey; label: () => string }[] = [
    { key: RoutePath.Dashboard, label: () => intl.getMessage('dashboard') },
    { key: RoutePath.QueryLog, label: () => intl.getMessage('query_log') },
    { key: RoutePath.Clients, label: () => intl.getMessage('clients') },
    { key: RoutePath.SettingsPage, label: () => intl.getMessage('settings_general_short') },
    { key: RoutePath.Dns, label: () => intl.getMessage('dns_settings') },
    { key: RoutePath.Encryption, label: () => intl.getMessage('encryption_title') },
    { key: RoutePath.DnsBlocklists, label: () => intl.getMessage('blocklists_title') },
    { key: RoutePath.DnsAllowlists, label: () => intl.getMessage('allowlists') },
    { key: RoutePath.CustomRules, label: () => intl.getMessage('custom_rules') },
    { key: RoutePath.DnsRewrites, label: () => intl.getMessage('dns_rewrites') },
    { key: RoutePath.Dhcp, label: () => intl.getMessage('dhcp') },
];

/**
 * Loose enough to accept what someone actually types into a hurry — no scheme,
 * no trailing dot, at least one label and a TLD of two or more letters.  It
 * only decides whether to *offer* the block action; the server still validates
 * the rule.
 */
const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

type Entry =
    | { kind: 'nav'; id: string; label: string; path: string }
    | { kind: 'block'; id: string; domain: string };

/**
 * A keyboard-first way across the interface.
 *
 * The app has fourteen routes behind a sidebar that only lists six of them, so
 * reaching a blocklist or the user rules means remembering which section owns
 * it.  This also puts the one action an operator most often wants while reading
 * a log — block this domain — one shortcut away instead of three pages deep.
 */
export const CommandPalette = () => {
    const [open, setOpen] = createSignal(false);
    const [query, setQuery] = createSignal('');
    const [cursor, setCursor] = createSignal(0);
    const navigate = useNavigate();

    let inputRef: HTMLInputElement | undefined;

    const close = () => {
        setOpen(false);
        setQuery('');
        setCursor(0);
    };

    const entries = createMemo<Entry[]>(() => {
        const q = query().trim().toLowerCase();

        const nav: Entry[] = DESTINATIONS.map((d) => ({
            kind: 'nav' as const,
            id: `nav:${d.key}`,
            label: d.label(),
            path: Paths[d.key],
        })).filter((e) => !q || e.label.toLowerCase().includes(q));

        const domain = query().trim().toLowerCase();
        const canBlock = DOMAIN_RE.test(domain);

        return canBlock ? [{ kind: 'block', id: `block:${domain}`, domain }, ...nav] : nav;
    });

    const run = async (entry: Entry) => {
        if (entry.kind === 'nav') {
            close();
            navigate(entry.path);

            return;
        }

        // Close first: the request is not instant, and leaving the palette open
        // over a pending action invites a second Enter.
        close();

        try {
            const ok = await blockDomain(entry.domain);
            if (ok) {
                addSuccessToast({ message: 'changes_saved_success' });
            }
        } catch (error) {
            addErrorToast({ error });
        }
    };

    const onKeyDown = (e: KeyboardEvent) => {
        const isToggle = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';

        if (isToggle) {
            e.preventDefault();
            setOpen((v) => !v);

            return;
        }

        if (!open()) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            close();

            return;
        }

        const list = entries();
        if (!list.length) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setCursor((c) => (c + 1) % list.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setCursor((c) => (c - 1 + list.length) % list.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            void run(list[Math.min(cursor(), list.length - 1)]);
        }
    };

    onMount(() => {
        window.addEventListener('keydown', onKeyDown);
        onCleanup(() => window.removeEventListener('keydown', onKeyDown));
    });

    return (
        <Show when={open()}>
            <div
                class={s.overlay}
                data-testid="command-palette"
                onClick={(e) => {
                    if (e.target === e.currentTarget) close();
                }}
            >
                <div class={s.panel} role="dialog" aria-modal="true" aria-label={intl.getMessage('palette_open_hint')}>
                    <div class={s.inputRow}>
                        <Icon icon="search" class={s.icon} />

                        <input
                            ref={(el) => {
                                inputRef = el;
                                // Autofocus on open; the palette only exists
                                // while it is open, so mount is the moment.
                                queueMicrotask(() => inputRef?.focus());
                            }}
                            class={s.input}
                            placeholder={intl.getMessage('palette_placeholder')}
                            value={query()}
                            onInput={(e) => {
                                setQuery(e.currentTarget.value);
                                setCursor(0);
                            }}
                        />

                        <span class={s.esc}>esc</span>
                    </div>

                    <div class={s.list}>
                        <Show
                            when={entries().length}
                            fallback={<div class={s.empty}>{intl.getMessage('palette_empty')}</div>}
                        >
                            <For each={entries()}>
                                {(entry, i) => (
                                    <>
                                        <Show when={entry.kind === 'block'}>
                                            <div class={s.group}>
                                                {intl.getMessage('palette_actions')}
                                            </div>
                                        </Show>
                                        <Show
                                            when={
                                                entry.kind === 'nav' &&
                                                (i() === 0 || entries()[i() - 1].kind === 'block')
                                            }
                                        >
                                            <div class={s.group}>
                                                {intl.getMessage('palette_navigate')}
                                            </div>
                                        </Show>

                                        <button
                                            type="button"
                                            class={cn(s.item, { [s.itemActive]: i() === cursor() })}
                                            onMouseEnter={() => setCursor(i())}
                                            onClick={() => void run(entry)}
                                        >
                                            <Show
                                                when={entry.kind === 'block'}
                                                fallback={
                                                    <span class={s.itemLabel}>
                                                        {(entry as { label: string }).label}
                                                    </span>
                                                }
                                            >
                                                <span class={cn(s.itemLabel, s.danger)}>
                                                    {intl.getMessage('palette_block_domain', {
                                                        value: (entry as { domain: string }).domain,
                                                    })}
                                                </span>
                                            </Show>

                                            <span class={s.itemHint}>↵</span>
                                        </button>
                                    </>
                                )}
                            </For>
                        </Show>
                    </div>
                </div>
            </div>
        </Show>
    );
};
