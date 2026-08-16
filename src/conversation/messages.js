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

const QUESTIONS = {
  name: "Hey, I am ShowUp. I will be your daily accountability coach for the next 30 days. What should I call you?",
  activity: "What is your main workout activity — gym, running, walking, or cycling?",
  experience: "Are you a beginner to workouts, or do you already have experience with gym and training?",
  goal: "What specific body or fitness goal do you want to achieve over the next 30 days? (e.g. Lean muscle gain, fat loss, athletic strength)",
  schedule: "How many days a week can you commit, and what time of day will you do your workouts?",
  diet_supplements: "Tell me about your current diet. Also, do you take or plan to take any supplements (such as whey protein, creatine, multivitamins, or none)?",
  language: 'What language do you prefer to chat in? English, Tamil, Hindi, or Tanglish.',
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
    depositAsk: ({ name, amt, days }) =>
      `${name}, here is your 30-day pledge breakdown:\n\n` +
      `• Trial: 14-day free access included\n` +
      `• Refundable Deposit: ₹${amt} stake today\n` +
      `• Platform Fee: ₹25 charged upon completion\n` +
      `• Refund Balance: ₹275 returned upon completing your 30-day pledge\n` +
      `• Buffer: 2 free strike days with zero penalty\n` +
      `• Slip Penalty: ₹50 deducted per missed workout beyond free strikes\n\n` +
      `Ready to lock in?`,
    howItWorks: () =>
      "Daily check-in routine:\n" +
      "1. I message you at your chosen check-in time.\n" +
      "2. You complete your workout and reply with one line of text and a photo showing the daily gesture.\n" +
      "3. Show up consistently, retain your deposit, and build the habit.",
    paymentLink: (url) => `Pay your ₹${config.depositAmountInr} refundable deposit:\n${url}\n\nOnce paid, reply with "paid" to activate Day 1.`,
    notPaidYet: () => `Pay the ₹${config.depositAmountInr} deposit and reply "paid" to start your 30-day pledge.`,
    paidConfirmed: (time, activity) => `Payment confirmed. Your 30-day pledge is now active.\n\nI will message you daily at ${time || '08:00'} for your ${activity || 'workout'} check-in.`,
    dailyPrompt: (activity, gestureText) => `Time to show up. Send your workout update and a photo showing ${getProofInstruction('en', activity, gestureText)}.`,
    needPhoto: (gestureText, activity) => `Please send your photo proof showing ${getProofInstruction('en', activity || 'gym', gestureText)} to complete your check-in.`,
    needGesturePhoto: (gestureText, activity) => `To verify today's session, send a photo showing: ${getProofInstruction('en', activity || 'gym', gestureText)}.`,
    reminder: (gestureText, activity) => `Daily reminder: Please submit your workout proof showing ${getProofInstruction('en', activity || 'gym', gestureText)}.`,
    'gesture_thumbs-up': 'a thumbs-up',
    'gesture_peace-sign': 'holding up 2 fingers (peace sign)',
    'gesture_three-fingers': 'holding up 3 fingers',
    'gesture_fist': 'making a fist',
    'gesture_ok-sign': 'making an OK sign',
    checkinAccepted: (streak, daysLeft) =>
      `Check-in verified. ${streak}-day streak. ${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining.`,
    checkinFailedFinal: (reason) =>
      `Verification failed: ${reason}. Marked as a slip. Focus on showing up tomorrow.`,
    weeklyOnTrack: (streak, daysLeft, payout) =>
      `Weekly summary: ${streak}-day streak. Current refund balance: ₹${payout}. ${daysLeft} days remaining.`,
    weeklySlipped: (missed, payout) =>
      `Weekly summary: ${missed} slip${missed === 1 ? '' : 's'} recorded. Current refund balance: ₹${payout}.`,
    finalComplete: (payout) =>
      `30 days completed. Full pledge fulfilled. Refund balance of ₹${payout} is being processed.`,
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
      `• Platform Fee: ₹25\n` +
      `• Base Refund Balance: ₹275 (pledge mudicha udane)\n` +
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
    'gesture_thumbs-up': 'thumbs-up sign',
    'gesture_peace-sign': '2 fingers (peace sign)',
    'gesture_three-fingers': '3 fingers showing',
    'gesture_fist': 'making a fist',
    'gesture_ok-sign': 'OK sign',
    checkinAccepted: (streak, daysLeft) =>
      `Check-in verified. ${streak}-day streak. Innum ${daysLeft} days to go.`,
    checkinFailedFinal: (reason) =>
      `Verification failed: ${reason}. Marked as a slip. Nalaiku clean start.`,
    weeklyOnTrack: (streak, daysLeft, payout) =>
      `Weekly summary: ${streak}-day streak. Current refund balance: ₹${payout}.`,
    weeklySlipped: (missed, payout) =>
      `Weekly summary: ${missed} slips recorded. Current refund balance: ₹${payout}.`,
    finalComplete: (payout) =>
      `30 days completed. Pledge fulfilled. ₹${payout} refund balance credit aagum.`,
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
      `• பிளாட்ஃபார்ம் கட்டணம்: ₹25\n` +
      `• திரும்பப்பெறும் இருப்பு: ₹275\n` +
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
    'gesture_thumbs-up': 'பெருவிரல் சைகை',
    'gesture_peace-sign': '2 விரல்கள் சைகை',
    'gesture_three-fingers': '3 விரல்கள் சைகை',
    'gesture_fist': 'முஷ்டி சைகை',
    'gesture_ok-sign': 'சரி சைகை',
    checkinAccepted: (streak, daysLeft) =>
      `சரிபார்க்கப்பட்டது. ${streak} நாள் தொடர்ச்சி. இன்னும் ${daysLeft} நாட்கள்.`,
    checkinFailedFinal: (reason) =>
      `சரிபார்ப்பு தோல்வி: ${reason}. தவறாக குறிக்கப்பட்டது.`,
    weeklyOnTrack: (streak, daysLeft, payout) =>
      `வாராந்திர சுருக்கம்: ${streak} நாள் தொடர்ச்சி. இருப்பு: ₹${payout}.`,
    weeklySlipped: (missed, payout) =>
      `வாராந்திர சுருக்கம்: ${missed} தவறுகள். இருப்பு: ₹${payout}.`,
    finalComplete: (payout) =>
      `30 நாட்கள் முடிந்தது. திட்டம் நிறைவடைந்தது. ₹${payout} திரும்ப அனுப்பப்படுகிறது.`,
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
      `• प्लेटफॉर्म फीस: ₹25\n` +
      `• रिफंड बैलेंस: ₹275 (30 दिन पूरे होने पर)\n` +
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
    'gesture_thumbs-up': 'अंगूठा दिखाना',
    'gesture_peace-sign': '2 उंगलियां दिखाना',
    'gesture_three-fingers': '3 उंगलियां दिखाना',
    'gesture_fist': 'मुट्ठी बनाना',
    'gesture_ok-sign': 'ओके का इशारा',
    checkinAccepted: (streak, daysLeft) =>
      `सत्यापित किया गया। ${streak}-दिन की स्ट्रीक। ${daysLeft} दिन बाकी।`,
    checkinFailedFinal: (reason) =>
      `सत्यापन विफल: ${reason}। चूक के रूप में दर्ज।`,
    weeklyOnTrack: (streak, daysLeft, payout) =>
      `साप्ताहिक रिपोर्ट: ${streak}-दिन की स्ट्रीक। रिफंड बैलेंस: ₹${payout}।`,
    weeklySlipped: (missed, payout) =>
      `साप्ताहिक रिपोर्ट: ${missed} चूक दर्ज। रिफंड बैलेंस: ₹${payout}।`,
    finalComplete: (payout) =>
      `30 दिन पूरे हुए। रिफंड बैलेंस ₹${payout} प्रोसेस किया जा रहा है।`,
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
      `• Platform Fee: ₹25\n` +
      `• Refund Balance: ₹275 (30 days complete hone par)\n` +
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
    'gesture_thumbs-up': 'thumbs-up sign',
    'gesture_peace-sign': '2 fingers (peace sign)',
    'gesture_three-fingers': '3 fingers showing',
    'gesture_fist': 'making a fist',
    'gesture_ok-sign': 'OK sign',
    checkinAccepted: (streak, daysLeft) =>
      `Check-in verified. ${streak}-day streak. ${daysLeft} days remaining.`,
    checkinFailedFinal: (reason) =>
      `Verification failed: ${reason}. Slip mark ho gaya. Kal fresh start.`,
    weeklyOnTrack: (streak, daysLeft, payout) =>
      `Weekly summary: ${streak}-day streak. Refund balance: ₹${payout}.`,
    weeklySlipped: (missed, payout) =>
      `Weekly summary: ${missed} slips recorded. Refund balance: ₹${payout}.`,
    finalComplete: (payout) =>
      `30 days completed. Pledge fulfilled. ₹${payout} refund balance process ho raha hai.`,
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
  if (QUESTIONS[key]) return QUESTIONS[key];
  const table = QUESTIONS[lang] || QUESTIONS.en;
  return table[key] || QUESTIONS.en[key] || '';
}

module.exports = {
  t,
  question,
  detectLanguage,
  getProofInstruction,
};
