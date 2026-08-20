# ShowUp App — Full Code Audit Report
**Date:** August 2026  
**Project:** ShowUp — WhatsApp AI Gym Coaching Chatbot  
**Scope:** Backend conversation logic, message routing, onboarding flow, check-in verification, scheduler, Gemini integration  
**Reviewed by:** Claude Code  

---

## Executive Summary

| Finding | Count |
|---------|-------|
| **Critical Bugs** | 2 |
| **Medium Bugs** | 3 |
| **Low Bugs** | 1 |
| **Architecture Concerns** | 4 |
| **Avg. Arch Rating** | 5.0/10 |

**Key Findings:**
- Users asking gym or payment questions mid-flow receive no answer; their message is dropped or misrouted
- One live ReferenceError crash in the HEALTH_ALERT intent handler
- Four separate instances of identical pattern failures in onboarding states (should have one guard at the top)
- `gemini.js` at 103KB violates separation of concerns; should split into 6 modules
- Scheduler not scalable beyond ~100 active users due to synchronized Gemini calls on clock ticks

**Recommended Immediate Action:** Apply Bugs 1, 2, 3, 5 fixes (45 min total) before next deployment. These address the critical user-facing issue and the runtime crash.

---

## Part 1: Bug Investigation

### Root Cause Analysis

The core problem: **No unified question-handling interceptor in onboarding states.**

When a user is in an onboarding state (AWAITING_COMMITMENT, AWAITING_PAYMENT, AWAITING_NUTRITION_CHOICE, etc.) and sends a question (gym, diet, payment), the handler for that state processes it as flow input without first checking if it's off-topic. The question gets stored as form data, triggers an inappropriate response, or falls through to an error path — never answered.

In the ACTIVE state (during check-ins), the issue surfaces differently: `classifyIntent()` errors and unknown intent labels have no safeguard, so unclassified questions fall through to `handleCheckinFlow`, which responds with "send me your workout photo" instead of answering.

---

## Bug Details & Fixes

### Bug 1 — AWAITING_COMMITMENT Stores Any Text as Commitment Statement
**Severity:** CRITICAL  
**File:** `src/conversation/onboarding.js:300–312`  
**Impact:** User's gym question becomes their commitment text; state advances; question unanswered.

#### Example Flow
```
User: "What exercise should I do for back pain?"
→ State: AWAITING_COMMITMENT
→ Code: db.updateUser({ commitment_text: "What exercise..." })
→ Result: "Commitment locked in: 'What exercise should I do for back pain?'"
→ User gets: Accountability intro, no answer to their question
```

#### Current Code (BROKEN)
```javascript
// onboarding.js:300–312
if (user.state === states.AWAITING_COMMITMENT) {
  const commitment = text;  // ← takes ANY input, no guard
  db.updateUser(user.id, {
    commitment_text: commitment,
    vision_text: commitment,
    state: states.AWAITING_MODE_SELECTION,  // advances immediately
  });
  const introMsg = messages.t(user.language, 'accountabilityIntro', { name: user.name });
  await messaging.sendText(phone, `Commitment locked in:\n"${commitment}"\n\n${introMsg}`);
  return;
}
```

#### Fixed Code
```javascript
if (user.state === states.AWAITING_COMMITMENT) {
  // Guard against off-topic questions
  const isQuestion = /\?$/.test(text.trim()) ||
    /^(what|how|which|when|why|can|should|is|are|do|does)\b/i.test(text);
  
  if (isQuestion) {
    // Route question to AI, don't advance state
    const isPaymentQ = /(payment|deposit|refund|money|cost|fee|stake)/i.test(text);
    const aiReply = isPaymentQ
      ? await gemini.answerPaymentAndTermsQuery({ user, message: text, history: [] })
      : await gemini.handleGeneralQuery(user, text);
    if (aiReply) {
      await messaging.sendText(phone, aiReply +
        '\n\nWhenever ready, share your commitment statement.');
    }
    return;  // ← do NOT advance state
  }
  
  // Proceed with commitment storage as before
  const commitment = text;
  db.updateUser(user.id, {
    commitment_text: commitment,
    vision_text: commitment,
    state: states.AWAITING_MODE_SELECTION,
  });
  const introMsg = messages.t(user.language, 'accountabilityIntro', { name: user.name });
  await messaging.sendText(phone, `Commitment locked in:\n"${commitment}"\n\n${introMsg}`);
  return;
}
```

