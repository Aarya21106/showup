const config = require('../config');

function getProofInstruction(lang, activity, gestureText) {
  if (lang === 'tl') {
    if (activity === 'gym') return `weights pakkathula ${gestureText}`;
    if (activity === 'running' || activity === 'walking') return `run/walk pannum bodhu ${gestureText} or tracking app screenshot`;
    if (activity === 'cycling') return `cycle or tracker kooda ${gestureText}`;
    return `${gestureText}`;
  }
  if (lang === 'ta') {
    if (activity === 'gym') return `எடையின் அருகில் ${gestureText}`;
    if (activity === 'running' || activity === 'walking') return `நடை/ஓட்டத்தின் போது ${gestureText} அல்லது உங்கள் டிராக்கிங் ஆப்`;
    if (activity === 'cycling') return `உங்கள் சைக்கிள் அல்லது டிராக்கருடன் ${gestureText}`;
    return `${gestureText}`;
  }
  if (lang === 'hl') {
    if (activity === 'gym') return `weights ke paas ${gestureText}`;
    if (activity === 'running' || activity === 'walking') return `run/walk karte waqt ${gestureText} ya tracking app screenshot`;
    if (activity === 'cycling') return `cycle ya tracker ke saath ${gestureText}`;
    return `${gestureText}`;
  }
  if (lang === 'hi') {
    if (activity === 'gym') return `वजन के साथ ${gestureText}`;
    if (activity === 'running' || activity === 'walking') return `रन/वॉक के दौरान ${gestureText} या अपने ट्रैकिंग ऐप के साथ`;
    if (activity === 'cycling') return `अपनी साइकिल या ट्रैकर के साथ ${gestureText}`;
    return `${gestureText}`;
  }
  // English (default)
  if (activity === 'gym') return `${gestureText} next to the weights`;
  if (activity === 'running' || activity === 'walking') return `${gestureText} or your fitness app screenshot`;
  if (activity === 'cycling') return `${gestureText} next to your bicycle or tracking app`;
  return `${gestureText}`;
}

// ── Meal reminder consent flow ──

function mealReminderConsentQuestion(lang) {
  if (lang === 'tl') return "Naan unga calorie tracking-ku reminder anupanuma? Breakfast, lunch, dinner, snacks ellathukum.\n\n1. Aama, reminder venum\n2. Illa, naane track pannikren";
  if (lang === 'ta') return "நான் உங்கள் கலோரி டிராக்கிங்கிற்கு நினைவூட்டல் அனுப்பவா? காலை, மதிய, இரவு உணவு மற்றும் சிற்றுண்டிக்கு.\n\n1. ஆம், நினைவூட்டல் வேண்டும்\n2. இல்லை, நானே கண்காணிப்பேன்";
  if (lang === 'hl') return "Kya main aapko calorie tracking ke liye reminder bhejun? Breakfast, lunch, dinner aur snacks ke liye.\n\n1. Haan, reminder chahiye\n2. Nahi, main khud track karunga";
  if (lang === 'hi') return "क्या मैं आपको कैलोरी ट्रैकिंग के लिए रिमाइंडर भेजूं? नाश्ता, दोपहर, रात के खाने और स्नैक्स के लिए।\n\n1. हाँ, रिमाइंडर चाहिए\n2. नहीं, मैं खुद ट्रैक करूंगा";
  return "Should I remind you to track your calories? I'll nudge you for breakfast, lunch, dinner, and snacks.\n\n1. Yes, send me reminders\n2. No, I'll track it myself";
}

function mealReminderTimesPrompt(lang) {
  if (lang === 'tl') return "Seri! Eppa reminder venum sollunga — breakfast, lunch, dinner, and any snack times. (Eg: breakfast 8am, lunch 1pm, snack 4pm, dinner 8:30pm)";
  if (lang === 'ta') return "சரி! எந்த நேரங்களில் நினைவூட்டல் வேண்டும் என்று சொல்லுங்கள் — காலை, மதியம், இரவு உணவு மற்றும் சிற்றுண்டி நேரங்கள். (எ.கா: காலை 8am, மதியம் 1pm, சிற்றுண்டி 4pm, இரவு 8:30pm)";
  if (lang === 'hl') return "Great! Batao kis time reminder chahiye — breakfast, lunch, dinner aur snack times. (Jaise: breakfast 8am, lunch 1pm, snack 4pm, dinner 8:30pm)";
  if (lang === 'hi') return "बढ़िया! बताइए किस समय रिमाइंडर चाहिए — नाश्ता, दोपहर, रात का खाना और स्नैक्स के समय। (जैसे: नाश्ता 8am, दोपहर 1pm, स्नैक 4pm, रात 8:30pm)";
  return "Great! Tell me what times you want reminders for — breakfast, lunch, dinner, and any snack times. (e.g. breakfast 8am, lunch 1pm, snack 4pm, dinner 8:30pm)";
}

