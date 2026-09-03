import { createSignal, onCleanup, onMount } from 'solid-js';

/**
 * Canvas cannot read CSS custom properties, so anything drawn into a chart has
 * to resolve them in JavaScript first.  Resolving them once at module load is
 * wrong: the value changes when the theme does.
 *
 * Reading them from an effect that watches the theme store is also wrong, since
 * the store update and the `data-theme` attribute write land in the same flush
 * with no ordering guarantee — a reader can run while the attribute still holds
 * the previous theme and resolve the stale colour.
 *
 * Observing the attribute itself sidesteps both problems: the observer fires
 * only after the attribute has actually changed, so `getComputedStyle` always
 * sees the theme that is really applied.  CSS stays the single source of truth
 * for every colour, including the ones the canvas draws.
 */
export function useThemeTokens<K extends string>(
    names: Record<K, string>,
): () => Record<K, string> {
    const read = (): Record<K, string> => {
        const style = getComputedStyle(document.documentElement);
        const out = {} as Record<K, string>;

        for (const key of Object.keys(names) as K[]) {
            out[key] = style.getPropertyValue(names[key]).trim();
        }

        return out;
    };

    // Start empty rather than reading here: this runs during component setup,
    // which on the server and in tests has no document to measure.
    const [tokens, setTokens] = createSignal<Record<K, string>>({} as Record<K, string>);

    onMount(() => {
        setTokens(() => read());

        const observer = new MutationObserver(() => setTokens(() => read()));

        observer.observe(document.documentElement, {
            attributeFilter: ['data-theme'],
        });

        onCleanup(() => observer.disconnect());
    });

    return tokens;
}

/**
 * Applies an alpha channel to a resolved token so it can be used as a canvas
 * gradient stop.
 *
 * Chart.js gradients need a concrete colour string, and the tokens resolve to
 * whatever notation the palette uses.  Appending two hex digits — the trick the
 * hardcoded palette relied on — silently produces an invalid colour for any
 * other notation, and an invalid gradient stop throws, so parse instead.
 */
export function withAlpha(color: string, alpha: number): string {
    const hex = color.trim();

    // The palette is authored in oklch(), so this is the notation the tokens
    // actually resolve to.  Without this branch every gradient stop fell
    // through to the flat-colour fallback below and the chart fills lost their
    // fade — a silent regression, since a flat fill still renders.
    const oklch = /^(oklch|oklab|lch|lab|color)\(([^)]*)\)$/i.exec(hex);
    if (oklch && !oklch[2].includes('/')) {
        return `${oklch[1]}(${oklch[2].trim()} / ${alpha})`;
    }

    const short = /^#([\da-f])([\da-f])([\da-f])$/i.exec(hex);
    if (short) {
        const [, r, g, b] = short;
        return `rgba(${parseInt(r + r, 16)}, ${parseInt(g + g, 16)}, ${parseInt(b + b, 16)}, ${alpha})`;
    }

    const long = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(hex);
    if (long) {
        const [, r, g, b] = long;
        return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, ${alpha})`;
    }

    const numbers = hex.match(/[\d.]+/g);
    if (/^rgba?\(/i.test(hex) && numbers && numbers.length >= 3) {
        const [r, g, b] = numbers;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // Unknown notation: better a flat fill than a throwing gradient stop.
    return hex;
}
