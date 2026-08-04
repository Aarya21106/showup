const config = require('../config');

function getProofInstruction(lang, activity, gestureText) {
  if (lang === 'ta') {
    if (activity === 'gym') return `எடையின் அருகில் ${gestureText}`;
    if (activity === 'running' || activity === 'walking') return `நடை/ஓட்டத்தின் போது ${gestureText} அல்லது உங்கள் டிராக்கிங் ஆப்`;
    if (activity === 'cycling') return `உங்கள் சைக்கிள் அல்லது டிராக்கருடன் ${gestureText}`;
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
  if (activity === 'running' || activity === 'walking') return `${gestureText} (or showing your tracking app/shoes)`;
  if (activity === 'cycling') return `${gestureText} next to your bicycle or showing your tracking app`;
  return `${gestureText}`;
}

// Q1 (name) and Q2 (language) are always asked in English - we don't know their
// language yet. Everything from Q3 onward is localized.
const QUESTIONS = {
  name: "Hey! I'm ShowUp — think of me as the buddy who makes sure you actually follow through this time. What should I call you?",
  language: 'What language do you want to chat in? English, Tamil, or Hindi — your call.',
  en: {
    activity: "Alright, let's get into it. What's your thing — gym, running, yoga, home workouts, some sport, walking, swimming, whatever it is. What are we working with?",
    days: 'Be real with me, not ambitious — how many days a week can you actually commit to showing up?',
    time: 'What time of day does this actually happen, or when do you want it to happen?',
    blocker: "Now the real question. What's stopped you before? Not the polished answer — bad mornings, zero motivation, boredom, life getting in the way, whatever it actually is.",
    vision: 'Now flip it. Picture 30 days from now — you showed up every single time, no excuses. What does that actually do for you?',
    commitment: 'Last one, and be honest — on a scale of 1 to 10, how bad do you want this, right now?',
    allergy: "Do you have any food allergies? (e.g. peanuts, dairy, gluten, or type 'none')",
  },
  ta: {
    activity: 'சரி, தொடங்கலாம். உங்கள் விஷயம் என்ன — ஜிம், ஓட்டம், யோகா, வீட்டு பயிற்சி, ஏதேனும் விளையாட்டு, நடைப்பயிற்சி, நீச்சல், எதுவானாலும் பரவாயில்லை. என்ன இருக்கு?',
    days: 'நேர்மையாக சொல்லுங்கள், லட்சியமாக இல்லாமல் — வாரத்திற்கு எத்தனை நாட்கள் உண்மையில் வர முடியும்?',
    time: 'நாளின் எந்த நேரத்தில் இது நடக்கும், அல்லது நடக்க வேண்டும் என விரும்புகிறீர்கள்?',
    blocker: 'இப்போது உண்மையான கேள்வி. முன்பு உங்களைத் தடுத்தது என்ன? செம்மையான பதில் வேண்டாம் — மோசமான காலைநேரங்கள், உற்சாகமின்மை, சலிப்பு, வாழ்க்கை குறுக்கிடுவது, உண்மையில் எதுவாக இருந்தாலும்.',
    vision: 'இப்போது திருப்பிப் பாருங்கள். 30 நாட்கள் கழித்து — நீங்கள் ஒவ்வொரு முறையும் வந்திருக்கிறீர்கள், சாக்குப்போக்கு இல்லாமல். அது உங்களுக்கு உண்மையில் என்ன செய்யும்?',
    commitment: 'கடைசி கேள்வி, நேர்மையாக சொல்லுங்கள் — 1 முதல் 10 வரை, இப்போது இதை எவ்வளவு விரும்புகிறீர்கள்?',
    allergy: "உங்களுக்கு ஏதேனும் உணவு ஒவ்வாமை (allergy) இருக்கிறதா? (எ.கா. கடலை, பால் பொருட்கள் அல்லது 'none' என கூறவும்)",
  },
  hi: {
    activity: 'ठीक है, शुरू करते हैं। आपकी चीज़ क्या है — जिम, दौड़ना, योगा, होम वर्कआउट, कोई खेल, वॉकिंग, स्विमिंग, कुछ भी। आपके पास क्या है?',
    days: 'ईमानदारी से बताएं, महत्वाकांक्षी नहीं — हफ्ते में असल में कितने दिन आ सकते हैं?',
    time: 'दिन के किस समय यह असल में होता है, या आप चाहते हैं कि हो?',
    blocker: 'अब असली सवाल। पहले आपको किस चीज़ ने रोका था? पॉलिश्ड जवाब नहीं — खराब सुबहें, ज़ीरो मोटिवेशन, बोरियत, ज़िंदगी का आड़े आना, जो भी असल में हो।',
    vision: 'अब पलटकर देखिए। 30 दिन बाद — आप हर बार आए, कोई बहाना नहीं। इससे आपको असल में क्या मिलेगा?',
    commitment: 'आखिरी सवाल, ईमानदारी से बताएं — 1 से 10 के बीच, अभी आप इसे कितनी बुरी तरह चाहते हैं?',
    allergy: "क्या आपको किसी भोजन से एलर्जी है? (जैसे मूंगफली, डेयरी, ग्लूटेन, या अगर कुछ नहीं है तो 'none' कहें)",
  },
};

function detectLanguage(answer) {
  const a = (answer || '').toLowerCase();
  if (a.includes('tamil') || a.includes('தமிழ்')) return 'ta';
  if (a.includes('hindi') || a.includes('हिंदी') || a.includes('हिन्दी')) return 'hi';
  return 'en';
}

const T = {
  en: {
    depositAsk: ({ name, amt, refund, penalty, days, blocker, vision, score }) =>
      `${name}, real talk — you told me "${blocker}" is what's gotten you before. And you told me if you actually pulled this off, ${vision}. That gap right there? That's exactly what this closes.\n\n` +
      `Here's exactly how the money works, no fine print:\n` +
      `💰 You put down ₹${amt} today. That's the whole ask.\n` +
      `✅ Show up and check in for all ${days} days, no fakes → you get ₹${refund} back. That's your ₹${amt} PLUS ₹${refund - amt} — you get paid to become the person you just said you'd be.\n` +
      `⚠️ Miss a day, or fake a check-in → ₹${penalty} comes off your ₹${amt}, every single time. Enough slips and there's nothing left.\n\n` +
      `That's it. No subscription, no hidden charges. The only way this costs you anything is by not showing up — and you just told me you're a ${score}/10 on wanting this.`,
    howItWorks: () =>
      "Here's the day-to-day: I text you at your time, every day. You reply with what you did — a line of text, plus a photo. I actually look at that photo and check it against what you said and your history, so there's no bluffing your way through this. You show up, I hold you to it, you walk away with more than you put in.",
    paymentLink: (url) => `Ready? Pay your ₹${config.depositAmountInr} here: ${url}\n\nOnce it's done, just text me "paid" and Day 1 starts. Let's go.`,
    notPaidYet: () => `No stress — whenever you're ready. Pay the ₹${config.depositAmountInr}, text me "paid", and we start the clock on the ${config.pledgeDays} days that actually change this.`,
    paidConfirmed: (time) => `That's it — you're locked in! \u{1F525} I'll text you every day around ${time}. Show up, send me what you did plus a photo, and let's prove it. Day 1 starts now.`,
    dailyPrompt: (activity, gestureText) => `Time to show up — what's the move today for ${activity}? Send me a quick line + a photo showing ${getProofInstruction('en', activity, gestureText)} when it's done. I know you've got this.`,
    needPhoto: (gestureText, activity) => `Love the update — now send me a photo too, showing ${getProofInstruction('en', activity || 'gym', gestureText)}, so I can check it in properly.`,
    needGesturePhoto: (gestureText, activity) => `To verify today's session, please send a photo showing the daily gesture: ${getProofInstruction('en', activity || 'gym', gestureText)}.`,
    reminder: (gestureText, activity) => `hi there, you might have forgotten something dude 😅. come on, just the proof is what i need! Send a quick line + a photo showing ${getProofInstruction('en', activity || 'gym', gestureText)}.`,
    'gesture_thumbs-up': 'a thumbs-up',
    'gesture_peace-sign': 'holding up 2 fingers (peace sign)',
    'gesture_three-fingers': 'holding up 3 fingers',
    'gesture_fist': 'making a fist',
    'gesture_ok-sign': 'making an OK sign (index finger and thumb forming a circle)',
    checkinAccepted: (streak, daysLeft) =>
      `Logged, and I see you. \u{1F525} ${streak}-day streak. ${daysLeft} day${daysLeft === 1 ? '' : 's'} to go — keep stacking them.`,
    checkinFailedFinal: (reason) =>
      `That doesn't check out — ${reason} This one's a slip. Doesn't erase the rest — tomorrow's a clean day, show up.`,
    weeklyOnTrack: (streak, daysLeft, payout) =>
      `Week check-in: ${streak}-day streak and still going. ${daysLeft} more day${daysLeft === 1 ? '' : 's'} to your ₹${payout} payout. This is exactly what showing up looks like.`,
    weeklySlipped: (missed, payout) =>
      `Week check-in: ${missed} slip${missed === 1 ? '' : 's'} so far. Current standing: ₹${payout} coming back. Plenty of week left to turn this around — today's a good day to start.`,
    finalComplete: (payout) =>
      `That's ${config.pledgeDays}/${config.pledgeDays} — every single day, no excuses. ₹${payout} coming back to you. You did the thing you said you couldn't. Proud of you.`,
    finalPartial: (days, payout) =>
      `${config.pledgeDays} days done, ${days} of them counted. ₹${payout} உங்களுக்குத் திரும்பும். However it went — you showed up more than you would've without this, and that's not nothing.`,
    missedYesterday: () => "No check-in came in yesterday — marking it as a slip and moving on. No lecture, just: today's a clean slate.",
    waitForPrompt: () => "You're all set — I'll text you at your check-in time each day. Nothing to do right now.",
  },
  ta: {
    depositAsk: ({ name, amt, refund, penalty, days, blocker, vision, score }) =>
      `${name}, நேர்மையாக சொல்கிறேன் — முன்பு உங்களைத் தடுத்தது "${blocker}" என்று சொன்னீர்கள். இதை முடித்தால் ${vision} என்றும் சொன்னீர்கள். அந்த இடைவெளிதான் — இதுதான் அதை மூடப் போகிறது.\n\n` +
      `பணம் எப்படி வேலை செய்யும் என்பதை சரியாகச் சொல்கிறேன், மறைமுக நிபந்தனைகள் இல்லை:\n` +
      `💰 இன்று ₹${amt} செலுத்துங்கள். இதுதான் முழு கேள்வி.\n` +
      `✅ ${days} நாட்களும் ஏமாற்றாமல் செக்-இன் செய்தால் → ₹${refund} திரும்பப் பெறுவீர்கள். அது உங்கள் ₹${amt} + ₹${refund - amt} — நீங்கள் சொன்ன நபராக மாறுவதற்கு பணம் கிடைக்கும்.\n` +
      `⚠️ ஒரு நாள் தவறவிட்டால், அல்லது செக்-இன்னில் ஏமாற்றினால் → ₹${penalty} ஒவ்வொரு முறையும் ₹${amt}-இல் இருந்து கழிக்கப்படும். போதுமான தவறுகள் என்றால் எதுவும் மிச்சம் இருக்காது.\n\n` +
      `அவ்வளவுதான். சந்தா இல்லை, மறைமுக கட்டணம் இல்லை. நீங்கள் வராமல் இருந்தால் மட்டுமே இது செலவாகும் — நீங்கள் ஏற்கனவே ${score}/10 என்று சொன்னீர்கள்.`,
    howItWorks: () =>
      'தினசரி எப்படி இருக்கும்: உங்கள் நேரத்தில் தினமும் மெசேஜ் அனுப்புவேன். நீங்கள் என்ன செய்தீர்கள் என்பதையும், ஒரு புகைப்படத்தையும் பதிலளியுங்கள். அந்த புகைப்படத்தை நான் உண்மையில் பார்த்து, நீங்கள் சொல்வதோடும் உங்கள் வரலாற்றோடும் ஒப்பிடுவேன் — ஏமாற்ற முடியாது. நீங்கள் வந்தால், நான் உறுதி செய்வேன், நீங்கள் போட்டதை விட அதிகமாகப் பெறுவீர்கள்.',
    paymentLink: (url) => `தயாரா? உங்கள் ₹${config.depositAmountInr}-ஐ இங்கே செலுத்துங்கள்: ${url}\n\nமுடிந்ததும், "paid" என்று எனக்கு அனுப்புங்கள், நாள் 1 தொடங்கும்.`,
    notPaidYet: () => `பரவாயில்லை — நீங்கள் தயாரானதும். ₹${config.depositAmountInr} செலுத்தி "paid" என்று சொல்லுங்கள், இதை மாற்றப் போகும் ${config.pledgeDays} நாட்களின் கடிகாரம் தொடங்கும்.`,
    paidConfirmed: (time) => `அவ்வளவுதான் — நீங்கள் பதிவு செய்யப்பட்டீர்கள்! \u{1F525} தினமும் சுமார் ${time} மணிக்கு மெசேஜ் அனுப்புவேன். வந்து, என்ன செய்தீர்கள் என்பதோடு ஒரு புகைப்படத்தையும் அனுப்புங்கள். நாள் 1 இப்போது தொடங்குகிறது.`,
    dailyPrompt: (activity, gestureText) => `நேரமாச்சு — இன்று ${activity}-க்காக என்ன செய்கிறீர்கள்? முடிந்ததும் ஒரு வரியும், ${getProofInstruction('ta', activity, gestureText)} காட்டும் ஒரு புகைப்படமும் அனுப்புங்கள். உங்களால் முடியும்.`,
    needPhoto: (gestureText, activity) => `அப்டேட் பிடிச்சிருக்கு — இப்போது ${getProofInstruction('ta', activity || 'gym', gestureText)} காட்டும் ஒரு புகைப்படத்தையும் அனுப்புங்கள், சரியாக சரிபார்க்கிறேன்.`,
    needGesturePhoto: (gestureText, activity) => `இன்றைய உடற்பயிற்சியை சரிபார்க்க, தயவுசெய்து ${getProofInstruction('ta', activity || 'gym', gestureText)} காட்டி புகைப்படத்தை அனுப்பவும்.`,
    reminder: (gestureText, activity) => `அங்கு ஏதோ மறந்திருக்கிறீர்கள் என நினைக்கிறேன் நண்பா 😅. கவலைப்படாதீர்கள், வெறும் ஆதாரம் (photo) மட்டும் தான் எனக்கு வேண்டும்! ${getProofInstruction('ta', activity || 'gym', gestureText)}-ஐ காட்டி புகைப்படத்தை அனுப்பவும்.`,
    'gesture_thumbs-up': 'பெருவிரலை உயர்த்துவது (thumbs-up)',
    'gesture_peace-sign': '2 விரல்களை உயர்த்துவது (peace sign)',
    'gesture_three-fingers': '3 விரல்களை உயர்த்துவது (3 fingers)',
    'gesture_fist': 'ஒரு முஷ்டி காட்டுவது (fist)',
    'gesture_ok-sign': 'சரி என்று விரல்களால் காட்டுவது (OK sign)',
    checkinAccepted: (streak, daysLeft) =>
      `பதிவு செய்யப்பட்டது. \u{1F525} ${streak} நாள் தொடர்ச்சி. இன்னும் ${daysLeft} நாட்கள் — தொடருங்கள்.`,
    checkinFailedFinal: (reason) =>
      `இது சரிபடவில்லை — ${reason} இது ஒரு தவறாக குறிக்கப்பட்டது. மற்றதை அழிக்காது — நாளை புதிய நாள், தொடருங்கள்.`,
    weeklyOnTrack: (streak, daysLeft, payout) =>
      `வார சரிபார்ப்பு: ${streak} நாள் தொடர்ச்சி, இன்னும் தொடர்கிறீர்கள். ₹${payout} பெறுவதற்கு இன்னும் ${daysLeft} நாட்கள். இதுதான் வருவது எப்படி இருக்க வேண்டும் என்பதற்கான உதாரணம்.`,
    weeklySlipped: (missed, payout) =>
      `வார சரிபார்ப்பு: இதுவரை ${missed} தவறுகள். தற்போதைய நிலை: ₹${payout} திரும்பும். இன்னும் வாரம் மிச்சம் இருக்கு — இன்றே திருத்த ஆரம்பியுங்கள்.`,
    finalComplete: (payout) =>
      `அது ${config.pledgeDays}/${config.pledgeDays} — ஒவ்வொரு நாளும், சாக்குப்போக்கு இல்லாமல். ₹${payout} உங்களுக்குத் திரும்பும். முடியாது என நினைத்ததை செய்து காட்டினீர்கள். பெருமைப்படுகிறேன்.`,
    finalPartial: (days, payout) =>
      `${config.pledgeDays} நாட்கள் முடிந்தன, ${days} நாட்கள் எண்ணப்பட்டன. ₹${payout} உங்களுக்குத் திரும்பும். எப்படி இருந்தாலும் — இது இல்லாமல் இருப்பதை விட அதிகமாக வந்தீர்கள், அது சாதாரணமில்லை.`,
    missedYesterday: () => 'நேற்று செக்-இன் வரவில்லை — ஒரு தவறாக குறித்து தொடர்கிறோம். விமர்சனம் இல்லை — இன்று புதிய தொடக்கம்.',
    waitForPrompt: () => 'நீங்கள் தயார் — ஒவ்வொரு நாளும் உங்கள் நேரத்தில் மெசேஜ் அனுப்புவேன். இப்போது எதுவும் செய்ய வேண்டாம்.',
  },
  hi: {
    depositAsk: ({ name, amt, refund, penalty, days, blocker, vision, score }) =>
      `${name}, सच कहूं — आपने बताया कि "${blocker}" ने पहले आपको रोका था। और आपने कहा कि अगर आपने यह कर दिखाया, तो ${vision}। वही गैप है — इसे यही भरने वाला है।\n\n` +
      `पैसा बिल्कुल कैसे काम करता है, बिना किसी छुपी शर्त के:\n` +
      `💰 आज ₹${amt} जमा करें। बस इतना ही।\n` +
      `✅ ${days} दिन बिना किसी बहाने के चेक-इन करें → ₹${refund} वापस मिलेगा। यानी आपका ₹${amt} + ₹${refund - amt} — आप जो बनना चाहते थे, उसके लिए आपको पैसे मिलेंगे।\n` +
      `⚠️ एक दिन मिस किया, या चेक-इन में झूठ बोला → हर बार ₹${penalty} आपके ₹${amt} में से कटेगा। ज़्यादा चूक हुई तो कुछ नहीं बचेगा।\n\n` +
      `बस इतना ही। कोई सब्सक्रिप्शन नहीं, कोई छुपा चार्ज नहीं। यह सिर्फ तभी महंगा पड़ेगा जब आप नहीं आए — और आपने अभी बताया कि आप ${score}/10 पर हैं।`,
    howItWorks: () =>
      'रोज़ का हिसाब ऐसा है: मैं आपके समय पर रोज़ मैसेज करूंगा। आप जवाब में बताएं क्या किया — एक लाइन और एक फोटो। मैं वाकई वो फोटो देखकर उसे आपकी बात और पुराने रिकॉर्ड से मिलाऊंगा, तो बहाना नहीं चलेगा। आप आएं, मैं पक्का करूंगा, आप जितना डाला उससे ज़्यादा लेकर जाएंगे।',
    paymentLink: (url) => `तैयार हैं? अपनी ₹${config.depositAmountInr} यहां भरें: ${url}\n\nहो जाए तो बस "paid" लिखकर भेजें, दिन 1 शुरू।`,
    notPaidYet: () => `कोई जल्दी नहीं — जब तैयार हों। ₹${config.depositAmountInr} भरें, "paid" लिखें, और उन ${config.pledgeDays} दिनों की घड़ी शुरू करें जो असल में यह बदल देंगे।`,
    paidConfirmed: (time) => `बस यही था — आप लॉक-इन हो गए! \u{1F525} मैं रोज़ करीब ${time} बजे मैसेज करूंगा। आकर बताइए क्या किया, एक फोटो के साथ। दिन 1 अभी से शुरू।`,
    dailyPrompt: (activity, gestureText) => `समय हो गया — आज ${activity} के लिए क्या कर रहे हैं? हो जाए तो एक लाइन + ${getProofInstruction('hi', activity, gestureText)} दिखाते हुए एक फोटो भेजें। आप कर सकते हैं।`,
    needPhoto: (gestureText, activity) => `अपडेट अच्छा लगा — अब ${getProofInstruction('hi', activity || 'gym', gestureText)} दिखाते हुए एक फोटो भी भेजिए ताकि मैं ठीक से चेक-इन कन्फर्म कर सकूं।`,
    needGesturePhoto: (gestureText, activity) => `आज के वर्कआउट को कन्फर्म करने के लिए, कृपया ${getProofInstruction('hi', activity || 'gym', gestureText)} दिखाते हुए अपनी फोटो भेजें।`,
    reminder: (gestureText, activity) => `अरे भाई, आप कुछ भूल रहे हैं शायद 😅। कोई बात नहीं, मुझे बस आपकी कसरत का प्रूफ चाहिए! ${getProofInstruction('hi', activity || 'gym', gestureText)} दिखाते हुए अपनी फोटो भेजें।`,
    'gesture_thumbs-up': 'अंगूठा दिखाना (thumbs-up)',
    'gesture_peace-sign': '2 उंगलियां दिखाना (peace sign)',
    'gesture_three-fingers': '3 उंगलियां दिखाना (3 fingers)',
    'gesture_fist': 'मुट्ठी बनाना (fist)',
    'gesture_ok-sign': 'ओके का इशारा (OK sign)',
    checkinAccepted: (streak, daysLeft) =>
      `दर्ज हो गया, और मैं देख रहा हूं। \u{1F525} ${streak}-दिन की स्ट्रीक। ${daysLeft} दिन बाकी — लगे रहिए।`,
    checkinFailedFinal: (reason) =>
      `यह ठीक नहीं बैठा — ${reason} इसे चूक के रूप में दर्ज किया गया। बाकी दिन खराब नहीं होते — कल एक साफ दिन है, फिर आइए।`,
    weeklyOnTrack: (streak, daysLeft, payout) =>
      `साप्ताहिक अपडेट: ${streak}-दिन की स्ट्रीक, अभी भी चालू। ₹${payout} पाने के लिए ${daysLeft} दिन और बाकी। दिखाना यही कहलाता है।`,
    weeklySlipped: (missed, payout) =>
      `साप्ताहिक अपडेट: अब तक ${missed} चूक। मौजूदा स्थिति: ₹${payout} वापस आ रहा है। हफ्ता अभी बाकी है — आज से सुधारना शुरू करें।`,
    finalComplete: (payout) =>
      `${config.pledgeDays}/${config.pledgeDays} — हर दिन, कोई बहाना नहीं। ₹${payout} आपको वापस मिल रहा है। जो नामुमकिन लगता था, वो कर दिखाया। गर्व है आप पर।`,
    finalPartial: (days, payout) =>
      `${config.pledgeDays} दिन पूरे हुए, ${days} दिन गिने गए। ₹${payout} आपको वापस मिल रहा है। जो भी हुआ — इसके बिना होने से कहीं ज़्यादा आप आए, और यह कोई छोटी बात नहीं।`,
    missedYesterday: () => 'कल कोई चेक-इन नहीं आया — इसे चूक के तौर पर दर्ज कर आगे बढ़ रहे हैं। कोई लेक्चर नहीं — आज एक साफ शुरुआत है।',
    waitForPrompt: () => 'आप तैयार हैं — मैं रोज़ आपके समय पर मैसेज करूंगा। अभी कुछ करने की ज़रूरत नहीं।',
  },
};

function t(language, key, ...args) {
  const lang = T[language] ? language : 'en';
  const fn = T[lang][key] || T.en[key];
  return typeof fn === 'function' ? fn(...args) : fn;
}

function fallbackAck(language) {
  if (language === 'ta') return 'சரி!';
  if (language === 'hi') return 'ठीक है!';
  return 'Got it!';
}

function question(language, key) {
  if (key === 'name' || key === 'language') return QUESTIONS[key];
  const lang = QUESTIONS[language] ? language : 'en';
  return QUESTIONS[lang][key];
}

module.exports = { t, question, detectLanguage, fallbackAck };
