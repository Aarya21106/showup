const db = require('../db/db');
const gemini = require('../services/gemini');
const messaging = require('../services/messaging');
const { todayStr } = require('../utils/date');
const config = require('../config');

async function handleBurnLog(user, text) {
  const today = todayStr(config.timezone);

  try {
    const parsed = await gemini.parseBurnedCalories(text);
    const kcal = parsed.calories_burned || 0;

    if (kcal <= 0) {
      await messaging.sendText(user.phone, "I couldn't estimate any calories burned for that. Can you specify the duration or intensity?");
      return;
    }

    db.logBurnedCalories({
      userId: user.id,
      date: today,
      activityName: parsed.activity_name || 'workout',
      caloriesBurned: kcal
    });

    // Fetch total consumed and burned today
    const nutritionLogs = db.getNutritionLogsToday(user.id, today);
    const totalEaten = nutritionLogs.reduce((sum, log) => sum + log.calories, 0);

    const burnLogs = db.getBurnedCaloriesLogsToday(user.id, today);
    const totalBurned = burnLogs.reduce((sum, log) => sum + log.calories_burned, 0);

    const targetCalories = user.target_calories || 2000;
    const netCalories = totalEaten - totalBurned;

    const message = `Activity Logged:\n` +
      `• Workout: ${parsed.activity_name}\n` +
      `• Calories Burned: -${kcal} kcal\n\n` +
      `• Daily Balance: Eaten (${totalEaten} kcal) - Burned (${totalBurned} kcal) = ${netCalories} net kcal\n` +
      `• Target Budget: ${targetCalories} kcal`;

    await messaging.sendText(user.phone, message);
  } catch (err) {
    console.error('Error logging burned calories:', err);
    await messaging.sendText(user.phone, "Sorry, I had an issue logging your workout calories.");
  }
}

async function handleExerciseQuery(user, text) {
  // Extract muscle group / split from query (or fallback to target_muscle)
  let muscle = user.target_muscle || 'full body';
  
  const words = text.toLowerCase();
  const splitsAndMuscles = [
    'chest and triceps', 'chest + triceps', 'back and biceps', 'back + biceps',
    'shoulders and arms', 'shoulders + arms', 'upper body', 'lower body',
    'push', 'pull', 'legs', 'chest', 'back', 'biceps', 'triceps',
    'shoulders', 'arms', 'abs', 'core', 'quads', 'hamstrings', 'glutes', 'calves',
  ];
  for (const m of splitsAndMuscles) {
    if (words.includes(m)) {
      muscle = m;
      break;
    }
  }

  try {
    const reply = await gemini.getExerciseSuggestions(user, text, muscle);
    await messaging.sendText(user.phone, reply);
  } catch (err) {
    console.error('Error getting exercise suggestions:', err);
    await messaging.sendText(user.phone, "Sorry, I couldn't fetch workout suggestions right now.");
  }
}

module.exports = { handleBurnLog, handleExerciseQuery };
