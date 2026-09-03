# Bundled typefaces

Fira Sans and Fira Mono, subsetted `woff2` files taken from the
`@fontsource/fira-sans` and `@fontsource/fira-mono` packages (kept as
devDependencies so the subsets can be refreshed with `npm update` and a copy).

This is the typeface the NexGuard portal uses, adopted so the two products in
the family read as one.

Licensed under the SIL Open Font License 1.1, whose text is in
`LICENSE-Fira.txt`. The OFL requires that licence to travel with the font
files, which is why it is here rather than only in `node_modules`.

They are served from this repository rather than a font CDN on purpose: a DNS
privacy tool whose control panel fetched its typeface from a third party would
disclose every administrator's address to that party on each page load.

See `../fonts.css` for the `@font-face` rules, including the two limits worth
knowing: Fira ships static weights rather than a variable axis, and Fira Mono
has no Vietnamese subset.
