import { describe, it, expect } from 'vitest';

import { withAlpha } from 'panel/helpers/useThemeToken';

describe('withAlpha', () => {
    it('adds an alpha channel to the oklch notation the palette resolves to', () => {
        expect(withAlpha('oklch(63.7% 0.190 38)', 0.3)).toBe('oklch(63.7% 0.190 38 / 0.3)');
    });

    it('tolerates the whitespace getComputedStyle leaves behind', () => {
        expect(withAlpha('  oklch(48.7% 0.000 0)  ', 0)).toBe('oklch(48.7% 0.000 0 / 0)');
    });

    it('leaves a colour that already carries an alpha alone', () => {
        // Re-applying would produce oklch(... / 0.5 / 0.3), which is invalid
        // and throws when handed to a canvas gradient stop.
        expect(withAlpha('oklch(63.7% 0.19 38 / 0.5)', 0.3)).toBe('oklch(63.7% 0.19 38 / 0.5)');
    });

    it('still handles the hex and rgb notations', () => {
        expect(withAlpha('#e9653a', 0.3)).toBe('rgba(233, 101, 58, 0.3)');
        expect(withAlpha('#abc', 1)).toBe('rgba(170, 187, 204, 1)');
        expect(withAlpha('rgb(1, 2, 3)', 0.5)).toBe('rgba(1, 2, 3, 0.5)');
    });

    it('falls back to a flat colour rather than throwing on something unknown', () => {
        expect(withAlpha('rebeccapurple', 0.3)).toBe('rebeccapurple');
    });
});
