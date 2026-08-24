const config = require('../config');

/**
 * Calculate BMI (Body Mass Index)
 * @param {number} heightCm - Height in centimeters
 * @param {number} weightKg - Weight in kilograms
 */
function calculateBMI(heightCm, weightKg) {
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return null;
  const heightM = heightCm / 100;
  const bmi = parseFloat((weightKg / (heightM * heightM)).toFixed(1));
  let category = 'Normal';
  if (bmi < 18.5) category = 'Underweight';
  else if (bmi >= 25 && bmi < 29.9) category = 'Overweight';
  else if (bmi >= 30) category = 'Obese';
  return { bmi, category };
}

/**
 * Calculate TDEE (Total Daily Energy Expenditure) and target calorie goal
 * @param {number} heightCm 
 * @param {number} weightKg 
 * @param {number} daysPerWeek 
 * @param {string} goal - 'muscle_gain', 'weight_loss', 'cardio', 'general'
 */
function calculateTargetCalories(heightCm, weightKg, daysPerWeek = 4, goal = 'muscle_gain') {
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return 2000;
  
  // BMR (Mifflin-St Jeor for 25yo baseline)
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * 25 + 5;
  
  let multiplier = 1.375; // 3-4 days
  if (daysPerWeek <= 2) multiplier = 1.2;
  else if (daysPerWeek >= 5 && daysPerWeek < 7) multiplier = 1.55;
  else if (daysPerWeek >= 7) multiplier = 1.725;

  const tdee = Math.round(bmr * multiplier);

  let target = tdee;
  if (goal === 'muscle_gain') target += 300; // Surplus
  else if (goal === 'weight_loss') target -= 400; // Deficit

  return Math.max(1200, Math.round(target));
}

/**
 * Calculate recommended macros (protein, carbs, fat) in grams
 */
function calculateMacros(targetCalories, weightKg) {
  const pGrams = Math.round((weightKg || 70) * 1.8); // 1.8g protein per kg
  const pCals = pGrams * 4;
  const fCals = targetCalories * 0.25; // 25% fat
  const fGrams = Math.round(fCals / 9);
  const cCals = Math.max(0, targetCalories - pCals - fCals);
  const cGrams = Math.round(cCals / 4);

  return { proteinGrams: pGrams, carbsGrams: cGrams, fatGrams: fGrams };
}

/**
 * Computes a real, per-user timeline estimate — deterministic, not left to
 * the AI to "reason about." Two prompts in gemini.js used to ask the model
 * to adjust a generic weeks/months range using the user's BMI itself; for a
 * normal-BMI user (no adjustment warranted) that produced output
 * indistinguishable from the un-personalized version, which read as "nothing
 * actually changed." This always computes a real number from their actual
 * inputs, so the AI has a concrete fact to state rather than a table to
 * recite or a judgment call to make (the same fix pattern used for promo
 * code validity and payment status elsewhere in this app — decide the fact
 * in code, let the model only phrase it).
 *
 * @param {{goal: string, daysPerWeek: number, experienceLevel: string, heightCm: number, weightKg: number}} params
 * @returns {{bmi: number|null, bmiCategory: string|null, weeksVisible: number, monthsMeaningful: number}}
 */
function calculateFitnessTimeline({ goal, daysPerWeek, experienceLevel, heightCm, weightKg }) {
  const bmiResult = calculateBMI(heightCm, weightKg);
  const bmi = bmiResult ? bmiResult.bmi : null;
  const days = daysPerWeek || 3;
  const goalLower = (goal || '').toLowerCase();
  const isMuscleGoal = /muscle|bulk|strength|mass/.test(goalLower);
  const isFatLossGoal = /fat|lean|cut|lose weight|weight loss|shred/.test(goalLower);

  let baseWeeksVisible;
  let baseMonthsMeaningful;
  if (isMuscleGoal) {
    if (days <= 2) { baseWeeksVisible = 12; baseMonthsMeaningful = 7.5; }
    else if (days <= 4) { baseWeeksVisible = 7; baseMonthsMeaningful = 5; }
    else { baseWeeksVisible = 5; baseMonthsMeaningful = 4; }
  } else if (isFatLossGoal) {
    baseWeeksVisible = 6;
    baseMonthsMeaningful = 4.5;
  } else {
    baseWeeksVisible = 5;
    baseMonthsMeaningful = 2.5;
  }

  let bmiMultiplier = 1.0;
  if (bmi) {
    if (isMuscleGoal) {
      if (bmi < 18.5) bmiMultiplier = 0.85; // less fat to lose first — visible change shows sooner
      else if (bmi >= 25) bmiMultiplier = 1.2; // muscle definition takes longer to show through
    } else if (isFatLossGoal) {
      if (bmi >= 30) bmiMultiplier = 1.3;
      else if (bmi >= 25) bmiMultiplier = 1.15;
      else if (bmi < 20) bmiMultiplier = 0.9;
    }
  }

  const experienceMultiplier = experienceLevel === 'experienced' ? 1.2 : experienceLevel === 'some_experience' ? 1.05 : 1.0;

  const weeksVisible = Math.max(3, Math.round(baseWeeksVisible * bmiMultiplier * experienceMultiplier));
  const monthsMeaningful = Math.max(1.5, Math.round(baseMonthsMeaningful * bmiMultiplier * experienceMultiplier * 10) / 10);

  return {
    bmi,
    bmiCategory: bmiResult ? bmiResult.category : null,
    weeksVisible,
    monthsMeaningful,
  };
}

module.exports = {
  calculateBMI,
  calculateTargetCalories,
  calculateMacros,
  calculateFitnessTimeline,
};
