# ShowUp v2 — Claude Code Build Prompt (Gemini API, all fitness activities)

Copy-paste this whole thing into Claude Code as one prompt.

---

Build a WhatsApp bot called "ShowUp" — a fitness accountability pledge bot covering ANY physical activity (gym, home workout, running, yoga, sport, walking, swimming, cycling — anything counts, not just gym). No web app, no login, no dashboard. Backend only: Node.js (Express) + Twilio WhatsApp Sandbox API + Google Gemini API (free tier) + SQLite (better-sqlite3, or a JSON file store if faster to scaffold). A tiny static landing page is fine ONLY for the QR redirect, nothing more.

## AI provider — use Gemini, not Claude, for all AI calls in this build

- Use the Gemini API free tier via `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent` (or `gemini-1.5-flash` if 2.0 isn't available) with an API key from Google AI Studio, passed as env var `GEMINI_API_KEY`
- Gemini supports multimodal input — use this for the check-in photo verification (send the image inline as base64 alongside the text prompt) so the bot can actually look at the photo, not just read the caption
- Keep prompt calls lean and single-turn where possible to stay comfortably within free-tier rate limits (note the current free-tier RPM/RPD limits in the README so I know the ceiling)

## Core flow — order matters, this is the whole psychology of the product

### 1. The Interview (no money talk yet — this stage builds the buy-in)

When a user joins (via `wa.me` link from a QR poster), the bot conducts a warm, one-question-at-a-time conversation, waiting for each reply:

1. "What's your name?"
2. "What language do you want to chat in?" (support English, Tamil, Hindi at minimum)
3. "What's your fitness thing — gym, home workout, running, yoga, sport, walking, anything counts. What's yours?"
4. "How many days a week can you realistically commit — be honest, not ambitious?"
5. "What time of day do you actually do it, or want to?"
6. **Key emotional question**: "What's stopped you before? Be honest — bad mornings, no motivation, boredom, whatever it is."
7. Use Gemini to keep responses conversational — acknowledge what they said before moving to the next question, not a rigid form

Store all answers against their phone number as the conversation progresses.

### 2. The Personalized Plan (the "made for me" moment)

Generate a plan poster image using their name, activity, committed days, and chosen time:

```
SHOWUP
30-DAY PLEDGE

[Activity] — [Days] days/week, [Time]

[Name]

"[their own words on what stopped them before]" — not this time.
```

Render this via a simple HTML template screenshotted to PNG (`node-html-to-image` or Puppeteer — whichever is faster to set up, no need for an image-gen API). Send it back on WhatsApp.

### 3. The Deposit Ask (only after the plan feels personal)

Send the pledge terms right after the poster:

"To lock this in, ShowUp asks for a refundable pledge deposit of ₹300. Complete every single check-in for 30 days and you get back ₹500 — more than you put in. Miss a day, or fake a check-in, and it's ₹300 minus ₹50 for every slip instead."

Then: "Here's how this works: 1) I'll message you at your time. 2) You reply with what you did + a photo. 3) I actually look at the photo and check it against what you say and your history — no bluffing. Complete every day, get back more than you put in."

Send a Razorpay Payment Link (env var `PAYMENT_LINK_URL`). After payment, user replies "paid" — bot marks them active (honor-system confirmation is fine for MVP, no webhook needed).

### 4. Daily Check-In (the accountability loop)

- A cron job (node-cron) messages each active user at their chosen time: "Time to show up — what are you doing today?"
- User replies with a text description + a photo
- Send both the text and the image (inline base64) to Gemini, asking it to: (a) confirm the photo plausibly matches the activity described, (b) flag vague or suspiciously repetitive descriptions compared to their stored check-in history
- Bot confirms the day is logged, or calls out a vague/inconsistent answer and asks a quick follow-up before accepting it
- Update streak and running deposit-adjustment total in the DB

### 5. Weekly + Final Summary

- Every Sunday: "You're on a X-day streak. Y more days to your ₹500 payout." or if they've slipped: current refund standing
- At day 30: final tally message with payout amount + a "Share your streak" shareable image using the same poster template

### 6. Admin view

- A simple CLI script or bare `/admin` page (password-gated via env var) listing all users: name, activity, streak, deposit status, payout owed — for manually processing refunds via UPI

## Design

No visual design work needed beyond the plan-poster template and the one-page QR landing site — the whole product lives inside WhatsApp. Bot's tone: warm but firm, like a coach who won't let you lie to yourself.

## What NOT to build

- No web dashboard, no accounts beyond phone number
- No official WhatsApp Business API approval flow — use Twilio's Sandbox for immediate testing (one-time join-code step is acceptable friction)
- No image-gen API for the poster — HTML-to-image is enough and much faster

## Deliverable

A single Node.js project runnable locally (with ngrok instructions for exposing Twilio webhooks tonight), deployable to Render/Railway tomorrow. Include a short README with setup steps, where to paste my Twilio credentials, Gemini API key, Razorpay Payment Link, admin password, and a note on Gemini free-tier rate limits so I know the ceiling before scaling users.
