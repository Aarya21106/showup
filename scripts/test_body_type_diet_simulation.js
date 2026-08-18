const db = require('../src/db/db');
const router = require('../src/conversation/router');
const gemini = require('../src/services/gemini');
const fitness = require('../src/utils/fitness');
const config = require('../src/config');

// Intercept messaging
const messaging = require('../src/services/messaging');
let capturedMessages = [];
messaging.sendText = async (phone, text) => {
  capturedMessages.push({ phone, text });
  return { sid: 'sim_' + Date.now() };
};

function printDivider(title) {
  console.log('\n' + '='.repeat(70));
  console.log(`  ${title}`);
  console.log('='.repeat(70));
}

function popLastMessage() {
  if (capturedMessages.length === 0) return '(no message sent)';
  const last = capturedMessages[capturedMessages.length - 1];
  return last.text;
}

const BODY_TYPE_PROFILES = [
  {
    idSuffix: '1',
    archetype: 'ECTOMORPH (Hardgainer / Fast Metabolism / Hypertrophy Bulk)',
    name: 'Arjun',
    phone: 'whatsapp:+919111111111',
    height: 182,
    weight: 64,
    goal: 'muscle_gain',
    days_per_week: 5,
    cuisine: 'South Indian / Non-Veg',
    diet_summary: '3 light meals a day, struggles to eat enough calories',
    diet_restrictions: 'None (eats chicken, eggs, fish, rice, oats)',
    allergy: 'none',
    activity: 'gym',
    expectedCalorieDirection: 'Caloric Surplus (~2600-2800 kcal)',
  },
  {
    idSuffix: '2',
    archetype: 'ENDOMORPH (Heavier Build / Slower Metabolism / Fat Loss Cut)',
    name: 'Rajesh',
    phone: 'whatsapp:+919222222222',
    height: 172,
    weight: 88,
    goal: 'fat_loss',
    days_per_week: 4,
    cuisine: 'North Indian / Vegetarian',
    diet_summary: 'Roti, sabzi, dal, curd. High carb tendency.',
    diet_restrictions: 'Pure Vegetarian (No meat/eggs. Paneer, soya chunks, whey, dal allowed)',
    allergy: 'none',
    activity: 'gym',
    expectedCalorieDirection: 'Caloric Deficit (~1800-1950 kcal)',
  },
  {
    idSuffix: '3',
    archetype: 'MESOMORPH (Athletic Build / Body Recomposition & Strength)',
    name: 'Vikram',
    phone: 'whatsapp:+919333333333',
    height: 178,
    weight: 76,
    goal: 'strength',
    days_per_week: 4,
    cuisine: 'South Indian / High Protein',
    diet_summary: 'Regular gym diet, chicken, rice, eggs',
    diet_restrictions: 'Lactose Intolerant / Dairy-Free (No milk, no whey concentrate, no paneer)',
    allergy: 'dairy',
    activity: 'gym',
    expectedCalorieDirection: 'Maintenance / Recomp (~2300-2450 kcal)',
  },
  {
    idSuffix: '4',
    archetype: 'SKINNY-FAT / SEDENTARY (Normal Weight, Low Muscle / Tone & Lean Recomp)',
    name: 'Sneha',
    phone: 'whatsapp:+919444444444',
    height: 162,
    weight: 58,
    goal: 'recomp',
    days_per_week: 3,
    cuisine: 'Indian / Eggitarian',
    diet_summary: 'Light breakfast, office cafeteria lunch, home dinner',
    diet_restrictions: 'Eggitarian (Eggs + Dairy + Plant-based, no meat/fish)',
    allergy: 'none',
    activity: 'gym',
    expectedCalorieDirection: 'Clean Recomposition (~1650-1750 kcal)',
  },
];