function mealReminderConfirmed(lang, timesSummary) {
  if (lang === 'tl') return `Seri, lock pannitten! Reminders varum: ${timesSummary}. Ippo unga plan start pannalam!`;
  if (lang === 'ta') return `சரி, பதிவு செய்துவிட்டேன்! நினைவூட்டல்கள் வரும்: ${timesSummary}. இப்போது உங்கள் திட்டத்தைத் தொடங்கலாம்!`;
  if (lang === 'hl') return `Theek hai, lock kar diya! Reminders aayenge: ${timesSummary}. Ab plan shuru karte hain!`;
  if (lang === 'hi') return `ठीक है, लॉक कर दिया! रिमाइंडर आएंगे: ${timesSummary}। अब आपका प्लान शुरू करते हैं!`;
  return `Locked in! Reminders will come at: ${timesSummary}. Let's get your plan started!`;
}

function selfTrackingConsentQuestion(lang) {
  if (lang === 'tl') return "Seri, reminder anupa maten. Aana neenga unga calories manually track pannuveengala? Sapta udane 'sapten 2 muttai, 1 dosa' mari message pannunga.\n\n1. Aama, naane track pannuven\n2. Illa, track panna maten";
  if (lang === 'ta') return "சரி, நினைவூட்டல் அனுப்ப மாட்டேன். ஆனால் நீங்கள் உங்கள் கலோரிகளை நேரடியாகக் கண்காணிப்பீர்களா? சாப்பிட்டவுடன் 'சாப்பிட்டேன் 2 முட்டை, 1 தோசை' போல மெசேஜ் அனுப்புங்கள்.\n\n1. ஆம், நானே கண்காணிப்பேன்\n2. இல்லை, கண்காணிக்க மாட்டேன்";
  if (lang === 'hl') return "Theek hai, reminder nahi bhejunga. Par kya aap khud apni calories track karenge? Khane ke baad bas 'maine khaya 2 ande, 1 roti' jaisa message bhej dena.\n\n1. Haan, main track karunga\n2. Nahi, track nahi karunga";
  if (lang === 'hi') return "ठीक है, रिमाइंडर नहीं भेजूंगा। पर क्या आप खुद अपनी कैलोरी ट्रैक करेंगे? खाने के बाद बस 'मैंने खाया 2 अंडे, 1 रोटी' जैसा मैसेज भेज दें।\n\n1. हाँ, मैं ट्रैक करूंगा\n2. नहीं, ट्रैक नहीं करूंगा";
  return "Got it, no reminders. But will you track your calories yourself? Just text me what you eat, like 'I ate 2 eggs and 1 roti'.\n\n1. Yes, I'll track it myself\n2. No, I won't track it";
}

function selfTrackingConfirmed(lang) {
  if (lang === 'tl') return "Semma! Neenga sapta udane sollunga, naan calories calculate panni track pannuven.";
  if (lang === 'ta') return "அருமை! நீங்கள் சாப்பிட்டவுடன் சொல்லுங்கள், நான் கலோரிகளைக் கணக்கிட்டு கண்காணிப்பேன்.";
  if (lang === 'hl') return "Badhiya! Aap khane ke baad bata dena, main calories calculate karke track karunga.";
  if (lang === 'hi') return "बढ़िया! आप खाने के बाद बता देना, मैं कैलोरी कैलकुलेट करके ट्रैक करूंगा।";
  return "Perfect! Just tell me what you eat and I'll calculate and track the calories for you.";
}

function trackingDeclinedWarning(lang) {
  if (lang === 'tl') return "Bro, calorie tracking illama unga progress kanakka mudiyathu — overeating or undereating theriyama poidum, adhu unga goal-a delay pannum illna health-a affect pannum.\n\n\"Neenga measure pannaadha ella, improve panna mudiyathu.\"\n\nOnce ninachu paarunga — reminders venumaa illa neenga track pannuveengala?";
  if (lang === 'ta') return "கவனம், கலோரி டிராக்கிங் இல்லாமல் உங்கள் முன்னேற்றத்தைக் கண்காணிக்க முடியாது — அதிகமாக அல்லது குறைவாக சாப்பிடுவது தெரியாமல் போகலாம், இது உங்கள் இலக்கைத் தாமதப்படுத்தும் அல்லது உடல்நலத்தைப் பாதிக்கும்.\n\n\"நீங்கள் அளவிடாதவற்றை மேம்படுத்த முடியாது.\"\n\nமீண்டும் ஒரு முறை யோசியுங்கள் — நினைவூட்டல் வேண்டுமா அல்லது நீங்கள் கண்காணிப்பீர்களா?";
  if (lang === 'hl') return "Bhai, calorie tracking ke bina progress track karna mushkil hai — overeating ya undereating pata hi nahi chalega, isse goal delay ho sakta hai ya health par asar pad sakta hai.\n\n\"Jo aap measure nahi karte, use improve nahi kar sakte.\"\n\nEk baar phir soch lo — reminder chahiye ya khud track karoge?";
  if (lang === 'hi') return "ध्यान दें, कैलोरी ट्रैकिंग के बिना प्रगति नापना मुश्किल है — ज़्यादा या कम खाना पता ही नहीं चलेगा, इससे लक्ष्य में देरी हो सकती है या सेहत पर असर पड़ सकता है।\n\n\"जो आप नाप नहीं सकते, उसे सुधार नहीं सकते।\"\n\nएक बार फिर सोच लें — रिमाइंडर चाहिए या खुद ट्रैक करेंगे?";
  return "Careful — without any calorie tracking, it's easy to unknowingly overeat or undereat, which can stall your progress or affect your health.\n\n\"What gets measured gets managed.\"\n\nTake a second look — want reminders, or will you track it yourself?";
}