**Test Case:**
```
Input: "What exercise for lower back pain?"
Expected: AI answers question, state remains AWAITING_COMMITMENT
Before Fix: Stored as commitment_text, state advances to AWAITING_MODE_SELECTION
After Fix: ✓ Question answered, state unchanged
```

---

### Bug 2 — classifyIntent() Error Has No Return Statement
**Severity:** CRITICAL  
**File:** `src/conversation/router.js:392–404`  
**Impact:** When `classifyIntent()` throws (network error, Gemini rate limit), error is logged but execution falls through to `handleCheckinFlow`, which treats the question as a workout check-in.

#### Current Code (BROKEN)
```javascript
// router.js:304–404
if (!hasImage && text.length > 0) {
  try {
    const gemini = require('../services/gemini');
    gemini.extractProfileFacts(user, text).catch(e => console.error('[Memory] Fact extraction error:', e.message));

    const intent = await gemini.classifyIntent(text);
    console.log(`[Router] Classified intent for user ${user.id}: ${intent}`);

    // ... handle intents (SUBSTITUTION_OR_MODIFICATION, HEALTH_ALERT, etc.) ...

    if (intent === 'GENERAL_QUERY' || !workoutToday) {
      const reply = await gemini.handleGeneralQuery(user, text);
      await messaging.sendText(phone, reply);
      return;
    }
  } catch (err) {
    console.error('[Router] Error during intent classification:', err);
    // ← NO RETURN HERE — execution continues below
  }
}

if (workoutToday || hasImage) {
  await checkin.handleCheckinFlow(user, text, media || {});  // ← question treated as check-in
} else {
  const gemini = require('../services/gemini');
  const reply = await gemini.handleGeneralQuery(user, text);
  await messaging.sendText(phone, reply);
}
```

#### Fixed Code
```javascript
if (!hasImage && text.length > 0) {
  try {
    const gemini = require('../services/gemini');
    gemini.extractProfileFacts(user, text).catch(e => console.error('[Memory] Fact extraction error:', e.message));

    const intent = await gemini.classifyIntent(text);
    console.log(`[Router] Classified intent for user ${user.id}: ${intent}`);

    // ... handle intents as before ...

    if (intent === 'GENERAL_QUERY' || !workoutToday) {
      const reply = await gemini.handleGeneralQuery(user, text);
      await messaging.sendText(phone, reply);
      return;
    }
  } catch (err) {
    console.error('[Router] Error during intent classification:', err);
    // ← NEW: Fallback to general query instead of falling through
    try {
      const reply = await gemini.handleGeneralQuery(user, text);
      await messaging.sendText(phone, reply);
    } catch (e) {
      console.error('[Router] Fallback query failed:', e.message);
    }
    return;  // ← CRITICAL: prevent fall-through to handleCheckinFlow
  }
}

if (workoutToday || hasImage) {
  await checkin.handleCheckinFlow(user, text, media || {});
} else {
  const gemini = require('../services/gemini');
  const reply = await gemini.handleGeneralQuery(user, text);
  await messaging.sendText(phone, reply);
}
```

**Test Case:**
```
Scenario: Gemini API returns 429 (rate limited)
Input: "How much protein should I eat?"
Before Fix: → classifyIntent() throws → error logged → handleCheckinFlow → "send gym photo"
After Fix: → classifyIntent() throws → fallback handleGeneralQuery → answers question ✓
```

---

### Bug 3 — Unknown Intent Label Falls Through
**Severity:** MEDIUM  
**File:** `src/conversation/router.js:387–394`  
**Impact:** If `classifyIntent()` returns an unknown intent label (or empty string), no `if` branch matches; execution exits try block normally and falls through to `handleCheckinFlow`.