async function simulateBodyTypeDiets() {
  printDivider('SIMULATING 4 ARCHETYPAL BODY TYPES & DIET POPULATION IN USERS TABLE');

  const dbInstance = db.db;
  dbInstance.pragma('foreign_keys = OFF');

  for (const profile of BODY_TYPE_PROFILES) {
    printDivider(`BODY TYPE: ${profile.archetype}`);

    // 1. Cleanup old test user
    const existing = db.getUserByPhone(profile.phone);
    if (existing) {
      dbInstance.prepare('DELETE FROM checkins WHERE user_id = ?').run(existing.id);
      dbInstance.prepare('DELETE FROM workout_logs WHERE user_id = ?').run(existing.id);
      dbInstance.prepare('DELETE FROM chat_messages WHERE user_id = ?').run(existing.id);
      dbInstance.prepare('DELETE FROM users WHERE id = ?').run(existing.id);
    }

    // 2. Compute TDEE, Calorie Goal, Macros, and BMI
    const bmiInfo = fitness.calculateBMI(profile.height, profile.weight);
    const targetCalories = fitness.calculateTargetCalories(
      profile.height,
      profile.weight,
      profile.days_per_week,
      profile.goal === 'fat_loss' ? 'weight_loss' : (profile.goal === 'muscle_gain' ? 'muscle_gain' : 'general')
    );
    const macros = fitness.calculateMacros(targetCalories, profile.weight);

    // 3. Create User in SQLite users table
    let { user } = db.getOrCreateUser(profile.phone);
    db.updateUser(user.id, {
      name: profile.name,
      language: 'en',
      activity: profile.activity,
      days_per_week: profile.days_per_week,
      checkin_time: '08:00',
      state: 'ACTIVE',
      deposit_status: 'paid',
      tier: 'pro_350',
      height: profile.height,
      weight: profile.weight,
      goal: profile.goal,
      target_calories: targetCalories,
      cuisine_region: profile.cuisine,
      diet_summary: profile.diet_summary,
      diet_restrictions: profile.diet_restrictions,
      allergy: profile.allergy,
      timetable: JSON.stringify({
        Monday: 'Workout Day 1',
        Tuesday: 'Workout Day 2',
        Wednesday: 'Rest',
        Thursday: 'Workout Day 3',
        Friday: 'Workout Day 4',
        Saturday: 'Rest',
        Sunday: 'Rest',
      }),
      profile_json: JSON.stringify({
        body_type: profile.archetype,
        bmi: bmiInfo.bmi,
        bmi_category: bmiInfo.category,
        calorie_target: targetCalories,
        macros: {
          protein_g: macros.proteinGrams,
          carbs_g: macros.carbsGrams,
          fats_g: macros.fatGrams,
        },
        diet_strategy: profile.expectedCalorieDirection,
        restrictions: profile.diet_restrictions,
        allergies: profile.allergy,
      }),
    });

    // 4. Query fresh user row from DB and verify exact persistence
    const savedUser = db.getUserById(user.id);
    const parsedProfile = JSON.parse(savedUser.profile_json || '{}');

    console.log(`\n💾 SQLite users Table Verification for User ID: ${savedUser.id} (${savedUser.name}):`);
    console.log(`• Height / Weight: ${savedUser.height} cm / ${savedUser.weight} kg (BMI: ${bmiInfo.bmi} - ${bmiInfo.category})`);
    console.log(`• Goal: ${savedUser.goal}`);
    console.log(`• Target Calories: ${savedUser.target_calories} kcal/day`);
    console.log(`• Target Protein: ~${macros.proteinGrams}g | Carbs: ~${macros.carbsGrams}g | Fats: ~${macros.fatGrams}g`);
    console.log(`• Cuisine Region: ${savedUser.cuisine_region}`);
    console.log(`• Diet Summary: ${savedUser.diet_summary}`);
    console.log(`• Diet Restrictions: ${savedUser.diet_restrictions}`);
    console.log(`• Allergy Safety: ${savedUser.allergy}`);
    console.log(`• profile_json Stored:`, JSON.stringify(parsedProfile, null, 2));

    // 5. Test AI Diet Query / Meal Plan Generation for this exact profile
    console.log(`\n💬 User Message to Bot: "ShowUp, suggest my personalized daily meal plan."`);
    capturedMessages = [];
    await router.handleIncomingMessage({
      phone: profile.phone,
      body: "ShowUp, suggest my personalized daily meal plan.",
    });

    const botDietPlan = popLastMessage();
    console.log(`\n🤖 ShowUp AI Personalized Diet Plan Output:\n------------------------------------------------------------\n${botDietPlan}\n------------------------------------------------------------`);
  }

  // Final Cleanup
  for (const profile of BODY_TYPE_PROFILES) {
    const u = db.getUserByPhone(profile.phone);
    if (u) {
      dbInstance.prepare('DELETE FROM checkins WHERE user_id = ?').run(u.id);
      dbInstance.prepare('DELETE FROM workout_logs WHERE user_id = ?').run(u.id);
      dbInstance.prepare('DELETE FROM chat_messages WHERE user_id = ?').run(u.id);
      dbInstance.prepare('DELETE FROM users WHERE id = ?').run(u.id);
    }
  }
  dbInstance.pragma('foreign_keys = ON');

  printDivider('ALL 4 BODY TYPE DIET SIMULATIONS COMPLETED & PERSISTENCE VERIFIED');
}

simulateBodyTypeDiets().catch(err => console.error('Diet simulation error:', err));
