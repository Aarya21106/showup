# ShowUp

A WhatsApp fitness accountability pledge bot. No app, no login, no dashboard — the whole
product lives inside WhatsApp. Users pledge a refundable deposit, get messaged daily at
their chosen time, and check in with a photo + description that Gemini actually looks at
before accepting it.

Stack: Node.js + Express, Twilio WhatsApp Sandbox, Google Gemini (free tier), SQLite
(`better-sqlite3`), `node-cron`, `node-html-to-image` for the poster.

## 1. Test it locally right now (no Twilio/Gemini account needed)

There's a local simulator that runs the bot's exact conversation logic in your terminal —
no webhook, no ngrok, no WhatsApp account required for a first pass.

```bash
npm install
npm run simulate
```

Type answers as the user would. Try:

```
Arya
English
Gym workouts
4
7am
Bad mornings, I just don't get out of bed
I'd finally feel like someone who actually follows through
9
```

That's the full interview: name, language, activity, days/week, time, what's stopped you
before, then two rapport-building questions (what showing up would actually feel like, and
a 1-10 commitment number) that the deposit ask calls back to directly. You'll see the
pledge poster get generated (`generated/plan-*.png` — open it to check it looks right),
followed by the deposit ask, which quotes your blocker and vision back at you and spells
out the pricing with real numbers. Reply `paid` to lock in and reach the active check-in
stage. From there:

- Type a plain text message -> bot asks for a photo (photos are required to check in)
- `/photo path/to/some.jpg feeling good today` -> sends that check-in with a photo attached
- `/reset` -> wipes the test user and restarts onboarding from scratch
- `/exit` -> quit

Without `GEMINI_API_KEY` set, onboarding still works (acknowledgments fall back to a plain
"Got it!"), but photo verification will reply "Couldn't verify that just now" since there's
no key to call. **Add a free Gemini key (see step 3) before testing the check-in/photo
flow for real** — that's the core of the product, worth testing properly.

Run `node -e "require('./src/scheduler').tick()"` any time to manually fire the daily-prompt
cron logic once, instead of waiting for real clock time to match a user's check-in time.

## 2. Run the real server

```bash
cp .env.example .env    # then fill in the values below
npm install
npm start                # or: npm run dev (nodemon, auto-restart)
```

The server logs a warning at boot for anything unconfigured, and degrades gracefully:
- No Twilio credentials -> "mock mode", outgoing messages print to the console instead of
  actually sending. Good for testing conversation logic without a Twilio account yet.
- No Gemini key -> AI-dependent replies fail gracefully with a retry-shortly message.

## 3. Getting each credential

**Gemini API key** (~1 minute, free) — go to https://aistudio.google.com/apikey, create a
key, paste it into `GEMINI_API_KEY`.

Free-tier rate limits (check https://ai.google.dev/gemini-api/docs/rate-limits for current
numbers — these change, so treat this as a ballpark, not a guarantee):
- `gemini-2.0-flash`: ~15 requests/minute, ~1,500 requests/day on the free tier.
- Each onboarding reply and each check-in makes exactly one Gemini call (kept single-turn
  on purpose), so this comfortably supports dozens of active users/day before you'd need
  to move to a paid tier. Watch daily active users × ~2 calls/day (one ack during
  onboarding, one verification per daily check-in) against the RPD ceiling as you grow.

**Twilio WhatsApp Sandbox** (~5 minutes, free) —
1. Sign up at https://console.twilio.com, grab `Account SID` and `Auth Token` from the
   dashboard -> `.env`.
2. Go to Messaging -> Try it out -> Send a WhatsApp message. It'll show a sandbox number
   (usually `+1 415 523 8886`) and a join code like `join brave-tiger`.
3. Put the join code (just the two words, no "join") into `TWILIO_SANDBOX_CODE`.
4. On that same Twilio page, set the "WHEN A MESSAGE COMES IN" webhook to:
   `https://<your-ngrok-subdomain>.ngrok-free.app/webhook/whatsapp` (see ngrok step below),
   method `POST`.
5. To actually test on WhatsApp: message the sandbox number with `join <your-code>` from
   your own phone once (one-time Twilio sandbox friction, expected) - after that you're in,
   and your very next message to that number kicks off onboarding for real.

**Exposing your local server with ngrok** (needed for Twilio to reach you):
```bash
ngrok http 3000
```
Copy the `https://...ngrok-free.app` URL into both `PUBLIC_BASE_URL` in `.env` and the
Twilio sandbox webhook field above. Restart the server after changing `.env`.

**Razorpay Payment Link** — create one at
https://dashboard.razorpay.com/app/payment-links for the deposit amount, paste the URL
into `PAYMENT_LINK_URL`. Users pay it manually and reply "paid" (honor-system for MVP, no
webhook wired up — see "What's simplified for MVP" below).