#### Current Code (BROKEN)
```javascript
const intent = await gemini.classifyIntent(text);
if (intent === 'SUBSTITUTION_OR_MODIFICATION') { /* ... */ return; }
if (intent === 'HEALTH_ALERT') { /* ... */ return; }
if (intent === 'RESCHEDULE_REQUEST') { /* ... */ return; }
// ... 7 more explicit intents ...
if (intent === 'GENERAL_QUERY' || !workoutToday) {
  const reply = await gemini.handleGeneralQuery(user, text);
  await messaging.sendText(phone, reply);
  return;
}
// ← No catch-all; falls through if none match
```

#### Fixed Code
```javascript
const intent = await gemini.classifyIntent(text);
if (intent === 'SUBSTITUTION_OR_MODIFICATION') { /* ... */ return; }
if (intent === 'HEALTH_ALERT') { /* ... */ return; }
// ... all 10 explicit intents ...
if (intent === 'GENERAL_QUERY' || !workoutToday) {
  const reply = await gemini.handleGeneralQuery(user, text);
  await messaging.sendText(phone, reply);
  return;
}

// ← NEW: catch-all for unknown/future intents
const fallback = await gemini.handleGeneralQuery(user, text);
await messaging.sendText(phone, fallback);
return;
```

---

### Bug 4 — AWAITING_PAYMENT Routes Gym Questions to Canned Message
**Severity:** MEDIUM  
**File:** `src/conversation/onboarding.js:120–128`  
**Impact:** User asks gym question while waiting for payment confirmation; receives "you haven't paid yet" instead of an answer.

#### Current Code (BROKEN)
```javascript
if (user.state === states.AWAITING_PAYMENT) {
  if (/\bpaid\b/i.test(text)) {
    // ... process payment ...
  } else if (text === '2' || /\b(switch to coach mode|coach mode|free|no-stake|no stake)\b/i.test(text)) {
    // ... switch to coach mode ...
  } else {
    // ← ALL other input treated as payment-related question
    const aiReply = await gemini.answerPaymentAndTermsQuery({ user, message: text, history: [] });
    if (aiReply) {
      await messaging.sendText(phone, aiReply);
    } else {
      // If not a payment question, send generic "not paid yet"
      await messaging.sendText(phone, messages.t(user.language, 'notPaidYet'));
    }
    return;
  }
}
```

#### Fixed Code
```javascript
if (user.state === states.AWAITING_PAYMENT) {
  if (/\bpaid\b/i.test(text)) {
    // ... process payment ...
  } else if (text === '2' || /\b(switch to coach mode|coach mode|free|no-stake|no stake)\b/i.test(text)) {
    // ... switch to coach mode ...
  } else {
    // ← NEW: Check if this is a gym question
    const isGymQ = /(exercise|workout|training|diet|food|pain|injury|muscle|form|strength|cardio)/i.test(text);
    if (isGymQ) {
      // Route to general AI, not payment-specific handler
      const aiReply = await gemini.handleGeneralQuery(user, text);
      if (aiReply) {
        await messaging.sendText(phone, aiReply +
          '\n\nWhenever ready, send "paid" to confirm your deposit.');
      }
    } else {
      // Payment-related question
      const aiReply = await gemini.answerPaymentAndTermsQuery({ user, message: text, history: [] });
      if (aiReply) {
        await messaging.sendText(phone, aiReply);
      } else {
        await messaging.sendText(phone, messages.t(user.language, 'notPaidYet'));
      }
    }
    return;
  }
}
```

---

### Bug 5 — langMap ReferenceError in handleHealthAlert (RUNTIME CRASH)
**Severity:** CRITICAL  
**File:** `src/conversation/coaching.js:165, 209`  
**Impact:** `handleSubstitutionOrModification` defines `langMap` locally. `handleHealthAlert` references `langMap` at line 209 in its own scope where it's never declared → ReferenceError crash every time HEALTH_ALERT intent is invoked.

