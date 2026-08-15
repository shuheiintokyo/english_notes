
# 英語添削ノート - English Review App (Gemini 1.5 Flash)

Mobile-first, offline-capable English review app for Japanese learner.

## Quick deploy

1. Clone / copy this folder
2. npm install
3. Setup NocoDB table + Gemini key (see below)
4. cp .env.example .env.local and fill
5. npm run dev
6. Push to GitHub -> Import in Vercel

## Stack
- Next.js 14 App Router (Vercel free)
- NocoDB cloud free (single table)
- IndexedDB (idb) for offline
- Gemini 1.5 Flash for review (direct, no n8n)

## NocoDB Setup (5 min)
1. Go to https://app.nocodb.com -> New Base
2. Create table `english_notes` with columns:
   - original_text: LongText (required)
   - status: SingleSelect (pending, reviewing, reviewed) default pending
   - corrected_text: LongText
   - explanation_ja: LongText
   - created_at: DateTime
   - reviewed_at: DateTime
3. Get token: Avatar -> API Tokens -> Create
4. Get Table ID: Open table -> URL contains /.../table/<TABLE_ID> or use API /api/v2/meta/bases/{baseId}/tables
5. Put into .env.local

## Gemini 1.5 Flash Setup (2 min)
1. https://aistudio.google.com/app/apikey -> Create API key (free tier: 15 RPM, 1M TPM, very generous)
2. Model: gemini-1.5-flash is fast (1-2s) and cheap, perfect for this app
3. Add to .env.local as GEMINI_API_KEY

Why Flash for this app:
- Latency: ~1s vs 3-5s for Pro, so Vercel function won't timeout
- Quality: good enough for grammar + naturalness + Japanese explanation
- Free tier: 15 requests/min = more than enough for personal use
- JSON mode: responseMimeType application/json is stable

## Offline / Sync design
- Save instantly to IndexedDB (saveLocal) -> status pending, dirty=true
- If online, POST /api/review
- API: create NocoDB row as reviewing immediately, call Gemini, then update to reviewed
- Client updates local note with result, dirty=false
- When offline, notes stay pending. On online event, syncPending() loops.

Vercel timeout handling:
- maxDuration = 30 (hobby limit)
- Flash is fast so usually <2s, but we still mark reviewing first in NocoDB
- If AI fails, client keeps dirty=true to retry later

## Vercel deploy
- Import repo in Vercel
- Add env vars: NOCODB_URL, NOCODB_TOKEN, NOCODB_TABLE_ID, GEMINI_API_KEY, GEMINI_MODEL=gemini-1.5-flash
- Deploy. No build config needed.

## Cost
- Vercel free: 100GB bandwidth, 10s function limit (Flash fits)
- NocoDB free: 1000 rows, enough
- Gemini free: 15 RPM, no card needed to start

## Swap model later
Only change lib/ai.ts -> reviewWithGemini. Change GEMINI_MODEL to gemini-1.5-pro or gpt-4o-mini.
