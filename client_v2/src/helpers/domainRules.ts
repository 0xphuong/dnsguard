import { splitByNewLine } from './helpers';

/**
 * Reads the user's own filtering rules to answer one question a card or a log
 * row needs before it can offer an action: is this domain blocked *right now*?
 *
 * Nothing in the statistics can answer that.  The top-queried list is a window
 * over the selected period, so a domain blocked a minute ago still appears in
 * it, and a component that decides from the statistics ends up offering to
 * block what is already blocked.
 *
 * This deliberately understands only the shape of rule the interface itself
 * writes, plus the plainer form a person is likely to type by hand — a full
 * answer would mean running the resolver's rule engine in the browser.  A
 * domain blocked by a subscribed blocklist therefore reads as `none` here,
 * which is correct for the callers: they can only undo a rule the user owns.
 */

export type DomainRuleState =
    /** No user rule mentions it. */
    | 'none'
    /** A user rule blocks it. */
    | 'blocked'
    /** A user exception allows it, which wins over any block. */
    | 'allowed';

/** The rule the interface writes when someone blocks a domain. */
export const blockRuleFor = (domain: string): string => `||${domain}^$important`;

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Matches `||domain^` with or without modifiers, and its `@@` exception. */
const matchers = (domain: string) => {
    const body = `\\|\\|${escape(domain)}\\^(\\$.*)?$`;

    return {
        block: new RegExp(`^${body}`),
        allow: new RegExp(`^@@${body}`),
    };
};

export const getDomainRuleState = (userRules: string, domain: string): DomainRuleState => {
    if (!domain) {
        return 'none';
    }

    const { block, allow } = matchers(domain);
    let blocked = false;

    for (const line of splitByNewLine(userRules)) {
        const rule = line.trim();

        // An exception beats a block in the resolver, so it beats one here.
        if (allow.test(rule)) {
            return 'allowed';
        }

        if (block.test(rule)) {
            blocked = true;
        }
    }

    return blocked ? 'blocked' : 'none';
};

/** Whether any user rule blocks the domain, exceptions aside. */
export const hasDomainBlock = (userRules: string, domain: string): boolean => {
    if (!domain) {
        return false;
    }

    const { block } = matchers(domain);

    return splitByNewLine(userRules).some((line) => block.test(line.trim()));
};

/**
 * Drops every user rule that blocks the domain, leaving exceptions and every
 * other rule untouched.
 *
 * This is the inverse of what the interface's Block writes.  The store's
 * `unblockDomain` is a different operation: it *adds* an `@@` exception on top
 * of the block, which is the right move for a domain a subscribed blocklist
 * caught, and the wrong one for undoing your own click — it would leave two
 * contradictory rules behind.
 */
export const withoutDomainBlock = (userRules: string, domain: string): string => {
    const { block } = matchers(domain);

    return splitByNewLine(userRules)
        .filter((line) => !block.test(line.trim()))
        .join('\n');
};