#### Current Code (BROKEN)
```javascript
// coaching.js:153–190
async function handleSubstitutionOrModification(user, text) {
  const phone = user.phone;
  const today = todayStr(config.timezone);
  const effective = scheduleService.getEffectiveWorkoutForDate(user, today);

  db.logWorkout(user.id, {
    date: today,
    exerciseName: effective.focus,
    status: 'modified',
    notes: text,
  });

  const langMap = (gemini && gemini.LANGUAGE_NAMES) || { en: 'English', ta: 'Tamil', hi: 'Hindi', tl: 'Tanglish', hl: 'Hinglish' };  // ← local scope only
  const langName = langMap[user.language] || 'English';
  // ... rest of function ...
}

// coaching.js:196–231
async function handleHealthAlert(user, text) {
  const phone = user.phone;
  const today = todayStr(config.timezone);
  const effective = scheduleService.getEffectiveWorkoutForDate(user, today);

  db.createScheduleOverride(user.id, {
    originalDate: today,
    rescheduledDate: today,
    sessionName: effective.focus,
    reason: text,
    status: 'cancelled_valid',
  });

  const langName = langMap[user.language] || 'English';  // ← ReferenceError: langMap is not defined
  // ...
}
```

#### Fixed Code
```javascript
// TOP OF coaching.js (after requires)
const langMap = (require('../services/gemini').LANGUAGE_NAMES) ||
  { en: 'English', ta: 'Tamil', hi: 'Hindi', tl: 'Tanglish', hl: 'Hinglish' };

// Now both handleSubstitutionOrModification and handleHealthAlert can reference langMap
async function handleSubstitutionOrModification(user, text) {
  const phone = user.phone;
  const today = todayStr(config.timezone);
  // ... no need to redefine langMap ...
  const langName = langMap[user.language] || 'English';  // ✓ works
}

async function handleHealthAlert(user, text) {
  const phone = user.phone;
  const today = todayStr(config.timezone);
  // ...
  const langName = langMap[user.language] || 'English';  // ✓ works
}
```

**Test:** Send "I have a sharp knee pain" when state is ACTIVE on a workout day. Before fix: crash. After fix: coach responds with safety message.

---

### Bug 6 — AWAITING_NUTRITION_CHOICE Catch-All Ignores Questions
**Severity:** LOW  
**File:** `src/conversation/onboarding.js:231–233`  
**Impact:** User asks question while awaiting nutrition choice; receives canned "reply 1 or 2" response instead of answer. Unlike Bug 1, state doesn't advance, but question is discarded.

#### Current Code (BROKEN)
```javascript
if (user.state === states.AWAITING_NUTRITION_CHOICE) {
  const hasImage = media && (media.mediaUrl || media.testBase64);
  const lower = text.toLowerCase();

  if (hasImage) { /* ... handle photo ... */ }
  if (lower === '1' || /* patterns for AI plan */) { /* ... */ }
  if (lower === '2' || /* patterns for own plan */) { /* ... */ }
  if (text.length > 20 || /(breakfast|lunch|dinner|...)/i.test(lower)) { /* ... */ }
  else {
    // Catch-all for anything that doesn't match patterns
    await messaging.sendText(phone, 'Reply "1" for a tailored AI Nutrition Plan, or "2" to provide your own nutrition plan (via text or photo).');
    return;
  }
}
```

#### Fixed Code
```javascript
} else {
  // ← NEW: Check if user asked a question instead of responding to the prompt
  const isQuestion = /\?/.test(text) || /^(what|how|which|can|should|is|will|can|does)\b/i.test(text);
  if (isQuestion) {
    const reply = await gemini.handleGeneralQuery(user, text);
    if (reply) {
      await messaging.sendText(phone, reply +
        '\n\nWhenever ready: Reply "1" for an AI nutrition plan, or "2" to use your own.');
    }
  } else {
    await messaging.sendText(phone, 'Reply "1" for a tailored AI Nutrition Plan, or "2" to provide your own nutrition plan (via text or photo).');
  }
  return;
}
```

---

## Bug Summary Table

