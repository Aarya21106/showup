const axios = require('axios');
const config = require('../config');

const ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

class GeminiError extends Error {}

async function callGemini({ parts, jsonMode, temperature }) {
  if (!config.geminiConfigured) {
    throw new GeminiError('GEMINI_API_KEY is not set');
  }

  const generationConfig = {
    temperature: temperature ?? 0.6,
    maxOutputTokens: 400,
  };
  if (jsonMode) generationConfig.responseMimeType = 'application/json';

  try {
    const res = await axios.post(
      ENDPOINT(config.gemini.model),
      {
        contents: [{ role: 'user', parts }],
        generationConfig,
      },
      {
        params: { key: config.gemini.apiKey },
        headers: { 'Content-Type': 'application/json' },
        timeout: 20000,
      }
    );

    const candidate = res.data?.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '';
    if (!text) {
      throw new GeminiError(`Empty Gemini response (finishReason: ${candidate?.finishReason || 'unknown'})`);
    }
    return text;
  } catch (err) {
    if (err instanceof GeminiError) throw err;
    const detail = err.response?.data?.error?.message || err.message;
    throw new GeminiError(`Gemini call failed: ${detail}`);
  }
}

const LANGUAGE_NAMES = { en: 'English', ta: 'Tamil', hi: 'Hindi' };

/**
 * Produces a short, warm one-line acknowledgment of the user's onboarding answer,
 * in their chosen language. Falls back to a generic line if Gemini is unavailable.
 */
async function acknowledgeAnswer({ question, answer, language, name }) {
  const langName = LANGUAGE_NAMES[language] || 'English';
  const prompt = `You are ShowUp - part hype coach, part no-BS best friend, texting on WhatsApp.
You genuinely believe this person can pull this off, and you're not shy about saying so.
The user${name ? ` (${name})` : ''} was just asked: "${question}"
They answered: "${answer}"

Write ONE short, punchy sentence (max 20 words) reacting to their answer like a friend who's
actually listening and genuinely hyped for them - specific to what they said, not generic filler.
Confident and warm, never cheesy or salesy. Reply ONLY in ${langName}. No greeting, at most one emoji, no next question.`;

  try {
    const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.8 });
    return text.trim();
  } catch (err) {
    return null; // caller falls back to a static acknowledgment
  }
}

/**
 * Multimodal check-in verification: does the photo plausibly match the described activity,
 * and is the description vague/suspiciously repetitive vs their check-in history?
 * Returns { matches, suspicious, reason, followupQuestion } - or throws GeminiError.
 */
async function verifyCheckin({ description, imageBase64, mimeType, activity, language, recentDescriptions }) {
  const langName = LANGUAGE_NAMES[language] || 'English';
  const history = (recentDescriptions || []).slice(-5).map((d, i) => `${i + 1}. "${d}"`).join('\n') || '(no prior check-ins)';

  const prompt = `You are ShowUp, a fitness accountability bot verifying a user's daily check-in on WhatsApp.
Their committed activity is: "${activity}".
Their check-in message today: "${description || '(no text provided)'}"
Their last few check-in descriptions, for comparison:
${history}

You are given one photo attached to this message. Look at it carefully.

Decide:
1. "matches": does the photo plausibly show evidence of this activity (or a believable proxy for it - gym selfie, workout screenshot, running app screenshot, outdoor shot in activewear, etc.)? Be reasonably lenient - this is honor-system accountability, not forensics - but reject photos that are clearly unrelated (e.g. a meal, a meme, a random object, a photo reused pixel-for-identical to a past one if you can tell).
2. "suspicious": is the text description vague ("did it", "done") AND/OR nearly word-for-word identical to several recent entries in a way that suggests copy-pasting rather than genuine variation?
3. "reason": one short sentence explaining your call, in ${langName}.
4. "followupQuestion": if matches is false OR suspicious is true, write ONE short, direct follow-up question in ${langName} asking them to clarify or provide better proof. Otherwise null.

Respond ONLY with strict JSON, no markdown fences:
{"matches": boolean, "suspicious": boolean, "reason": string, "followupQuestion": string|null}`;

  const parts = [{ text: prompt }];
  if (imageBase64) {
    parts.push({ inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } });
  }

  const text = await callGemini({ parts, jsonMode: true, temperature: 0.3 });

  try {
    const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
    const parsed = JSON.parse(cleaned);
    return {
      matches: Boolean(parsed.matches),
      suspicious: Boolean(parsed.suspicious),
      reason: parsed.reason || '',
      followupQuestion: parsed.followupQuestion || null,
    };
  } catch (err) {
    throw new GeminiError(`Could not parse Gemini JSON response: ${text}`);
  }
}

/**
 * Evaluate a clarification the user sent after a flagged check-in, combined with the
 * original description and photo, and decide the final verdict (no further follow-up loop).
 */
async function evaluateFollowup({ originalDescription, followupAnswer, imageBase64, mimeType, activity, language }) {
  const langName = LANGUAGE_NAMES[language] || 'English';
  const prompt = `You are ShowUp, a fitness accountability bot. A user's check-in for "${activity}" was flagged for review.
Original message: "${originalDescription || '(none)'}"
Their clarification just now: "${followupAnswer}"

You are given the original photo attached. Make a FINAL decision - no more follow-ups after this.
Be reasonably lenient: if their clarification is a plausible, specific human explanation, accept it.
Only reject if the clarification is evasive, contradictory, or still clearly doesn't match the photo/activity.

Respond ONLY with strict JSON, no markdown fences:
{"accepted": boolean, "reason": string /* one short sentence in ${langName} */}`;

  const parts = [{ text: prompt }];
  if (imageBase64) {
    parts.push({ inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } });
  }

  const text = await callGemini({ parts, jsonMode: true, temperature: 0.3 });
  try {
    const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
    const parsed = JSON.parse(cleaned);
    return { accepted: Boolean(parsed.accepted), reason: parsed.reason || '' };
  } catch (err) {
    throw new GeminiError(`Could not parse Gemini JSON response: ${text}`);
  }
}

module.exports = { GeminiError, acknowledgeAnswer, verifyCheckin, evaluateFollowup };
