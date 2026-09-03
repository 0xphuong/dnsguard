# Bundled typefaces

Geist Sans and Geist Mono, subsetted variable `woff2` files taken from the
`@fontsource-variable/geist` and `@fontsource-variable/geist-mono` packages
(kept as devDependencies so the subsets can be refreshed with `npm update` and
a copy).

Both are Copyright 2024 The Geist Project Authors
(https://github.com/vercel/geist-font), licensed under the SIL Open Font
License 1.1,
whose text is in `LICENSE-Geist.txt` and `LICENSE-GeistMono.txt`.  The OFL
requires that licence to travel with the font files, which is why it is here
rather than only in `node_modules`.

They are served from this repository rather than a font CDN on purpose: a DNS
privacy tool whose control panel fetched its typeface from a third party would
disclose every administrator's address to that party on each page load.

See `../fonts.css` for the `@font-face` rules and the measurements behind the
choice.
