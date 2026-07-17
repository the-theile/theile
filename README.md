# theile
About Theile and his creations

## Gates

`/gates` is a private, password-protected reference app for Amazon Flex gate/access codes, served as a static page alongside the main site (e.g. `<site>/gates`). It's a single self-contained HTML file — no build step, no framework — using the Supabase JS client (loaded from a CDN) directly against the `theile` Supabase project for auth and data.

- **Auth**: Supabase Auth (email + password). There is no public sign-up. To create your login, go to the Supabase dashboard → Authentication → Users → **Add user**, and set an email + password. Use those to sign in at `/gates`.
- **Data**: a single `gates` table (`city`, `community`, `codes`, `notes`, `verified`), protected by row-level security so only authenticated users can read or write it. Codes are kept exactly as entered (including `*`/`#` characters, which can be meaningful on real gate keypads).
- **Editing**: once signed in, you can add, edit, and delete entries directly in the app — no separate admin tool needed.
- A handful of imported entries are flagged with a "verify" badge — these came from ambiguous or uncertain lines in the original source list and are worth double-checking (or fixing) next time you're at that gate.
