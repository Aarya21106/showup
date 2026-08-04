const db = require('../db/db');
const gemini = require('../services/gemini');
const whatsapp = require('../services/whatsapp');
const { todayStr } = require('../utils/date');
const config = require('../config');

async function handleDietLog(user, text) {
  // Ensure target_calories is set based on weight
  let targetCalories = user.target_calories;
  if (!targetCalories && user.weight) {
    targetCalories = Math.round(user.weight * 30);
    db.updateUser(user.id, { target_calories: targetCalories });
  }
  if (!targetCalories) {
    targetCalories = 2000; // default calorie target
  }

  const today = todayStr(config.timezone);

  try {
    const parsed = await gemini.parseDietLog(text);
    if (!parsed.items || parsed.items.length === 0) {
      await whatsapp.sendText(user.phone, "Hmm, I couldn't extract any food items from that. Try saying something like: 'I ate 2 eggs and 100g chicken breast'.");
      return;
    }

    let loggedKcal = 0;
    let breakdownParts = [];

    for (const item of parsed.items) {
      const kcal = Math.round(item.calories || 0);
      loggedKcal += kcal;

      db.logNutrition({
        userId: user.id,
        date: today,
        foodItem: item.food_item,
        weightG: item.weight_g,
        calories: kcal,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat
      });

      const gramsStr = item.weight_g ? ` (${item.weight_g}g)` : '';
      breakdownParts.push(`🍳 ${item.food_item}${gramsStr}: ${kcal} kcal`);
    }

    // Fetch total logged today
    const logs = db.getNutritionLogsToday(user.id, today);
    const totalToday = logs.reduce((sum, log) => sum + log.calories, 0);
    const remaining = Math.max(0, targetCalories - totalToday);

    const message = `✅ *Diet Logged!*\n` +
      `${breakdownParts.join('\n')}\n\n` +
      `🔥 *Logged now:* +${loggedKcal} kcal\n` +
      `📊 *Today's Total:* ${totalToday} / ${targetCalories} kcal\n` +
      `🎯 *Remaining:* ${remaining} kcal`;

    await whatsapp.sendText(user.phone, message);
  } catch (err) {
    console.error('Error logging diet:', err);
    await whatsapp.sendText(user.phone, "Sorry, I had trouble parsing your food log. Can you try again?");
  }
}

async function handleDietQuery(user, text) {
  try {
    const reply = await gemini.getDietSuggestions(user, text);
    await whatsapp.sendText(user.phone, reply);
  } catch (err) {
    console.error('Error getting diet suggestions:', err);
    await whatsapp.sendText(user.phone, "Sorry, I had an issue generating your diet suggestions.");
  }
}

module.exports = { handleDietLog, handleDietQuery };
