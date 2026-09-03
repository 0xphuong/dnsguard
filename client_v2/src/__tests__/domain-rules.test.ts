import { describe, it, expect } from 'vitest';

import {
    getDomainRuleState,
    withoutDomainBlock,
    blockRuleFor,
} from 'panel/helpers/domainRules';

describe('getDomainRuleState', () => {
    it('reports nothing when no rule mentions the domain', () => {
        expect(getDomainRuleState('||other.com^$important\n', 'ads.com')).toBe('none');
    });

    it('recognises the rule the interface itself writes', () => {
        expect(getDomainRuleState(blockRuleFor('ads.com'), 'ads.com')).toBe('blocked');
    });

    it('recognises the plainer form typed by hand', () => {
        expect(getDomainRuleState('||ads.com^', 'ads.com')).toBe('blocked');
    });

    it('lets an exception win over a block, as the resolver does', () => {
        const rules = ['||ads.com^$important', '@@||ads.com^$important'].join('\n');
        expect(getDomainRuleState(rules, 'ads.com')).toBe('allowed');
    });

    it('reads an exception on its own as allowed', () => {
        expect(getDomainRuleState('@@||ads.com^', 'ads.com')).toBe('allowed');
    });

    it('does not mistake a subdomain rule for the domain itself', () => {
        // ||sub.ads.com^ blocks the subdomain; the card must not claim ads.com
        // is blocked and offer an Unblock that would not help.
        expect(getDomainRuleState('||sub.ads.com^', 'ads.com')).toBe('none');
        expect(getDomainRuleState('||ads.com^', 'sub.ads.com')).toBe('none');
    });

    it('treats a dot as a literal, not as a regex wildcard', () => {
        expect(getDomainRuleState('||adsXcom^', 'ads.com')).toBe('none');
    });

    it('ignores blank lines and surrounding whitespace', () => {
        expect(getDomainRuleState('\n  ||ads.com^$important  \n\n', 'ads.com')).toBe('blocked');
    });

    it('reports nothing for an empty rule list or an empty domain', () => {
        expect(getDomainRuleState('', 'ads.com')).toBe('none');
        expect(getDomainRuleState('||ads.com^', '')).toBe('none');
    });
});

describe('withoutDomainBlock', () => {
    it('removes only the block for that domain', () => {
        const rules = [
            '||keep.com^$important',
            '||ads.com^$important',
            '||ads.com^',
            '||sub.ads.com^',
        ].join('\n');

        expect(withoutDomainBlock(rules, 'ads.com')).toBe(
            ['||keep.com^$important', '||sub.ads.com^'].join('\n'),
        );
    });

    it('leaves an exception in place', () => {
        // Removing the block is the inverse of Block; the user's own
        // allowlist entry is not this action's business.
        const rules = ['@@||ads.com^$important', '||ads.com^$important'].join('\n');
        expect(withoutDomainBlock(rules, 'ads.com')).toBe('@@||ads.com^$important');
    });

    it('is a no-op when nothing blocks the domain', () => {
        expect(withoutDomainBlock('||other.com^', 'ads.com')).toBe('||other.com^');
    });

    it('empties the list when the block was its only entry', () => {
        expect(withoutDomainBlock('||ads.com^$important\n', 'ads.com')).toBe('');
    });
});