**Admin view** — set `ADMIN_USER` / `ADMIN_PASSWORD`, then visit `/admin` (basic-auth
protected) for the refund worklist: name, activity, streak, deposit status, payout owed.
Refunds are still sent manually via UPI — this page just tells you who owes what.

## How the pledge math & pricing work

- **Refundable Deposit**: ₹300 (`DEPOSIT_AMOUNT_INR`).
- **Free Trial**: First 14 days FREE access after paying the ₹300 refundable deposit.
- **Platform Fee**: ₹25 administrative fee (`PLATFORM_FEE_INR`), leaving a base refund balance of **₹275** (`FULL_PAYOUT_INR`).
- **Grace / Free Strikes Rule**: If the user's committed schedule has **>10 workout days in the 30-day period**, they get **2 FREE STRIKES** (miss 2 days with ₹0 penalty).
- **Slip Penalty**: Beyond free strikes, each missed day deducts **₹50** (`SLIP_PENALTY_INR`) from their deposit balance (floored at ₹0).
- **Monthly Subscription (Month 2 onward)**:
  - Standard Plan: Base ₹119/month → Earn ₹10 off per clean week (up to ₹40 off = **₹79/month**).
  - Pro Plan: Base ₹239/month → Earn ₹10 off per clean week (up to ₹40 off = **₹199/month**).

## Project layout

```
src/
  index.js              Express app entry point
  config.js             env var loading + defaults
  scheduler.js           node-cron: daily prompts, missed-day sweep, weekly summary, final tally
  db/                    SQLite schema + query helpers (better-sqlite3)
  services/
    gemini.js             all Gemini calls (acknowledgment, check-in verification, follow-up)
    twilio.js              WhatsApp send/receive, with console-log mock mode
    poster.js              renders the pledge/final poster PNGs
  conversation/
    states.js              state machine states
    messages.js             all bot copy, localized (en/ta/hi)
    onboarding.js            the interview -> plan -> deposit ask flow
    checkin.js               daily check-in verification + follow-up + payout/completion
    router.js                dispatches an incoming message based on user state
  templates/poster.html    shared HTML template for both poster types
  routes/
    webhook.js              POST /webhook/whatsapp - Twilio inbound
    admin.js                GET /admin - password-gated refund worklist
    landing.js               GET / - QR/wa.me landing page
scripts/simulate.js        local terminal simulator (no Twilio/webhook needed)
```

## What's simplified for MVP (intentionally, per spec)

- Payment confirmation is honor-system: user pays via the Razorpay link, then just replies
  "paid". No webhook/signature verification. Fine for a small trusted pilot; add a Razorpay
  webhook + signature check before scaling trust in the deposit numbers.
- Single timezone for all users (`TIMEZONE`, default `Asia/Kolkata`) — no per-user timezone.
- Twilio Sandbox, not an approved WhatsApp Business number — every new user has to send a
  one-time `join <code>` message first. That's a real Twilio constraint, not a shortcut we
  took; moving off it later means applying for WhatsApp Business API access.
- The webhook handles one request fully (including the Gemini call) before responding.
  Fine at pilot scale; if you get real concurrent load, move Gemini calls to a queue so
  Twilio's webhook always gets an instant ack.

## Memory layer

The bot remembers users across sessions using a lightweight memory system — no vector DB or
embeddings. A user's entire memory fits comfortably in a single prompt context window.

**How it works:**

- `profile_json` column on `users` — structured durable facts (goals, injuries, diet
  restrictions, past blockers, milestones, and tone/length preferences). Updated after every
  substantive user message via a fire-and-forget Gemini call.
- `daily_summaries` table — each night at 23:30, a cron job summarizes the day's conversation
  into 1-2 lines and optionally schedules a follow-up date (e.g. "check on knee in 3 days").
- **Follow-up nudges** — once per day at the first tick, the scheduler checks for due
  follow-ups and generates a natural, conversational callback ("hey, how's the knee doing?").
- **Weekly personalization** — every Sunday at 22:00, a cron job reviews the week's
  conversations and check-in results to update the user's `preferences` block (message
  length, tone that lands).

**Added Gemini calls per active user per day:** ~3-5 (profile extraction after durable
messages, nightly summary, occasional follow-up nudge generation). At 10 DAU this stays
well within the free-tier 1,500 RPD ceiling. At 50+ DAU, move to a paid Gemini tier.

## Deploying tomorrow

Render/Railway both work well for this: it's a single long-running Node process (needed
for `node-cron` + SQLite-on-disk) rather than a serverless function. Set the same env vars
from `.env` in the platform's dashboard, set `PUBLIC_BASE_URL` to the deployed URL, and
point the Twilio sandbox webhook at `<deployed-url>/webhook/whatsapp`. Note SQLite lives on
local disk — Render's disks are ephemeral on redeploy unless you attach a persistent disk,
so add one (or move to Postgres) before you have real users' pledge data on there.