// ── Nutrition plan confirmation loop ──

function nutritionPlanConfirmPrompt(lang) {
  if (lang === 'tl') return "Idhu nallа irukka? Reply \"confirm\" panni lock pannunga, illa enna change venumnu sollunga.";
  if (lang === 'ta') return "இது நன்றாக இருக்கிறதா? \"confirm\" என்று பதிலளித்து பூட்டவும், அல்லது என்ன மாற்றம் வேண்டும் என்று சொல்லுங்கள்.";
  if (lang === 'hl') return "Yeh theek laga? \"confirm\" reply karke lock kar do, ya batao kya change chahiye.";
  if (lang === 'hi') return "क्या यह ठीक लगा? \"confirm\" लिखकर लॉक करें, या बताएं क्या बदलना है।";
  return "Does this work for you? Reply \"confirm\" to lock it in, or tell me what you'd like to change.";
}

function trackingDeclinedFinal(lang) {
  if (lang === 'tl') return "Seri, purinjukten. Naan idha pathi periodic-a nyabagapaduthuven. Nutrition pathi edhavadhu kekanumna, eppovum kekalam!";
  if (lang === 'ta') return "சரி, புரிந்துகொண்டேன். நான் இதைப் பற்றி அவ்வப்போது நினைவூட்டுவேன். ஊட்டச்சத்து பற்றி எதுவும் கேட்க வேண்டுமானால், எப்போது வேண்டுமானாலும் கேளுங்கள்!";
  if (lang === 'hl') return "Theek hai, samajh gaya. Main beech beech mein isके bare mein yaad dilata rahunga. Nutrition ke baare mein kabhi bhi pooch sakte ho!";
  if (lang === 'hi') return "ठीक है, समझ गया। मैं बीच-बीच में इसके बारे में याद दिलाता रहूंगा। पोषण के बारे में कभी भी पूछ सकते हैं!";
  return "Understood — I'll check in on this from time to time instead. Ask me anything about nutrition whenever you're ready!";
}

const QUESTIONS = {
  name: "Hey, I'm ShowUp — your AI fitness coach.\nI'll help you train, eat, recover, track progress, and adjust your plan as you improve.\n\nWhat should I call you?",
  goal: "What are you primarily trying to achieve right now?\n\n• Build muscle\n• Lose fat\n• Get stronger\n• Improve fitness / endurance\n• Something else",
  experience: "How would you describe your current training experience?\n\n• Beginner\n• Some experience\n• Experienced",
  current_training: "What does your current training look like right now? (e.g. Gym lifting, home workouts, outdoor running, cycling, brisk walking, or starting fresh?)",
  baseline_metrics: "What is your height and current weight? (e.g. 175 cm, 70 kg)",
  schedule_days: "How many days can you realistically train each week?",
  schedule_time: "When do you usually train or prefer to do your workouts? (e.g. 7:00 AM, 7:00 PM)",
  diet_routine: "What does a normal day of eating look like for you? (Breakfast, lunch, dinner, snacks)",
  diet_restrictions: "Any foods you avoid, allergies, dietary restrictions, or meals you absolutely don't want to change?",
  obstacles: "What usually gets in the way of your training consistency?\n\n• Time\n• Motivation\n• I forget to go / lose track\n• Consistency / Routine\n• Diet\n• Recovery / Fatigue\n• Nothing major / Something else",
  sleep: "How many hours do you normally sleep each night?",
  injuries: "Any current injuries, pain, or physical limitations that affect your training? (If none, just say 'none')",
  commitment_ask: "Your plan is ready.\n\nOne thing I need from you to lock it in: what are you committing to consistently?\n\nExample: \"I will complete my scheduled workouts and log them honestly.\"",
  language: 'What language do you prefer to chat in? English, Tamil, Hindi, or Tanglish.',
};

const COMMITMENT_PROMPTS = {
  en: 'Your plan is ready.\n\nOne thing I need from you to lock it in: what are you committing to consistently?\n\nExample: "I will complete my scheduled workouts and log them honestly."',
  tl: 'Unga plan ready.\n\nIdha lock-in panna, ungaloda commitment statement enna?\n\nExample: "Enoda workouts-ah correct-ah mudichu honestly log pannuven."',
  ta: 'உங்கள் திட்டம் தயாராக உள்ளது.\n\nஇதை உறுதிப்படுத்த, உங்கள் உறுதிமொழி என்ன?\n\nஉதாரணம்: "நான் எனது உடற்பயிற்சிகளை தவறாமல் முடித்து நேர்மையாக பதிவு செய்வேன்."',
  hi: 'आपका प्लान तैयार है।\n\nइसे लॉक करने के लिए, आपका कमिटमेंट स्टेटमेंट क्या है?\n\nउदाहरण: "मैं अपनी तय कसरत पूरी करूंगा और ईमानदारी से लॉग करूंगा।',
  hl: 'Aapka plan ready hai.\n\nIse lock karne ke liye aapka commitment statement kya hai?\n\nExample: "Main apne scheduled workouts complete karunga aur honestly log karunga."',
};