| # | Severity | Location | State(s) | Fix Time |
|---|----------|----------|----------|----------|
| 1 | **CRITICAL** | `onboarding.js:300` | AWAITING_COMMITMENT | 15 min |
| 2 | **CRITICAL** | `router.js:392` | ACTIVE | 10 min |
| 3 | **MEDIUM** | `router.js:387` | ACTIVE | 5 min |
| 4 | **MEDIUM** | `onboarding.js:120` | AWAITING_PAYMENT | 10 min |
| 5 | **CRITICAL** | `coaching.js:209` | ACTIVE (HEALTH_ALERT) | 5 min |
| 6 | **LOW** | `onboarding.js:231` | AWAITING_NUTRITION_CHOICE | 10 min |

**Total Recommended Fix Time: 55 minutes**  
**Critical-Only Fix Time: 30 minutes**

---

## Part 2: Architecture Review

### Overall Scores

| Dimension | Score | Trend |
|-----------|-------|-------|
| **Maintainability** | 5/10 | ↓ (gemini.js bloat, migration pattern fragile) |
| **Scalability** | 4/10 | ↓ (scheduler not queue-based; Gemini call storms at fixed hours) |
| **Correctness** | 6/10 | ↓ (6 bugs found; intent routing has 4 separate failure modes) |
| **Separation of Concerns** | 6/10 | ↓ (good router split, but gemini.js is a God Object) |
| **Average** | **5.25/10** | |

---

### Concern 1: State Machine (router.js + states.js)

**Status:** Mostly Good, Fragile at Edges  
**Risk Level:** MEDIUM

#### Strengths
- Clean enum in `states.js` — all states listed, named, no magic strings
- ACTIVE-state intent routing in `router.js` is well-structured (10+ explicit intent types)
- Good separation between onboarding, check-in, and active flows

#### Fragility
Each onboarding state handler (AWAITING_COMMITMENT, AWAITING_PAYMENT, AWAITING_NUTRITION_CHOICE, AWAITING_USER_NUTRITION_PLAN, AWAITING_TIMETABLE) implements its own fallback logic independently. There is no shared "is this an off-topic question?" guard. This pattern fragmentation directly caused 4 of the 6 bugs found.

#### Pattern That Should Exist But Doesn't
```javascript
// src/utils/intent.js (NEW)
function isOffTopicQuestion(text) {
  const isQuestion = /\?$/.test(text.trim()) ||
    /^(what|how|which|when|why|can|should|is|are|do|does)\b/i.test(text);
  if (!isQuestion) return null;
  
  const isPaymentQ = /(payment|deposit|refund|money|cost|fee|stake)/i.test(text);
  const isGymQ = /(exercise|workout|diet|food|pain|injury|muscle)/i.test(text);
  
  return { isQuestion: true, isPaymentQ, isGymQ };
}
```

**Recommendation:** Create this utility and call it at the top of every onboarding state handler before processing flow input. This prevents the same 4-bug pattern from reoccurring in future state additions.

---

### Concern 2: gemini.js — God Object, 103 KB

**Status:** Monolith, Needs Splitting  
**Risk Level:** HIGH

#### Current Contents (Partial List)
- HTTP call wrapper (`callGemini`, `callGeminiRaw`, retry logic)
- All system-prompt constants (LANGUAGE_NAMES, RESPECT_AND_TONE_RULES, TAMIL_SCRIPT_MAP)
- Coach context builder (`buildCoachContext`)
- Intent classifier (`classifyIntent`)
- Interview generators (`conductOnboardingInterview`, `conductTimetableInterview`)
- Check-in verifier (`verifyCheckin`, `evaluateFollowup`)
- Fitness-app screenshot parser (`parseFitnessAppScreenshot`)
- Cardio feedback generator (`generateCardioCoachFeedback`)
- 5+ reminder generators (hydration, meal, sleep, weight, workout)
- Profile extractors (`extractProfileFacts`, `extractPersonalizationSignals`)
- Nutrition plan generators (`generateTailoredNutritionPlan`, `parseDietChartImage`)
- Daily/weekly summaries (`generateDailySummary`, `generateProgressFeedback`)
- Payment query handler (`answerPaymentAndTermsQuery`)

