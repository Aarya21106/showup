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
  if (activity === 'running' || activity === 'walking') return `${gestureText} (or showing your tracking app/shoes)`;
  if (activity === 'cycling') return `${gestureText} next to your bicycle or showing your tracking app`;
  return `${gestureText}`;
}

const QUESTIONS = {
  name: "Hey! I'm ShowUp — think of me as the buddy who makes sure you actually follow through this time. What should I call you?",
  language: 'What language do you want to chat in? English, Tamil, Hindi, or Tanglish — your call.',
  en: {
    activity: "Alright, let's get into it. What's your thing — gym, running, yoga, home workouts, some sport, walking, swimming, whatever it is. What are we working with?",
    days: 'Be real with me, not ambitious — how many days a week can you actually commit to showing up?',
    time: 'What time of day does this actually happen, or when do you want it to happen?',
    blocker: "Now the real question. What's stopped you before? Not the polished answer — bad mornings, zero motivation, boredom, life getting in the way, whatever it actually is.",
    vision: 'Now flip it. Picture 30 days from now — you showed up every single time, no excuses. What does that actually do for you?',
    commitment: 'Last one, and be honest — on a scale of 1 to 10, how bad do you want this, right now?',
    allergy: "Do you have any food allergies? (e.g. peanuts, dairy, gluten, or type 'none')",
  },
  tl: {
    activity: 'Okay, start pannalam. Ungalukku enna workout system pidikkum — gym, running, walking, or cycling?',
    days: 'Sariya sollunga, romba build-up illama — varathuku ethana naal ungalala confirm-ah commit panna mudiyum?',
    time: 'Day-la endha time-ku neenga workout panna poreenga? (e.g. 7am or 6:30pm)',
    blocker: 'Ippo real-ana kelvi. Mudhala ungalala consistent-ah irukka mudiyama pona real reason enna — somberithanam, schedule problem, or simple lazy-ah?',
    vision: 'Ippo nalla yosinga. 30 days continuous-ah show up panna, unga life-la enna change nadakkum? Neenga epdi feel pannuveenga?',
    commitment: 'Last check, honest-ah sollunga — scale 1 to 10-la, ippo unga commitment level enna?',
    allergy: "Ungaluku edhavadhu food allergy iruka? (e.g. peanuts, dairy, or 'none' nu type pannunga)",
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
  if (a.includes('tanglish') || a.includes('tanlish')) return 'tl';
  if (a.includes('hinglish') || a.includes('hinlish')) return 'hl';
  if (a.includes('tamil') || a.includes('தமிழ்')) return 'ta';
  if (a.includes('hindi') || a.includes('हिंदी') || a.includes('हिन्दी')) return 'hi';
  return 'en';
}

const T = {
  en: {
    depositAsk: ({ name, amt, refund, penalty, days, blocker, vision, score }) =>
      `${name}, real talk — you told me "${blocker}" is what's gotten you before. And you told me if you actually pulled this off, ${vision}. That gap right there? That's exactly what this closes.\n\n` +
      `Here's how the deposit, pricing & free trial work (100% transparent):\n` +
      `🎁 First 14 days: FREE ACCESS! You only pay a refundable deposit of ₹${amt} today to lock in.\n` +
      `⚙️ Terms: A small ₹25 platform fee is charged, leaving a base refund balance of ₹275.\n` +
      `🛡️ 2 Free Strikes: If your schedule has >10 workout days this month, you get 2 FREE STRIKES (miss 2 days with ZERO penalty!).\n` +
      `⚠️ Slip Penalty: Beyond free strikes, each missed workout deducts ₹${penalty} from your deposit.\n` +
      `🔥 Weekly Streak Discounts (Month 2 onward):\n` +
      `   - Standard plan: Base ₹119/month → Earn ₹10 off per clean week (up to ₹40 off = ₹79/month!).\n` +
      `   - Pro plan: Base ₹239/month → Earn ₹10 off per clean week (up to ₹40 off = ₹199/month!).\n\n` +
      `No subscription charged during your 14-day trial. You just told me you're a ${score}/10 on wanting this. Ready to lock in?`,
    howItWorks: () =>
      "Here's the day-to-day: I text you at your check-in time every day. You reply with a line of text + a photo showing the daily gesture. I verify your photo with AI against your workout and history. Show up consistently, keep your deposit, and unlock up to ₹40 off your monthly subscription!",
    paymentLink: (url) => `Ready? Pay your ₹${config.depositAmountInr} deposit here: ${url}\n\nOnce it's done, just text me "paid" and Day 1 starts. Let me know when you've paid!`,
    notPaidYet: () => `No stress — whenever you're ready. Pay the ₹${config.depositAmountInr} deposit, text me "paid", and we start the clock on the 14-day free trial & 30-day pledge.`,
    paidConfirmed: (time, activity) => `Payment confirmed! 🎉 You're locked in! Your 14-day free trial is active. I'll message you daily around ${time || '08:00'} for your ${activity || 'gym'} sessions.\n\nNow, let's lock in your weekly schedule — what is your main fitness goal (e.g. Gain Muscle, Lose Weight, Cardio, General Fitness) and what workout split do you plan for each day?`,
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
      `Week check-in: ${streak}-day streak and still going. ${daysLeft} more day${daysLeft === 1 ? '' : 's'} in your pledge. Current refund balance: ₹${payout}. You've also earned a ₹10 weekly discount for next month!`,
    weeklySlipped: (missed, payout) =>
      `Week check-in: ${missed} slip${missed === 1 ? '' : 's'} so far. Current refund balance: ₹${payout}. Plenty of time to turn this around — today's a good day to start.`,
    finalComplete: (payout) =>
      `That's ${config.pledgeDays}/${config.pledgeDays} — every single day, no excuses! ₹${payout} coming back to you (after ₹25 platform fee). You also unlocked the MAX ₹40 discount for Month 2 (Standard: ₹79/mo, Pro: ₹199/mo)! Proud of you.`,
    finalPartial: (days, payout) =>
      `${config.pledgeDays} days done, ${days} of them counted. ₹${payout} coming back to you. You showed up and stayed consistent!`,
    missedYesterday: () => "No check-in came in yesterday — marking it as a slip and moving on. No lecture, just: today's a clean slate.",
    waitForPrompt: () => "You're all set — I'll text you at your check-in time each day. Nothing to do right now.",
  },
  tl: {
    depositAsk: ({ name, amt, refund, penalty, days, blocker, vision, score }) =>
      `${name}, real-ah sollanum-na — neenga "${blocker}" dhaan consistent-ah irukka mudiyama ponadhuku reason-nu sonneenga. Idha complete panna ${vision}-nu sonneenga. Adhudhaan andha gap... idhu adhukaana solution!\n\n` +
      `Pana vishyam, deposit & offer details clear-ah solren, 100% transparent:\n` +
      `🎁 First 14 days: FREE ACCESS! Iniku ₹${amt} refundable deposit mattum pay panni lock pannunga.\n` +
      `⚙️ Terms: ₹25 platform fee போக remaining ₹275 unga base refund balance-ah irukkum.\n` +
      `🛡️ 2 Free Strikes: Unga monthly plan-la 10 workout days-ku mela irundha, 2 DAYS MISS PANNALUM PENALTY ILLA (2 Free Strikes!).\n` +
      `⚠️ Slip Penalty: Free strikes தாண்டி miss panra ovvoru nalaikkum ₹${penalty} deposit-la irundhu deduction aagum.\n` +
      `🔥 Weekly Streak Discounts (2nd Month-la irundhu):\n` +
      `   - Standard plan: Base ₹119/month → Ovvoru clean week-kum ₹10 discount (Max ₹40 off = ₹79/month!).\n` +
      `   - Pro plan: Base ₹239/month → Ovvoru clean week-kum ₹10 discount (Max ₹40 off = ₹199/month!).\n\n` +
      `14-day trial-la subscription bill aagadhu. Neenga scale-la ${score}/10 commit-nu sollirkeenga. Ready-ah?`,
    howItWorks: () =>
      "Daily schedule: Unga selective time-la daily message pannuven. Enna paneenga-nu oru line + photo proof (today's gesture kaatti) anupunga. AI photo-va pathu direct-ah verify pannum. Correct-ah show up panna unga deposit balance return kedaikkum + monthly plan-la ₹40 varai discount-um adikalaam!",
    paymentLink: (url) => `Ready-ah? Pay ₹${config.depositAmountInr} deposit here: ${url}\n\nPay panni mudichuttu "paid" nu message pannunga. Day 1 start pannalaam!`,
    notPaidYet: () => `No stress — whenever you're ready. Pay the ₹${config.depositAmountInr} deposit, text me "paid", and we start the clock on the 14-day free trial & 30-day pledge.`,
    paidConfirmed: (time, activity) => `Payment confirmed! 🎉 Neenga locked-in-ah irukeenga bro! Ungaloda 14-day free trial active aayiduchu. Neenga sonna ${time || '08:00'}-ku daily ${activity || 'gym'}-kaaga remind pannuven.\n\nIppo ungaloda main fitness goal enna (e.g. Gain Muscle, Lose Weight, Cardio, General Fitness) matrum weekly workout splits sollunga bro?`,
    dailyPrompt: (activity, gestureText) => `Time to show up! Iniku ${activity}-ku enna plan? Workout complete pannitu oru line update + ${getProofInstruction('tl', activity, gestureText)} proof-a send pannunga. You can do it!`,
    needPhoto: (gestureText, activity) => `Update super — verify panna ${getProofInstruction('tl', activity || 'gym', gestureText)} irukra photo proof anupunga.`,
    needGesturePhoto: (gestureText, activity) => `Today's session verify panna, please ${getProofInstruction('tl', activity || 'gym', gestureText)} irukra photo anupunga.`,
    reminder: (gestureText, activity) => `hi buddy, edhavadhu marandhuteengala? 😅 Kavalai pada dhedhavadhilla, verify panna andha photo proof anupunga! ${getProofInstruction('tl', activity || 'gym', gestureText)} kaatunga.`,
    'gesture_thumbs-up': 'thumbs-up sign',
    'gesture_peace-sign': '2 fingers (peace sign)',
    'gesture_three-fingers': '3 fingers showing',
    'gesture_fist': 'making a fist',
    'gesture_ok-sign': 'OK sign (index and thumb forming circle)',
    checkinAccepted: (streak, daysLeft) =>
      `Logged and verified! \u{1F525} ${streak}-day streak. Innum ${daysLeft} days to go — keep pushing!`,
    checkinFailedFinal: (reason) =>
      `Check-in match aagala — ${reason} Idhu slip-ah mark panren. Tomorrow is a new day, show up!`,
    weeklyOnTrack: (streak, daysLeft, payout) =>
      `Weekly update: ${streak}-day streak! Refund balance: ₹${payout}. Indha week clean-ah mudichadhukaaga ₹10 discount earn pannirkeenga!`,
    weeklySlipped: (missed, payout) =>
      `Weekly update: total ${missed} slips aairku. Current refund balance: ₹${payout}. Next days correct-ah target lock pannunga.`,
    finalComplete: (payout) =>
      `${config.pledgeDays}/${config.pledgeDays} days complete! Super, ₹${payout} refund balance ungaluku credit aairum (after ₹25 platform fee). Max ₹40 discount-um unlock panniteenga (Standard: ₹79/mo, Pro: ₹199/mo)! Proud of you!`,
    finalPartial: (days, payout) =>
      `${config.pledgeDays} days-la ${days} days counted. ₹${payout} return balance kedaikkum. Great effort showing up!`,
    missedYesterday: () => "Nethu check-in varala — andha day-a slip-ah mark pannittu proceed panren. Heavy lecture illa, iniku new day target.",
    waitForPrompt: () => "Neenga all set — everyday unga check-in time-la remind panren. Ippo verum wait pannunga.",
  },
  ta: {
    depositAsk: ({ name, amt, refund, penalty, days, blocker, vision, score }) =>
      `${name}, நேர்மையாக சொல்கிறேன் — முன்பு உங்களைத் தடுத்தது "${blocker}" என்று சொன்னீர்கள். இதை முடித்தால் ${vision} என்றும் சொன்னீர்கள். அந்த இடைவெளிதான் — இதுதான் அதை மூடப் போகிறது.\n\n` +
      `கட்டணம், டெபாசிட் மற்றும் சலுகை விவரங்கள் (100% வெளிப்படை):\n` +
      `🎁 முதல் 14 நாட்கள்: இலவச அனுமதி! இன்று ₹${amt} திரும்பப்பெறக்கூடிய டெபாசிட் மட்டும் செலுத்துங்கள்.\n` +
      `⚙️ விதிமுறைகள்: ₹25 பிளாட்ஃபார்ம் கட்டணம் போக மீதமுள்ள ₹275 உங்களின் திரும்பப்பெறும் கணக்கில் இருக்கும்.\n` +
      `🛡️ 2 இலவச ஸ்ட்ரைக்குகள்: மாதத்தில் 10 நாட்களுக்கு மேல் உடற்பயிற்சி இருந்தால், 2 நாட்கள் தவறினாலும் அபராதம் இல்லை!\n` +
      `⚠️ அபராதம்: இலவச ஸ்ட்ரைக்குகளுக்கு மேல் தவறவிடும் ஒவ்வொரு நாளுக்கும் ₹${penalty} கழிக்கப்படும்.\n` +
      `🔥 வாராந்திர தள்ளுபடி (2வது மாதம் முதல்):\n` +
      `   - ஸ்டாண்டர்ட் திட்டம்: ₹119/மாதம் → வாரத்திற்கு ₹10 தள்ளுபடி (அதிகபட்சம் ₹40 தள்ளுபடி = ₹79/மாதம்!).\n` +
      `   - புரோ திட்டம்: ₹239/மாதம் → வாரத்திற்கு ₹10 தள்ளுபடி (அதிகபட்சம் ₹40 தள்ளுபடி = ₹199/மாதம்!).\n\n` +
      `14 நாட்கள் இலவச அனுமதியில் சந்தா கட்டணம் இல்லை. நீங்கள் ${score}/10 உறுதி அளித்துள்ளீர்கள். தயாரா?`,
    howItWorks: () =>
      'தினசரி முறை: உங்கள் நேரத்தில் தினமும் மெசேஜ் அனுப்புவேன். நீங்கள் செய்ததை ஒரு வரியாகவும், அன்றைய சைகையுடன் (gesture) ஒரு புகைப்படமாகவும் அனுப்பவும். AI அதை சரிபார்க்கும். டெபாசிட் திரும்புவதோடு மாதாந்திர திட்டத்தில் ₹40 வரை தள்ளுபடியும் பெறலாம்!',
    paymentLink: (url) => `தயாரா? உங்கள் ₹${config.depositAmountInr} டெபாசிட்டை இங்கே செலுத்துங்கள்: ${url}\n\nமுடிந்ததும், "paid" என்று எனக்கு அனுப்புங்கள், நாள் 1 தொடங்கும்.`,
    notPaidYet: () => `பரவாயில்லை — நீங்கள் தயாரானதும். ₹${config.depositAmountInr} செலுத்தி "paid" என்று சொல்லுங்கள், 14 நாட்கள் இலவச அனுமதி & 30 நாட்களின் கடிகாரம் தொடங்கும்.`,
    paidConfirmed: (time, activity) => `கட்டணம் உறுதிசெய்யப்பட்டது! 🎉 நீங்கள் லாக்-இன் செய்யப்பட்டு விட்டீர்கள்! உங்கள் 14-நாள் இலவச சோதனை தீவிரமாக உள்ளது. நீங்கள் கூறிய ${time || '08:00'} மணிக்கு ${activity || 'gym'}-க்காக தினமும் நினைவூட்டுவேன்.\n\nஇப்போது உங்கள் முதன்மை உடற்பயிற்சி இலக்கு என்ன (எ.கா. தசை வளர்ச்சி, எடைக் குறைப்பு, கார்டியோ) மற்றும் வாராந்திர அட்டவணையை கூறவும்?`,
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
      `இது சரிபடவில்லை — ${reason} இது ஒரு தவறாக குறிக்கப்பட்டது. நாளை புதிய நாள், தொடருங்கள்.`,
    weeklyOnTrack: (streak, daysLeft, payout) =>
      `வார சரிபார்ப்பு: ${streak} நாள் தொடர்ச்சி! மீதமுள்ள திரும்பப்பெறும் தொகை: ₹${payout}. இந்த வாரம் ₹10 தள்ளுபடி பெற்றுள்ளீர்கள்!`,
    weeklySlipped: (missed, payout) =>
      `வார சரிபார்ப்பு: இதுவரை ${missed} தவறுகள். மீதமுள்ள திரும்பப்பெறும் தொகை: ₹${payout}. இன்றே திருத்த ஆரம்பியுங்கள்.`,
    finalComplete: (payout) =>
      `அது ${config.pledgeDays}/${config.pledgeDays} — சாக்குப்போக்கு இல்லாமல்! ₹${payout} உங்களுக்குத் திரும்பும் (₹25 கட்டணம் போக). ₹40 அதிகபட்ச தள்ளுபடியையும் பெற்றுள்ளீர்கள் (Standard: ₹79/மாதம், Pro: ₹199/மாதம்)!`,
    finalPartial: (days, payout) =>
      `${config.pledgeDays} நாட்கள் முடிந்தன, ${days} நாட்கள் எண்ணப்பட்டன. ₹${payout} உங்களுக்குத் திரும்பும்.`,
    missedYesterday: () => 'நேற்று செக்-இன் வரவில்லை — ஒரு தவறாக குறித்து தொடர்கிறோம். இன்று புதிய தொடக்கம்.',
    waitForPrompt: () => 'நீங்கள் தயார் — ஒவ்வொரு நாளும் உங்கள் நேரத்தில் மெசேஜ் அனுப்புவேன். இப்போது எதுவும் செய்ய வேண்டாம்.',
  },
  hi: {
    depositAsk: ({ name, amt, refund, penalty, days, blocker, vision, score }) =>
      `${name}, सच कहूं — आपने बताया कि "${blocker}" ने पहले आपको रोका था। और आपने कहा कि अगर आपने यह कर दिखाया, तो ${vision}। वही गैप है — इसे यही भरने वाला है।\n\n` +
      `फीस, डिपॉजिट और ऑफर का पूरा हिसाब (100% पारदर्शी):\n` +
      `🎁 पहले 14 दिन: बिल्कुल मुफ्त एक्सेस! आज बस ₹${amt} का रिफंडेबल डिपॉजिट जमा करें।\n` +
      `⚙️ नियम: ₹25 प्लेटफॉर्म फीस के बाद ₹275 आपका बेस रिफंड बैलेंस रहेगा।\n` +
      `🛡️ 2 फ्री स्ट्राइक: अगर महीने में 10 से ज़्यादा वर्कआउट दिन हैं, तो 2 दिन मिस होने पर 0 पेनल्टी!\n` +
      `⚠️ पेनल्टी: फ्री स्ट्राइक के बाद हर मिस हुए दिन पर ₹${penalty} डिपॉजिट से कटेंगे।\n` +
      `🔥 वीकली स्ट्रीक डिस्काउंट (दूसरे महीने से):\n` +
      `   - स्टैंडर्ड प्लान: ₹119/महीना → हर क्लीन हफ्ते पर ₹10 की छूट (अधिकतम ₹40 छूट = ₹79/महीना!)।\n` +
      `   - प्रो प्लान: ₹239/महीना → हर क्लीन हफ्ते पर ₹10 की छूट (अधिकतम ₹40 छूट = ₹199/महीना!)।\n\n` +
      `14 दिन के ट्रायल में कोई सब्सक्रिप्शन नहीं कटेगा। आपने बताया कि आप ${score}/10 पर हैं। तैयार हैं?`,
    howItWorks: () =>
      'रोज़ का हिसाब: मैं आपके समय पर रोज़ मैसेज करूंगा। आप जवाब में एक लाइन + फोटो (आज के इशारे/gesture के साथ) भेजें। AI फोटो देखकर पक्का करेगा। डिपॉजिट वापस मिलेगा और अगले महीने के प्लान पर ₹40 तक की छूट मिलेगी!',
    paymentLink: (url) => `तैयार हैं? अपना ₹${config.depositAmountInr} डिपॉजिट यहां जमा करें: ${url}\n\nहो जाए तो बस "paid" लिखकर भेजें, दिन 1 शुरू!`,
    notPaidYet: () => `कोई जल्दी नहीं — जब तैयार हों। ₹${config.depositAmountInr} डिपॉजिट जमा करें, "paid" लिखें, और 14 दिन के फ्री ट्रायल की घड़ी शुरू करें।`,
    paidConfirmed: (time, activity) => `भुगतान की पुष्टि हो गई! 🎉 आप लॉक-इन हो चुके हैं! आपका 14-दिन का मुफ़्त ट्रायल एक्टिव हो चुका है। आपके बताए गए ${time || '08:00'} समय पर मैं ${activity || 'gym'} के लिए याद दिलाऊंगा।\n\nअब आपका मुख्य फ़िटनेस लक्ष्य क्या है (जैसे मसल गेन, वज़न घटाना, कार्डियो) और हफ्ते का वर्कआउट स्प्लिट बताइए?`,
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
      `यह ठीक नहीं बैठा — ${reason} इसे चूक के रूप में दर्ज किया गया। कल एक साफ दिन है, फिर आइए।`,
    weeklyOnTrack: (streak, daysLeft, payout) =>
      `साप्ताहिक अपडेट: ${streak}-दिन की स्ट्रीक! रिफंड बैलेंस: ₹${payout}। इस हफ्ते आपने ₹10 की छूट हासिल कर ली है!`,
    weeklySlipped: (missed, payout) =>
      `साप्ताहिक अपडेट: अब तक ${missed} चूक। रिफंड बैलेंस: ₹${payout}। आज से सुधारना शुरू करें।`,
    finalComplete: (payout) =>
      `${config.pledgeDays}/${config.pledgeDays} — हर दिन, कोई बहाना नहीं! ₹${payout} आपको वापस मिल रहा है (₹25 फीस के बाद)। आपने अधिकतम ₹40 छूट भी पा ली है (Standard: ₹79/महीना, Pro: ₹199/महीना)!`,
    finalPartial: (days, payout) =>
      `${config.pledgeDays} दिन पूरे हुए, ${days} दिन गिने गए। ₹${payout} आपको वापस मिल रहा है।`,
    missedYesterday: () => 'कल कोई चेक-इन नहीं आया — इसे चूक के तौर पर दर्ज कर आगे बढ़ रहे हैं। आज एक साफ शुरुआत है।',
    waitForPrompt: () => 'आप तैयार हैं — मैं रोज़ आपके समय पर मैसेज करूंगा। अभी कुछ करने की ज़रूरत नहीं।',
  },
  hl: {
    depositAsk: ({ name, amt, refund, penalty, days, blocker, vision, score }) =>
      `${name}, sach bolun toh — aapne bataya ki "${blocker}" ki wajah se aap pehle continue nahi kar paaye. Aur agar aapne yeh kar dikhaya toh ${vision}. Bas wahi gap yeh system close karega!\n\n` +
      `Pricing, deposit aur free trial ka pura हिसाब clear hai, 100% transparent:\n` +
      `🎁 Pehle 14 days: FREE ACCESS! Aaj bas ₹${amt} ka refundable deposit pay karke lock karo.\n` +
      `⚙️ Terms: ₹25 platform fee ke baad ₹275 aapka base refund balance rahega.\n` +
      `🛡️ 2 Free Strikes: Agar aapke monthly plan me >10 workout days hain, toh 2 days miss hone par ZERO penalty (2 Free Strikes!).\n` +
      `⚠️ Slip Penalty: Free strikes ke baad har missed workout par ₹${penalty} deposit se cut honge.\n` +
      `🔥 Weekly Streak Discounts (Month 2 se):\n` +
      `   - Standard plan: Base ₹119/month → Har clean week par ₹10 discount (Max ₹40 off = ₹79/month!).\n` +
      `   - Pro plan: Base ₹239/month → Har clean week par ₹10 discount (Max ₹40 off = ₹199/month!).\n\n` +
      `14-day trial me koi extra charges nahi hain. Aapne commit score ${score}/10 bataya tha. Ready ho?`,
    howItWorks: () =>
      "Daily schedule: Main aapke daily check-in time par message karunga. Aapko 1 line update + todays gesture waali photo bhejni hai. AI photo verify karega. Consistent rehne par deposit return milega aur monthly plan par ₹40 tak discount bhi milega!",
    paymentLink: (url) => `Ready? Apna ₹${config.depositAmountInr} deposit yahan pay karo: ${url}\n\nPay karke "paid" text kar do. Day 1 start karte hain!`,
    notPaidYet: () => `Koi stress nahi — jab ready ho. ₹${config.depositAmountInr} deposit pay karke "paid" likho, 14-day free trial & 30-day pledge start ho jayega.`,
    paidConfirmed: (time, activity) => `Payment confirmed! 🎉 Aap locked-in ho bro! Aapka 14-day free trial active ho gaya hai. Aapke bataye ${time || '08:00'} time par main daily ${activity || 'gym'} ke liye remind karunga.\n\nAb aapka main fitness goal (e.g. Gain Muscle, Lose Weight, Cardio, General Fitness) aur weekly workout split bataiye bro?`,
    dailyPrompt: (activity, gestureText) => `Time to show up! Aaj ${activity} ke liye kya plan hai? Workout complete karke 1 line update + ${getProofInstruction('hl', activity, gestureText)} ki photo bhejo!`,
    needPhoto: (gestureText, activity) => `Update badhiya hai — ab verify karne ke liye ${getProofInstruction('hl', activity || 'gym', gestureText)} waali photo bhi bhej do.`,
    needGesturePhoto: (gestureText, activity) => `Aaj ka session verify karne ke liye, please ${getProofInstruction('hl', activity || 'gym', gestureText)} waali photo bhejo.`,
    reminder: (gestureText, activity) => `Arey bhai, kuch bhool toh nahi rahe? 😅 Bas photo proof chahiye! ${getProofInstruction('hl', activity || 'gym', gestureText)} dikha kar photo bhej do.`,
    'gesture_thumbs-up': 'thumbs-up sign',
    'gesture_peace-sign': '2 fingers (peace sign)',
    'gesture_three-fingers': '3 fingers showing',
    'gesture_fist': 'fist showing',
    'gesture_ok-sign': 'OK sign',
    checkinAccepted: (streak, daysLeft) =>
      `Logged and verified! \u{1F525} ${streak}-day streak. Abhi ${daysLeft} days baaki hain — keep going!`,
    checkinFailedFinal: (reason) =>
      `Check-in match nahi hua — ${reason} Yeh ek slip mark ho raha hai. Kal naya din hai, show up!`,
    weeklyOnTrack: (streak, daysLeft, payout) =>
      `Weekly update: ${streak}-day streak! Refund balance: ₹${payout}. Is week clean rehne ke liye ₹10 discount earn kar liya hai!`,
    weeklySlipped: (missed, payout) =>
      `Weekly update: total ${missed} slips hue hain. Refund balance: ₹${payout}. Aaj se wapas target lock karo!`,
    finalComplete: (payout) =>
      `${config.pledgeDays}/${config.pledgeDays} days complete! Super, ₹${payout} refund balance credit ho jayega (after ₹25 platform fee). Max ₹40 discount bhi unlock ho gaya (Standard: ₹79/mo, Pro: ₹199/mo)! Proud of you!`,
    finalPartial: (days, payout) =>
      `${config.pledgeDays} days me se ${days} days counted. ₹${payout} return balance milega. Great effort!`,
    missedYesterday: () => "Kal check-in nahi आया — slip mark kar rahe hain. Koi lecture nahi, aaj naya din hai.",
    waitForPrompt: () => "Aap all set ho — daily aapke time par remind karunga. Abhi bas wait karo.",
  },
};

function t(language, key, ...args) {
  const lang = T[language] ? language : 'en';
  const fn = T[lang][key] || T.en[key];
  return typeof fn === 'function' ? fn(...args) : fn;
}

function fallbackAck(language) {
  if (language === 'tl') return 'Sure!';
  if (language === 'hl') return 'Ha bhai!';
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