function detectLanguage(answer) {
  const a = (answer || '').toLowerCase();
  if (a.includes('tanglish') || a.includes('tanlish')) return 'tl';
  if (a.includes('hinglish') || a.includes('hinlish')) return 'hl';
  if (a.includes('tamil') || a.includes('தமிழ்')) return 'ta';
  if (a.includes('hindi') || a.includes('हिंदी') || a.includes('हिन्दी')) return 'hi';
  return 'en';
}

const T = {
  en: {
    accountabilityIntro: ({ name }) =>
      `One last thing before Day 1 — your ShowUp membership.\n\n` +
      `Every member puts down a ₹${config.depositAmountInr} refundable deposit. It's not a fee — it's your own money, held as a commitment stake.\n` +
      `Complete your pledge honestly and it comes back to you. Miss sessions beyond the free buffer and a small portion is forfeited. The goal is to make skipping harder than showing up.\n\n` +
      `Your deposit rules:\n` +
      `• Deposit: ₹${config.depositAmountInr} (refundable)\n` +
      `• Commitment period: 30 days\n` +
      `• Free misses: 2 buffer days (zero penalty)\n` +
      `• Miss after free misses: ₹${config.slipPenaltyInr} per day forfeited\n` +
      `• Platform fee: ₹${config.platformFeeInr} (deducted at completion)\n` +
      `• Refund balance: ₹${config.fullPayoutInr} returned on completion\n\n` +
      `Now choose your tier:\n\n` +
      `1. Basic — ₹${config.pricing.basic.monthly}/month\n` +
      `   Daily reminders, check-in verification, AI nutrition plan, doubt clearing\n\n` +
      `2. Pro — ₹${config.pricing.pro.monthly}/month\n` +
      `   Everything in Basic + diet logging, calorie tracking, burn logs, exercise deep-dives, performance tracking, and detailed progress analytics\n\n` +
      `Both tiers include the ₹${config.depositAmountInr} refundable deposit.\n` +
      `Consistent members get ₹${config.pricing.consistencyDiscount}/month off their subscription.\n\n` +
      `Reply "1" for Basic or "2" for Pro.\n` +
      `Have a promo code? Just send it here for free trial access.`,
    depositAsk: ({ name, amt, tier }) =>
      `${tier === 'pro' ? 'Pro' : 'Basic'} tier selected.\n\n` +
      `Pay your ₹${config.depositAmountInr} refundable deposit to activate Day 1:\n`,
    howItWorks: () =>
      "Daily check-in routine:\n" +
      "1. I message you before your chosen workout time with today's target.\n" +
      "2. You complete your workout and reply with one line of text and a photo showing the daily gesture.\n" +
      "3. Show up consistently, retain your deposit, and build unstoppable consistency.",
    paymentLink: (url) => `Deposit link:\n${url}\n\nOnce deposited, reply with "paid" to activate Day 1.`,
    notPaidYet: () => `Pay your ₹${config.depositAmountInr} deposit and reply "paid" to activate Day 1.`,
    paidConfirmed: (time, activity, tier) =>
      `Deposit confirmed. Your ${tier === 'pro' ? 'Pro' : 'Basic'} membership is now active.\n\n` +
      `I will message you daily before ${time || '08:00'} for your ${activity || 'workout'} check-in.`,
    day1Intro: (time, activity) => `You're set. Today is Day 1.\n\nI'll send your workout before training and ask you to log your results afterward.\n\nYour first job: show up.`,
    dailyPrompt: (activity, gestureText) => `Time to show up. Send your workout update and a photo showing ${getProofInstruction('en', activity, gestureText)}.`,
    needPhoto: (gestureText, activity) => `Please send your photo proof showing ${getProofInstruction('en', activity || 'gym', gestureText)} to complete your check-in.`,
    needGesturePhoto: (gestureText, activity) => `To verify today's session, send a photo showing: ${getProofInstruction('en', activity || 'gym', gestureText)}.`,
    reminder: (gestureText, activity) => `Daily reminder: Please submit your workout proof showing ${getProofInstruction('en', activity || 'gym', gestureText)}.`,
    'gesture_one-finger': 'holding up 1 finger',
    'gesture_two-fingers': 'holding up 2 fingers',
    'gesture_three-fingers': 'holding up 3 fingers',
    'gesture_four-fingers': 'holding up 4 fingers',
    'gesture_open-palm': 'holding up 5 fingers (open palm)',
    'gesture_thumbs-up': 'a thumbs-up',
    'gesture_fist': 'making a fist',
    'gesture_yo-yo': 'a yo-yo / call-me hand sign',
    'gesture_spiderman': 'a spiderman / web-shooter hand sign',
    'gesture_peace-sign': 'a peace sign',
    'gesture_ok-sign': 'making an OK sign',
    'gesture_rock-on': 'a rock-on hand sign',
    'gesture_gun-finger': 'a gun finger sign',
    'gesture_crossed-fingers': 'crossed fingers',
    'gesture_l-shape': 'an L-shape finger sign',
    checkinAccepted: (streak, daysLeft) =>
      `Check-in verified. ${streak}-day streak. ${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining.`,
    checkinFailedFinal: (reason) =>
      `Verification failed: ${reason}. Marked as a slip. Focus on showing up tomorrow.`,
    weeklyOnTrack: (streak, daysLeft, payout, discountText = '') =>
      `Weekly summary: ${streak}-day streak (0 slips).\n\n` +
      `• Current refund balance: ₹${payout}\n` +
      `• Days remaining: ${daysLeft} days\n` +
      (discountText ? `• Consistency Reward: ${discountText}\n` : '') +
      `Keep showing up!`,
    weeklySlipped: (missed, payout) =>
      `Weekly summary: ${missed} slip${missed === 1 ? '' : 's'} recorded. Current refund balance: ₹${payout}.`,
    finalComplete: (payout, discountText = '') =>
      `30 days completed! Full pledge fulfilled with 100% adherence.\n\n` +
      `• Full refund balance of ₹${payout} is being processed.\n` +
      (discountText ? `• Consistency Reward: ${discountText}\n` : '') +
      `You proved you are someone who shows up!`,
    finalPartial: (days, payout) =>
      `Pledge period concluded. ${days} sessions completed. Refund balance: ₹${payout}.`,
    missedYesterday: () => "No check-in received yesterday. Marked as a slip. Today is a fresh day.",
    waitForPrompt: () => "You are all set. I will message you at your scheduled check-in time.",
  },
  tl: {
    depositAsk: ({ name, amt }) =>
      `${name}, unga 30-day pledge summary:\n\n` +
      `• Trial: 14-day free access\n` +
      `• Refundable Deposit: ₹${amt}\n` +
      `• Platform Fee: ₹30\n` +
      `• Base Refund Balance: ₹270 (pledge mudicha udane)\n` +
      `• Free Buffer: 2 free strike days (zero penalty)\n` +
      `• Slip Penalty: ₹50 per missed day beyond free strikes\n\n` +
      `Lock-in panna ready-ah?`,
    howItWorks: () =>
      "Daily routine:\n" +
      "1. Daily unga check-in time-la remind pannuven.\n" +
      "2. Workout mudichutu oru line + daily gesture photo proof anupunga.\n" +
      "3. Consistent-ah show up pannunga, unga deposit balance return vaangunga.",
    paymentLink: (url) => `Unga ₹${config.depositAmountInr} refundable deposit link:\n${url}\n\nPay pannitu "paid" nu reply pannunga. Day 1 start aagum.`,
    notPaidYet: () => `₹${config.depositAmountInr} deposit pay pannitu "paid" nu text pannunga.`,
    paidConfirmed: (time, activity) => `Payment confirmed. Unga 30-day pledge active aayiduchu.\n\nDaily ${time || '08:00'} ku ${activity || 'workout'} check-in remind panren.`,
    dailyPrompt: (activity, gestureText) => `Time to show up. Workout update + ${getProofInstruction('tl', activity, gestureText)} photo proof anupunga.`,
    needPhoto: (gestureText, activity) => `Verify panna ${getProofInstruction('tl', activity || 'gym', gestureText)} kaati photo proof anupunga.`,
    needGesturePhoto: (gestureText, activity) => `Today's session verify panna, ${getProofInstruction('tl', activity || 'gym', gestureText)} kaati photo anupunga.`,
    reminder: (gestureText, activity) => `Daily reminder: ${getProofInstruction('tl', activity || 'gym', gestureText)} kaati workout proof anupunga.`,
    'gesture_one-finger': '1 finger showing',
    'gesture_two-fingers': '2 fingers showing',
    'gesture_three-fingers': '3 fingers showing',
    'gesture_four-fingers': '4 fingers showing',
    'gesture_open-palm': '5 fingers (open palm) showing',
    'gesture_thumbs-up': 'thumbs-up sign',
    'gesture_fist': 'making a fist',
    'gesture_yo-yo': 'yo-yo / call-me sign',
    'gesture_spiderman': 'spiderman web-shooter sign',
    'gesture_peace-sign': 'peace sign',
    'gesture_ok-sign': 'OK sign',
    'gesture_rock-on': 'rock-on sign',
    'gesture_gun-finger': 'gun finger sign',
    'gesture_crossed-fingers': 'crossed fingers',
    'gesture_l-shape': 'L-shape finger sign',
    checkinAccepted: (streak, daysLeft) =>
      `Check-in verified. ${streak}-day streak. Innum ${daysLeft} days to go.`,
    checkinFailedFinal: (reason) =>
      `Verification failed: ${reason}. Marked as a slip. Nalaiku clean start.`,
    weeklyOnTrack: (streak, daysLeft, payout, discountText = '') =>
      `Weekly summary: ${streak}-day streak (0 slips).\n\n` +
      `• Current refund balance: ₹${payout}\n` +
      `• Innum ${daysLeft} days to go\n` +
      (discountText ? `• Consistency Reward: ${discountText}\n` : ''),
    weeklySlipped: (missed, payout) =>
      `Weekly summary: ${missed} slips recorded. Current refund balance: ₹${payout}.`,
    finalComplete: (payout, discountText = '') =>
      `30 days completed! Full pledge fulfilled. 100% adherence.\n\n` +
      `• ₹${payout} refund balance credit aagum.\n` +
      (discountText ? `• Consistency Reward: ${discountText}\n` : ''),
    finalPartial: (days, payout) =>
      `Pledge concluded. ${days} days counted. ₹${payout} refund balance.`,
    missedYesterday: () => "Nethu check-in varala. Slip-ah mark panniyachu. Iniku fresh start.",
    waitForPrompt: () => "All set. Scheduled check-in time-la remind panren.",
  },
  ta: {
    depositAsk: ({ name, amt }) =>
      `${name}, உங்கள் 30-நாள் திட்ட விவரம்:\n\n` +
      `• இலவச சோதனை: 14 நாட்கள்\n` +
      `• திரும்பப்பெறும் டெபாசிட்: ₹${amt}\n` +
      `• பிளாட்ஃபார்ம் கட்டணம்: ₹30\n` +
      `• திரும்பப்பெறும் இருப்பு: ₹270\n` +
      `• இலவச ஸ்ட்ரைக்: 2 நாட்கள்\n` +
      `• அபராதம்: தவறவிடும் நாளுக்கு ₹50\n\n` +
      `தொடங்க தயாரா?`,
    howItWorks: () =>
      "தினசரி முறை:\n1. குறிப்பிட்ட நேரத்தில் நினைவூட்டல் வரும்.\n2. ஒரு வரி தகவல் மற்றும் புகைப்பட ஆதாரம் அனுப்பவும்.\n3. தொடர்ந்து செய்து டெபாசிட்டை திரும்பப் பெறுங்கள்.",
    paymentLink: (url) => `உங்கள் ₹${config.depositAmountInr} டெபாசிட் இணைப்பு:\n${url}\n\nசெலுத்திய பின் "paid" என அனுப்பவும்.`,
    notPaidYet: () => `₹${config.depositAmountInr} செலுத்தி "paid" என அனுப்பவும்.`,
    paidConfirmed: (time, activity) => `கட்டணம் உறுதி செய்யப்பட்டது. உங்கள் 30-நாள் திட்டம் தொடங்கிவிட்டது.\n\nதினமும் ${time || '08:00'} மணிக்கு நினைவூட்டுவேன்.`,
    dailyPrompt: (activity, gestureText) => `நேரமானது. உடற்பயிற்சி தகவல் மற்றும் ${getProofInstruction('ta', activity, gestureText)} புகைப்படத்தை அனுப்பவும்.`,
    needPhoto: (gestureText, activity) => `சரிபார்க்க ${getProofInstruction('ta', activity || 'gym', gestureText)} புகைப்படத்தை அனுப்பவும்.`,
    needGesturePhoto: (gestureText, activity) => `சரிபார்க்க ${getProofInstruction('ta', activity || 'gym', gestureText)} புகைப்படத்தை அனுப்பவும்.`,
    reminder: (gestureText, activity) => `நினைவூட்டல்: உங்கள் ${getProofInstruction('ta', activity || 'gym', gestureText)} புகைப்பட ஆதாரத்தை அனுப்பவும்.`,
    'gesture_one-finger': '1 விரல் சைகை',
    'gesture_two-fingers': '2 விரல்கள் சைகை',
    'gesture_three-fingers': '3 விரல்கள் சைகை',
    'gesture_four-fingers': '4 விரல்கள் சைகை',
    'gesture_open-palm': '5 விரல்கள் (திறந்த உள்ளங்கை) சைகை',
    'gesture_thumbs-up': 'பெருவிரல் சைகை',
    'gesture_fist': 'முஷ்டி சைகை',
    'gesture_yo-yo': 'கால்-மீ சைகை',
    'gesture_spiderman': 'ஸ்பைடர்மேன் சைகை',
    'gesture_peace-sign': 'அமைதி (பீஸ்) சைகை',
    'gesture_ok-sign': 'சரி (OK) சைகை',
    'gesture_rock-on': 'ராக்-ஆன் சைகை',
    'gesture_gun-finger': 'துப்பாக்கி விரல் சைகை',
    'gesture_crossed-fingers': 'விரல்கள் குறுக்கிட்ட சைகை',
    'gesture_l-shape': 'L-வடிவ விரல் சைகை',
    checkinAccepted: (streak, daysLeft) =>
      `சரிபார்க்கப்பட்டது. ${streak} நாள் தொடர்ச்சி. இன்னும் ${daysLeft} நாட்கள்.`,
    checkinFailedFinal: (reason) =>
      `சரிபார்ப்பு தோல்வி: ${reason}. தவறாக குறிக்கப்பட்டது.`,
    weeklyOnTrack: (streak, daysLeft, payout, discountText = '') =>
      `வாராந்திர சுருக்கம்: ${streak} நாள் தொடர்ச்சி. இருப்பு: ₹${payout}.\n` +
      (discountText ? `வெகுமதி: ${discountText}\n` : ''),
    weeklySlipped: (missed, payout) =>
      `வாராந்திர சுருக்கம்: ${missed} தவறுகள். இருப்பு: ₹${payout}.`,
    finalComplete: (payout, discountText = '') =>
      `30 நாட்கள் முடிந்தது. திட்டம் நிறைவடைந்தது. ₹${payout} திரும்ப அனுப்பப்படுகிறது.\n` +
      (discountText ? `வெகுமதி: ${discountText}\n` : ''),
    finalPartial: (days, payout) =>
      `காலம் முடிந்தது. ${days} நாட்கள் கணக்கில் எடுக்கப்பட்டன. இருப்பு: ₹${payout}.`,
    missedYesterday: () => "நேற்று வரவில்லை. தவறாக குறிக்கப்பட்டது.",
    waitForPrompt: () => "அனைத்தும் தயார். குறிப்பிட்ட நேரத்தில் தகவல் வரும்.",
  },
  hi: {
    depositAsk: ({ name, amt }) =>
      `${name}, आपके 30-दिन के संकल्प का विवरण:\n\n` +
      `• ट्रायल: 14-दिन का मुफ्त एक्सेस\n` +
      `• रिफंडेबल डिपॉजिट: ₹${amt}\n` +
      `• प्लेटफॉर्म फीस: ₹30\n` +
      `• रिफंड बैलेंस: ₹270 (30 दिन पूरे होने पर)\n` +
      `• बफर: 2 फ्री स्ट्राइक दिन\n` +
      `• पेनल्टी: प्रति मिस दिन ₹50\n\n` +
      `शुरू करने के लिए तैयार हैं?`,
    howItWorks: () =>
      "दैनिक रूटीन:\n1. आपके तय समय पर मैसेज आएगा।\n2. कसरत के बाद एक लाइन और इशारे के साथ फोटो भेजें।\n3. लगातार आएं और अपना डिपॉजिट वापस पाएं।",
    paymentLink: (url) => `अपना ₹${config.depositAmountInr} रिफंडेबल डिपॉजिट यहां जमा करें:\n${url}\n\nजमा करने के बाद "paid" लिखकर भेजें।`,
    notPaidYet: () => `₹${config.depositAmountInr} जमा करें और "paid" लिखकर भेजें।`,
    paidConfirmed: (time, activity) => `भुगतान की पुष्टि हो गई। आपका 30-दिन का संकल्प शुरू हो गया है।\n\nरोज़ ${time || '08:00'} बजे याद दिलाऊंगा।`,
    dailyPrompt: (activity, gestureText) => `समय हो गया है। कसरत का अपडेट और ${getProofInstruction('hi', activity, gestureText)} दिखाते हुए फोटो भेजें।`,
    needPhoto: (gestureText, activity) => `पुष्टि के लिए ${getProofInstruction('hi', activity || 'gym', gestureText)} दिखाते हुए फोटो भेजें।`,
    needGesturePhoto: (gestureText, activity) => `आज के सत्र के लिए ${getProofInstruction('hi', activity || 'gym', gestureText)} दिखाते हुए फोटो भेजें।`,
    reminder: (gestureText, activity) => `रिमाइंडर: ${getProofInstruction('hi', activity || 'gym', gestureText)} दिखाते हुए वर्कआउट प्रूफ भेजें।`,
    'gesture_one-finger': '1 उंगली दिखाना',
    'gesture_two-fingers': '2 उंगलियां दिखाना',
    'gesture_three-fingers': '3 उंगलियां दिखाना',
    'gesture_four-fingers': '4 उंगलियां दिखाना',
    'gesture_open-palm': '5 उंगलियां (खुली हथेली) दिखाना',
    'gesture_thumbs-up': 'अंगूठा दिखाना (थम्स-अप)',
    'gesture_fist': 'मुट्ठी बनाना',
    'gesture_yo-yo': 'कॉल-मी इशारा',
    'gesture_spiderman': 'स्पाइडरमैन इशारा',
    'gesture_peace-sign': 'पीस साइन (2 उंगलियां)',
    'gesture_ok-sign': 'ओके का इशारा',
    'gesture_rock-on': 'रॉक-ऑन इशारा',
    'gesture_gun-finger': 'गन फिंगर इशारा',
    'gesture_crossed-fingers': 'क्रॉस्ड फिंगर्स',
    'gesture_l-shape': 'L-शेप फिंगर इशारा',
    checkinAccepted: (streak, daysLeft) =>
      `सत्यापित किया गया। ${streak}-दिन की स्ट्रीक। ${daysLeft} दिन बाकी।`,
    checkinFailedFinal: (reason) =>
      `सत्यापन विफल: ${reason}। चूक के रूप में दर्ज।`,
    weeklyOnTrack: (streak, daysLeft, payout, discountText = '') =>
      `साप्ताहिक रिपोर्ट: ${streak}-दिन की स्ट्रीक। रिफंड बैलेंस: ₹${payout}।\n` +
      (discountText ? `कंसिस्टेंसी रिवार्ड: ${discountText}\n` : ''),
    weeklySlipped: (missed, payout) =>
      `साप्ताहिक रिपोर्ट: ${missed} चूक दर्ज। रिफंड बैलेंस: ₹${payout}।`,
    finalComplete: (payout, discountText = '') =>
      `30 दिन पूरे हुए। रिफंड बैलेंस ₹${payout} प्रोसेस किया जा रहा है।\n` +
      (discountText ? `कंसिस्टेंसी रिवार्ड: ${discountText}\n` : ''),
    finalPartial: (days, payout) =>
      `संकल्प अवधि समाप्त। ${days} दिन गिने गए। रिफंड बैलेंस: ₹${payout}।`,
    missedYesterday: () => "कल चेक-इन नहीं आया। चूक दर्ज की गई।",
    waitForPrompt: () => "सब सेट है। तय समय पर मैसेज आएगा।",
  },
  hl: {
    depositAsk: ({ name, amt }) =>
      `${name}, aapka 30-day pledge breakdown:\n\n` +
      `• Trial: 14-day free access\n` +
      `• Refundable Deposit: ₹${amt}\n` +
      `• Platform Fee: ₹30\n` +
      `• Refund Balance: ₹270 (30 days complete hone par)\n` +
      `• Free Buffer: 2 free strike days\n` +
      `• Slip Penalty: ₹50 per missed day beyond free strikes\n\n` +
      `Lock-in karne ke liye ready?`,
    howItWorks: () =>
      "Daily routine:\n1. Aapke set time par reminder aayega.\n2. Workout karke ek line + gesture photo proof bhejein.\n3. Consistent rahein aur deposit balance wapas lein.",
    paymentLink: (url) => `Aapka ₹${config.depositAmountInr} refundable deposit link:\n${url}\n\nPay karke "paid" reply karein. Day 1 start hoga.`,
    notPaidYet: () => `₹${config.depositAmountInr} deposit pay karke "paid" text karein.`,
    paidConfirmed: (time, activity) => `Payment confirmed. Aapka 30-day pledge active ho gaya hai.\n\nDaily ${time || '08:00'} baje check-in remind karunga.`,
    dailyPrompt: (activity, gestureText) => `Time to show up. Workout update aur ${getProofInstruction('hl', activity, gestureText)} photo proof bhejein.`,
    needPhoto: (gestureText, activity) => `Verify karne ke liye ${getProofInstruction('hl', activity || 'gym', gestureText)} photo bhejein.`,
    needGesturePhoto: (gestureText, activity) => `Today's session verify karne ke liye ${getProofInstruction('hl', activity || 'gym', gestureText)} photo bhejein.`,
    reminder: (gestureText, activity) => `Daily reminder: ${getProofInstruction('hl', activity || 'gym', gestureText)} workout proof bhejein.`,
    'gesture_one-finger': '1 finger showing',
    'gesture_two-fingers': '2 fingers showing',
    'gesture_three-fingers': '3 fingers showing',
    'gesture_four-fingers': '4 fingers showing',
    'gesture_open-palm': '5 fingers (open palm) showing',
    'gesture_thumbs-up': 'thumbs-up sign',
    'gesture_fist': 'making a fist',
    'gesture_yo-yo': 'yo-yo / call-me sign',
    'gesture_spiderman': 'spiderman web-shooter sign',
    'gesture_peace-sign': 'peace sign',
    'gesture_ok-sign': 'OK sign',
    'gesture_rock-on': 'rock-on sign',
    'gesture_gun-finger': 'gun finger sign',
    'gesture_crossed-fingers': 'crossed fingers',
    'gesture_l-shape': 'L-shape finger sign',
    checkinAccepted: (streak, daysLeft) =>
      `Check-in verified. ${streak}-day streak. ${daysLeft} days remaining.`,
    checkinFailedFinal: (reason) =>
      `Verification failed: ${reason}. Slip mark ho gaya. Kal fresh start.`,
    weeklyOnTrack: (streak, daysLeft, payout, discountText = '') =>
      `Weekly summary: ${streak}-day streak (0 slips).\n\n` +
      `• Current refund balance: ₹${payout}\n` +
      `• ${daysLeft} days remaining\n` +
      (discountText ? `• Consistency Reward: ${discountText}\n` : ''),
    weeklySlipped: (missed, payout) =>
      `Weekly summary: ${missed} slips recorded. Refund balance: ₹${payout}.`,
    finalComplete: (payout, discountText = '') =>
      `30 days completed! Full pledge fulfilled with 100% adherence.\n\n` +
      `• Refund balance ₹${payout} process ho raha hai.\n` +
      (discountText ? `• Consistency Reward: ${discountText}\n` : ''),
    finalPartial: (days, payout) =>
      `Period concluded. ${days} days counted. ₹${payout} refund balance.`,
    missedYesterday: () => "Kal check-in nahi aaya. Slip mark kiya gaya. Aaj fresh start.",
    waitForPrompt: () => "All set. Scheduled time par reminder aayega.",
  },
};

function t(lang, key, ...args) {
  const table = T[lang] || T.en;
  const val = table[key] || T.en[key];
  if (typeof val === 'function') {
    return val(...args);
  }
  return val || key;
}

function question(lang, key) {
  if (key === 'commitment_ask') {
    return COMMITMENT_PROMPTS[lang] || COMMITMENT_PROMPTS.en;
  }
  if (QUESTIONS[key]) return QUESTIONS[key];
  const table = QUESTIONS[lang] || QUESTIONS.en;
  return table[key] || QUESTIONS.en[key] || '';
}

module.exports = {
  t,
  question,
  detectLanguage,
  getProofInstruction,
  mealReminderConsentQuestion,
  mealReminderTimesPrompt,
  mealReminderConfirmed,
  nutritionPlanConfirmPrompt,
  selfTrackingConsentQuestion,
  selfTrackingConfirmed,
  trackingDeclinedWarning,
  trackingDeclinedFinal,
};
