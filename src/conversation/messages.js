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
  name: "Hey, I'm ShowUp — your AI fitness coach.\nI'll help you train, eat, recover, track progress, and adjust your plan as you improve.\n\nWhat should I call you?",
  goal: "What are you primarily trying to achieve right now?\n\n• Build muscle\n• Lose fat\n• Get stronger\n• Improve fitness / endurance\n• Something else",
  experience: "How would you describe your current training experience?\n\n• Beginner\n• Some experience\n• Experienced",
  current_training: "What does your current training look like right now? (e.g. Gym lifting, home workouts, outdoor running, cycling, brisk walking, or starting fresh?)",
  baseline_metrics: "What is your height and current weight? (e.g. 175 cm, 70 kg)",
  schedule_days: "How many days can you realistically train each week?",
  schedule_time: "When do you usually train or prefer to do your workouts? (e.g. 7:00 AM, 7:00 PM)",
  diet_routine: "What does a normal day of eating look like for you? (Breakfast, lunch, dinner, snacks)",
  diet_restrictions: "Any foods you avoid, allergies, dietary restrictions, or meals you absolutely don't want to change?",
  obstacles: "What usually gets in the way of your training consistency?\n\n• Time\n• Motivation\n• Consistency / Routine\n• Diet\n• Recovery / Fatigue\n• Nothing major / Something else",
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
      `ShowUp can also put something at stake.\n\n` +
      `You choose an accountability deposit. If you complete your commitments, you get the eligible amount back. If you miss commitments under the rules you agreed to, part of the stake is forfeited.\n\n` +
      `The goal isn't to make money from you.\n` +
      `It's to make skipping harder than showing up.\n\n` +
      `Your accountability setup:\n` +
      `• Deposit: ₹${config.depositAmountInr} refundable stake\n` +
      `• Commitment period: 30 days\n` +
      `• Free misses: 2 buffer days (zero penalty)\n` +
      `• Miss after free misses: ₹${config.slipPenaltyInr} per missed day\n` +
      `• Platform fee: ₹${config.platformFeeInr} (upon completion)\n` +
      `• Refund balance: ₹${config.fullPayoutInr} eligible for return upon completing your 30-day pledge\n` +
      `• Verification: Daily photo + gesture proof\n` +
      `• Exceptions: Documented illness/injury excused\n\n` +
      `---\n` +
      `Choose your mode:\n\n` +
      `1. Accountability Mode (Recommended)\n` +
      `Personalized coaching + financial commitment stake (₹${config.depositAmountInr} refundable deposit).\n\n` +
      `2. Coach Mode (No-stake Mode)\n` +
      `Full personalized coaching, workout tracking, and daily reminders without money at stake.\n\n` +
      `Reply "1" for Accountability Mode or "2" for Coach Mode.`,
    depositAsk: ({ name, amt }) =>
      `Your accountability setup:\n\n` +
      `• ₹${amt || config.depositAmountInr} deposit\n` +
      `• ₹${config.fullPayoutInr} eligible for return\n` +
      `• ₹${config.platformFeeInr} platform fee\n` +
      `• 2 free misses\n` +
      `• ₹${config.slipPenaltyInr} per additional qualifying miss\n\n` +
      `Everything above is governed by the transparent rules agreed before payment.\n\n` +
      `Deposit ₹${amt || config.depositAmountInr} to activate accountability:`,
    howItWorks: () =>
      "Daily check-in routine:\n" +
      "1. I message you before your chosen workout time with today's target.\n" +
      "2. You complete your workout and reply with one line of text and a photo showing the daily gesture.\n" +
      "3. Show up consistently, retain your deposit, and build unstoppable consistency.",
    paymentLink: (url) => `Deposit link:\n${url}\n\nOnce deposited, reply with "paid" to activate Day 1.`,
    notPaidYet: () => `Deposit ₹${config.depositAmountInr} and reply "paid" to activate Day 1, or reply "2" to switch to free Coach Mode.`,
    coachModeConfirmed: (time, activity) => `Coach Mode activated! Zero money at stake — purely focused on building your fitness habit.\n\nI will message you daily before ${time || '08:00'} for your ${activity || 'workout'} session.`,
    paidConfirmed: (time, activity) => `Accountability deposit confirmed. Your 30-day pledge is officially active.\n\nI will message you daily before ${time || '08:00'} for your ${activity || 'workout'} check-in.`,
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
};