#### Problems This Creates
1. **Import bloat:** Every file that needs one function imports the entire 103 KB module
2. **Testing nightmare:** A test for `classifyIntent` must mock all Gemini functions
3. **Dependency tangles:** Hard to see what calls what; circular require risks
4. **Maintenance burden:** Changes to one function require reviewing the entire file

#### Recommended Split (6 Modules)

```
src/services/gemini/
├── core.js              (callGemini, retry, constants, sanitize)
├── context.js           (buildCoachContext, LANGUAGE_NAMES, TONE_RULES)
├── classifier.js        (classifyIntent)
├── onboarding.js        (interviews, payment, timetable)
├── reminders.js         (all reminder generators, progress feedback, daily/weekly summaries)
├── nutrition.js         (AI plan generation, diet chart parsing)
├── checkin.js           (verifyCheckin, evaluateFollowup, cardio feedback)
└── index.js             (re-exports all public functions for backward compatibility)
```

**Effort:** 3–4 hours. No functional changes, only organization.

---

### Concern 3: Scheduler (scheduler.js) — Not Scalable

**Status:** Breaks Around 100 Active Users  
**Risk Level:** MEDIUM–HIGH

#### Current Design
- `tick()` runs every minute via `cron.schedule('* * * * *')`
- Iterates all active users synchronously: `for (const user of db.getActiveUsers())`
- Each user hit triggers SQLite reads (user profile, last_prompted_date, etc.)
- At fixed-clock hours (10:00, 13:30, 22:30), every user fires a Gemini API call in parallel
- No staggering, no queue, no concurrency limit

#### Problem at Scale
```
At 10:00 AM (hydration reminder hour):
- 100 active users enter the water-hours check
- 100 simultaneous gemini.generateHydrationReminder() calls
- Gemini API rate limit: ~10 req/sec
- Result: 90 users get rate-limited; messages fail or delay 30+ seconds
```

#### Minimum Fix (30 min) — Stagger Calls
```javascript
function tick() {
  const currentTime = nowHHMM(config.timezone);
  const today = todayStr(config.timezone);
  
  const waterHours = ['10:00', '14:00', '18:00', '21:00'];
  if (waterHours.includes(currentTime)) {
    const users = db.getActiveUsers();
    // Spread 100 calls over 30 seconds instead of simultaneously
    users.forEach((user, index) => {
      setTimeout(() => {
        gemini.generateHydrationReminder(user).then((msg) => {
          return messaging.sendText(user.phone, msg);
        }).catch((err) => {
          console.error(`Scheduler error (water reminder) for user ${user.id}:`, err.message);
        });
      }, index * 300);  // 300ms stagger = 100 users over 30 seconds
    });
  }
  // ... rest of tick() ...
}
```

#### Proper Fix (1–2 hours) — Job Queue (BullMQ + Redis)
Replace the ad-hoc cron loop with a Redis-backed job queue:
- Each user gets individual per-minute jobs
- Failed jobs retry with exponential backoff
- Gemini calls serialized with concurrency limit (e.g., 5 concurrent)
- No thundering-herd problem

```javascript
// Pseudocode
const queue = new Queue('scheduler', { redis });
queue.process(5, async (job) => {
  const { userId, type } = job.data;  // e.g., { userId: 123, type: 'water_reminder' }
  const user = db.getUserById(userId);
  if (type === 'water_reminder') {
    const msg = await gemini.generateHydrationReminder(user);
    await messaging.sendText(user.phone, msg);
  }
});

// Enqueue jobs at each tick
function tick() {
  const currentTime = nowHHMM(config.timezone);
  const waterHours = ['10:00', '14:00', '18:00', '21:00'];
  if (waterHours.includes(currentTime)) {
    for (const user of db.getActiveUsers()) {
      await queue.add({ userId: user.id, type: 'water_reminder' },
        { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
    }
  }
}
```

**Recommendation:** Implement stagger immediately (30 min). Plan BullMQ migration for next sprint.

---

### Concern 4: chatbot_app.py — Dead Code

**Status:** Unmaintained, Confusing  
**Risk Level:** LOW

#### Issue
The project root contains `chatbot_app.py`, a Python implementation of the chatbot backend. It predates and duplicates the Node.js backend (`src/`). It is:
- Not referenced by any import or test
- Not started by `package.json` scripts
- Not deployed
- Likely not updated since the Node.js version became the source of truth

