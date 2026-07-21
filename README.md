# theile

Personal site and creations for [Theile Riordan](https://github.com/the-theile).

| Path | What |
| --- | --- |
| `/` | Portfolio home (from `content/portfolio.html`) |
| `/dictabird` | **Dictabird** — AI meeting notepad (Granola-style) |
| `/gates` | Private Amazon Flex gate codes app (static, Supabase auth) |

## Local development

```bash
cp .env.local.example .env.local
# Set XAI_API_KEY for Dictabird AI features (https://console.x.ai)

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (portfolio) and [http://localhost:3000/dictabird](http://localhost:3000/dictabird).

## Dictabird

AI notepad: live scratchpad, browser mic transcription (no meeting bots), enhance notes / chat / actions via free providers (Groq/Gemini) or paid xAI.

- **Auth**: same Supabase email/password login as Gates (no public sign-up).
- **Data**: notes/transcripts stay in `localStorage` on the device; only enhance/chat text is sent to the AI API.
- **AI env**: `GROQ_API_KEY` / `GEMINI_API_KEY` / `XAI_API_KEY` (see `.env.local.example`).

### Offline Voice Memo path (private, desktop GPU/CPU)

1. Record on iPhone with **Voice Memos** only (typed notes in Dictabird optional).
2. Transfer `.m4a` to this PC.
3. Run **`tools/dictabird-processor`** (see its README) → `*.dictabird.json`.
4. In Dictabird: **More → Import processed transcript** → **Enhance**.

Audio stays on your machines; processing does not use Vercel or cloud STT.

## Gates

See previous docs: password-protected reference app at `/gates`, backed by Supabase.

## Deploy (Vercel)

This repo is a **Next.js** app (so Dictabird API routes work on your custom domain).

1. Import the `theile` GitHub repo in Vercel (or reconnect the existing project).
2. Framework: **Next.js** (auto-detected).
3. Add env var `XAI_API_KEY` for production Dictabird AI features.
4. Keep your custom domain pointed at this project.

`/gates` is served from `public/gates/index.html`.
