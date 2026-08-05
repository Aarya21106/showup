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

module.exports = {
  calculateBMI,
  calculateTargetCalories,
  calculateMacros,
};
