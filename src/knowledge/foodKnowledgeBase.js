// Curated reference knowledge base for common Indian foods (plus a few Western staples),
// used to ground the AI's calorie/macro estimates when a user logs what they ate.
// Values are per stated typical serving, approximated from standard nutrition references.

// Each entry: name, aliases (alt spellings/regional names), servingLabel, calories, protein, carbs, fat (grams)
const FOOD_ITEMS = [
  // ── South Indian ──
  { name: 'Idli', aliases: ['idlis', 'idly'], serving: '2 pieces', calories: 140, protein: 4, carbs: 28, fat: 1 },
  { name: 'Plain Dosa', aliases: ['dosa', 'sada dosa', 'plain dosai'], serving: '1 piece', calories: 133, protein: 3.5, carbs: 20, fat: 4 },
  { name: 'Masala Dosa', aliases: ['masala dosai'], serving: '1 piece', calories: 350, protein: 6, carbs: 50, fat: 14 },
  { name: 'Rava Dosa', aliases: [], serving: '1 piece', calories: 180, protein: 3, carbs: 25, fat: 8 },
  { name: 'Sambar', aliases: ['saambar'], serving: '1 cup (~200ml)', calories: 120, protein: 6, carbs: 18, fat: 3 },
  { name: 'Coconut Chutney', aliases: ['thengai chutney'], serving: '2 tbsp', calories: 90, protein: 1.5, carbs: 3, fat: 8.5 },
  { name: 'Rasam', aliases: [], serving: '1 cup (~200ml)', calories: 60, protein: 2, carbs: 10, fat: 1.5 },
  { name: 'Curd Rice', aliases: ['thayir sadam', 'daddojanam'], serving: '1 bowl (~250g)', calories: 300, protein: 8, carbs: 50, fat: 7 },
  { name: 'Lemon Rice', aliases: ['elumichai sadam', 'chitranna'], serving: '1 plate (~250g)', calories: 320, protein: 5, carbs: 52, fat: 10 },
  { name: 'Tamarind Rice', aliases: ['puliyodarai', 'puliogare', 'pulihora'], serving: '1 plate (~250g)', calories: 350, protein: 6, carbs: 55, fat: 12 },
  { name: 'Tomato Rice', aliases: ['thakkali sadam'], serving: '1 plate (~250g)', calories: 330, protein: 6, carbs: 54, fat: 10 },
  { name: 'Coconut Rice', aliases: ['thengai sadam'], serving: '1 plate (~250g)', calories: 380, protein: 5, carbs: 50, fat: 18 },
  { name: 'Curd', aliases: ['yogurt', 'dahi', 'thayir'], serving: '1 cup (~200g)', calories: 120, protein: 7, carbs: 9, fat: 6 },
  { name: 'Buttermilk', aliases: ['chaas', 'moru'], serving: '1 glass (~250ml)', calories: 40, protein: 2, carbs: 4, fat: 1.5 },
  { name: 'Medu Vada', aliases: ['vada', 'ulundu vadai'], serving: '1 piece', calories: 150, protein: 4, carbs: 15, fat: 8 },
  { name: 'Uttapam', aliases: ['uthappam'], serving: '1 piece', calories: 220, protein: 5, carbs: 35, fat: 6 },
  { name: 'Upma', aliases: ['uppma', 'uppittu'], serving: '1 plate (~200g)', calories: 250, protein: 6, carbs: 40, fat: 8 },
  { name: 'Pongal', aliases: ['ven pongal', 'khara pongal'], serving: '1 plate (~250g)', calories: 400, protein: 9, carbs: 55, fat: 15 },
  { name: 'Idiyappam', aliases: ['string hoppers', 'noolputtu'], serving: '4 pieces', calories: 200, protein: 4, carbs: 44, fat: 1 },
  { name: 'Appam', aliases: ['vellayappam'], serving: '2 pieces', calories: 240, protein: 4, carbs: 46, fat: 4 },
  { name: 'Bisi Bele Bath', aliases: [], serving: '1 plate (~300g)', calories: 420, protein: 12, carbs: 60, fat: 14 },
  { name: 'Kesari', aliases: ['sheera', 'rava kesari'], serving: '1 small bowl (~100g)', calories: 280, protein: 3, carbs: 45, fat: 10 },

  // ── North Indian ──
  { name: 'Chapati', aliases: ['roti', 'phulka'], serving: '1 piece', calories: 100, protein: 3, carbs: 18, fat: 2.5 },
  { name: 'Paratha', aliases: ['plain paratha'], serving: '1 piece', calories: 260, protein: 5, carbs: 32, fat: 12 },
  { name: 'Aloo Paratha', aliases: ['potato paratha'], serving: '1 piece', calories: 320, protein: 6, carbs: 42, fat: 14 },
  { name: 'Poha', aliases: ['pohe', 'aval'], serving: '1 plate (~200g)', calories: 270, protein: 5, carbs: 45, fat: 8 },
  { name: 'Rajma', aliases: ['kidney bean curry'], serving: '1 cup (~200g)', calories: 220, protein: 12, carbs: 34, fat: 3 },
  { name: 'Chole', aliases: ['chana masala', 'chickpea curry'], serving: '1 cup (~200g)', calories: 280, protein: 12, carbs: 38, fat: 9 },
  { name: 'Dal Tadka', aliases: ['dal', 'toor dal', 'moong dal', 'yellow dal'], serving: '1 cup (~200g)', calories: 180, protein: 10, carbs: 24, fat: 5 },
  { name: 'Paneer Butter Masala', aliases: ['paneer makhani'], serving: '1 cup (~200g)', calories: 380, protein: 14, carbs: 12, fat: 30 },
  { name: 'Palak Paneer', aliases: [], serving: '1 cup (~200g)', calories: 300, protein: 13, carbs: 10, fat: 22 },
  { name: 'Chicken Curry', aliases: ['kozhi curry', 'murgh curry'], serving: '1 cup (~200g)', calories: 280, protein: 25, carbs: 6, fat: 17 },
  { name: 'Butter Chicken', aliases: ['murgh makhani'], serving: '1 cup (~200g)', calories: 420, protein: 24, carbs: 10, fat: 30 },
  { name: 'Egg Curry', aliases: ['muttai curry'], serving: '2 eggs in curry', calories: 260, protein: 14, carbs: 6, fat: 19 },
  { name: 'Vegetable Biryani', aliases: ['veg biryani'], serving: '1 plate (~350g)', calories: 480, protein: 10, carbs: 70, fat: 16 },
  { name: 'Chicken Biryani', aliases: [], serving: '1 plate (~350g)', calories: 620, protein: 28, carbs: 70, fat: 22 },
  { name: 'Plain Rice', aliases: ['steamed rice', 'sadam', 'chawal'], serving: '1 cup cooked (~150g)', calories: 200, protein: 4, carbs: 45, fat: 0.5 },
  { name: 'Jeera Rice', aliases: [], serving: '1 cup (~180g)', calories: 250, protein: 4, carbs: 45, fat: 6 },
  { name: 'Samosa', aliases: [], serving: '1 piece', calories: 260, protein: 4, carbs: 28, fat: 15 },
  { name: 'Pakora', aliases: ['bhajji', 'bajji'], serving: '4-5 pieces', calories: 220, protein: 4, carbs: 22, fat: 13 },

  // ── Snacks / breakfast staples ──
  { name: 'Boiled Egg', aliases: ['egg', 'muttai'], serving: '1 large', calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3 },
  { name: 'Omelette', aliases: ['egg omelette'], serving: '2 eggs', calories: 200, protein: 13, carbs: 1.5, fat: 16 },
  { name: 'Roasted Chana', aliases: ['bhuna chana', 'dalia'], serving: '1 handful (~30g)', calories: 120, protein: 7, carbs: 18, fat: 2 },
  { name: 'Peanut Chikki', aliases: ['groundnut chikki'], serving: '1 bar (~30g)', calories: 140, protein: 4, carbs: 15, fat: 8 },
  { name: 'Banana', aliases: ['vazhaipazham'], serving: '1 medium', calories: 105, protein: 1.3, carbs: 27, fat: 0.4 },
  { name: 'Apple', aliases: [], serving: '1 medium', calories: 95, protein: 0.5, carbs: 25, fat: 0.3 },
  { name: 'Almonds', aliases: ['badam'], serving: '10 pieces', calories: 70, protein: 2.5, carbs: 2.5, fat: 6 },
  { name: 'Milk', aliases: ['paal', 'doodh'], serving: '1 glass (~250ml)', calories: 150, protein: 8, carbs: 12, fat: 8 },
  { name: 'Tea', aliases: ['chai', 'tea with milk and sugar'], serving: '1 cup (~150ml)', calories: 60, protein: 1.5, carbs: 8, fat: 2.5 },
  { name: 'Filter Coffee', aliases: ['coffee'], serving: '1 cup (~150ml)', calories: 70, protein: 2, carbs: 8, fat: 3 },
  { name: 'Sprouts Salad', aliases: ['moong sprouts'], serving: '1 bowl (~150g)', calories: 150, protein: 12, carbs: 22, fat: 1 },

  // ── Generic Western reference (used when relevant) ──
  { name: 'Chicken Breast (grilled)', aliases: ['grilled chicken'], serving: '100g', calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { name: 'Oats', aliases: ['oatmeal', 'porridge'], serving: '1 bowl cooked (~200g)', calories: 220, protein: 8, carbs: 38, fat: 4 },
  { name: 'Brown Bread', aliases: ['whole wheat bread'], serving: '2 slices', calories: 160, protein: 6, carbs: 28, fat: 2 },
  { name: 'Peanut Butter', aliases: [], serving: '2 tbsp (~32g)', calories: 190, protein: 8, carbs: 6, fat: 16 },
];

function normalize(str) {
  return String(str || '').toLowerCase().trim();
}

/**
 * Finds all KB entries whose name or alias appears as a substring match in the given text.
 * Used to ground Gemini's diet-log parsing with known, accurate serving/calorie data.
 */
function findFoodMatches(text) {
  const lower = normalize(text);
  const matches = [];
  for (const item of FOOD_ITEMS) {
    const candidates = [item.name, ...item.aliases].map(normalize);
    if (candidates.some((c) => lower.includes(c))) {
      matches.push(item);
    }
  }
  return matches;
}

/** Exact/alias lookup for a single food name. */
function lookupFood(name) {
  const lower = normalize(name);
  return FOOD_ITEMS.find((item) =>
    [item.name, ...item.aliases].map(normalize).includes(lower)
  ) || null;
}

function formatFoodMatchesForPrompt(matches) {
  if (!matches || matches.length === 0) return '';
  return `
== REFERENCE KNOWLEDGE BASE (known food items detected in this message) ==
${matches.map((m) => `  - ${m.name}: ${m.serving} = ${m.calories} kcal, ${m.protein}g protein, ${m.carbs}g carbs, ${m.fat}g fat`).join('\n')}
== END KNOWLEDGE BASE ==
Use these exact reference values for the matching items (scale proportionally if the user's stated quantity/portion differs from the reference serving). For any other food items mentioned that are NOT in this list, estimate using your own nutrition knowledge as usual.
`.trim();
}

module.exports = { FOOD_ITEMS, findFoodMatches, lookupFood, formatFoodMatchesForPrompt };