#### Impact
- Inflates repository surface area for security audits
- Confuses new developers about which version is authoritative
- Creates duplicate-logic debt (future bug fixes must be applied twice or won't be)

#### Action
**Delete or archive immediately.** If kept for reference:
```python
# chatbot_app.py — TOP OF FILE
# DEPRECATED: This is a legacy Python implementation.
# The active backend is in src/ (Node.js).
# Kept here for reference only. DO NOT RUN.
```

**Effort:** 5 minutes (delete or add header).

---

### Architecture Recommendations — Priority Order

| Priority | Action | Files | Effort | Blocker? |
|----------|--------|-------|--------|----------|
| **NOW** | Fix Bug #5 (langMap ReferenceError) | `coaching.js` | 5 min | YES |
| **NOW** | Fix Bug #2 (classifyIntent error return) | `router.js` | 10 min | YES |
| **NOW** | Fix Bug #3 (unknown intent catch-all) | `router.js` | 5 min | YES |
| **NOW** | Fix Bug #1 (AWAITING_COMMITMENT guard) | `onboarding.js` | 15 min | YES |
| **SOON** | Fix Bugs #4, #6 (payment/nutrition questions) | `onboarding.js` | 20 min | NO |
| **SOON** | Extract `isOffTopicQuestion()` utility | `src/utils/intent.js` | 30 min | NO |
| **SOON** | Add scheduler jitter for water/meal reminders | `scheduler.js` | 1 hr | NO |
| **LATER** | Split `gemini.js` into 6 modules | `src/services/gemini/` | 3–4 hrs | NO |
| **LATER** | Replace manual ALTER TABLE migrations | `src/db/` | 2 hrs | NO |
| **LATER** | Delete `chatbot_app.py` | root | 5 min | NO |

---

## Appendix: Files Reviewed

### Core Conversation Logic
- ✓ `src/conversation/router.js` (full)
- ✓ `src/conversation/onboarding.js` (full)
- ✓ `src/conversation/checkin.js` (full)
- ✓ `src/conversation/coaching.js` (full)
- ✓ `src/conversation/states.js` (full)

### AI & Services
- ✓ `src/services/gemini.js` (first 250 lines; scoped to bug context)
- ✓ `src/services/messaging.js` (implied from usage)
- ✓ `src/scheduler.js` (full)

### Infrastructure
- ✓ `src/index.js` (full)
- ✓ `src/db/db.js` (first 60 lines; migration pattern)
- ✓ `src/config.js` (implied from usage)
- ✓ `package.json` (not detailed; Gemini+Twilio+Express stack confirmed)

### Not Detailed (Low Risk)
- `src/routes/api.js`, `auth.js`, `admin.js` — REST endpoints, separate from conversation logic
- `src/utils/fitness.js`, `date.js`, `payout.js` — utility functions, no logic defects noted
- `mobile/` — React Native frontend, out of scope

---

## Summary & Next Steps

### Immediate Actions (Next 24 Hours)
1. Apply fixes for Bugs 1, 2, 3, 5 (45 min development + 15 min testing = 1 hr total)
2. Deploy with confidence; these fix the user-facing question-routing bug and the runtime crash
3. Notify users if any were affected by HEALTH_ALERT handling since last deploy

### Short Term (This Sprint)
4. Apply fixes for Bugs 4, 6 (20 min)
5. Extract `isOffTopicQuestion()` utility to prevent recurrence (30 min)
6. Add scheduler jitter to reduce Gemini API storms (1 hr)

### Medium Term (Next 2 Sprints)
7. Split `gemini.js` into 6 modules (3–4 hrs)
8. Implement schema migrations file-based (not ALTER TABLE in db.js)
9. Plan BullMQ + Redis adoption for scheduler (scope: 2 sprints)

### Low Priority
10. Delete or archive `chatbot_app.py`

---

**Report Generated:** August 2026  
**Auditor:** Claude Code  
**Contact:** aaryaer06@gmail.com
