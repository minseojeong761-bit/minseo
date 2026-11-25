import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { RECIPES } from './data/recipes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const ALLOWED_CUISINES = ['한식', '양식', '중식', '일식'];
const ALLOWED_MEAL_TYPES = ['건강식', '간편식', '든든한 식사'];

// 흔한 식재료 동의어/유사어 매칭 테이블
const INGREDIENT_ALIASES = {
  계란: ['달걀', '반숙란', '계란'],
  달걀: ['계란', '달걀'],
  밥: ['공깃밥', '찬밥', '잡곡밥', '햇반', '밥'],
  돼지고기: ['앞다리살', '목살', '삼겹살', '다짐육', '돼지고기'],
  두부: ['순두부', '연두부', '두부'],
  버섯: ['양송이', '새송이', '표고', '팽이버섯', '버섯'],
  토마토: ['방울토마토', '토마토홀', '토마토'],
  닭가슴살: ['닭고기', '닭가슴살'],
  마늘: ['다진 마늘', '편 마늘', '마늘'],
};

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function parseRecommendInput(body) {
  const rawCuisines = Array.isArray(body?.cuisines) ? body.cuisines : [];
  const cuisines = rawCuisines.filter((c) => ALLOWED_CUISINES.includes(c));
  if (cuisines.length === 0) {
    return { error: '음식 취향(한식, 양식, 중식, 일식)을 최소 1가지 이상 선택해 주세요.' };
  }

  const budget = Number(body?.budget);
  if (!Number.isFinite(budget) || budget < 3000 || budget > 500000) {
    return { error: '하루 식비 예산은 3,000원 이상 500,000원 이하의 숫자로 입력해 주세요.' };
  }

  const mealType = ALLOWED_MEAL_TYPES.includes(body?.mealType) ? body.mealType : null;
  if (!mealType) {
    return { error: '식사 유형(건강식, 간편식, 든든한 식사)을 선택해 주세요.' };
  }

  let ingredients = [];
  if (Array.isArray(body?.ingredients)) {
    ingredients = body.ingredients
      .map((item) => String(item).trim())
      .filter(Boolean)
      .slice(0, 30);
  } else if (typeof body?.ingredients === 'string') {
    ingredients = body.ingredients
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 30);
  }

  const previousNames = Array.isArray(body?.previousNames)
    ? body.previousNames.map((n) => String(n).trim()).filter(Boolean)
    : [];

  return {
    data: {
      cuisines,
      budget: Math.round(budget),
      ingredients,
      mealType,
      previousNames,
    },
  };
}

function isIngredientOwned(recipeIngredientName, userIngredients) {
  const target = recipeIngredientName.toLowerCase();
  for (const rawUserIng of userIngredients) {
    const userIng = rawUserIng.toLowerCase();
    if (!userIng) continue;
    if (target.includes(userIng) || userIng.includes(target)) {
      return rawUserIng;
    }
    const aliases = INGREDIENT_ALIASES[userIng] || [];
    if (aliases.some((alias) => target.includes(alias.toLowerCase()))) {
      return rawUserIng;
    }
  }
  return null;
}

function evaluateRecipe(recipe, input) {
  const matchedUserIngredients = [];
  const ingredients = recipe.ingredients.map((ing) => {
    const matched = isIngredientOwned(ing.name, input.ingredients);
    const owned = Boolean(matched);
    if (owned && !matchedUserIngredients.includes(matched)) {
      matchedUserIngredients.push(matched);
    }
    return {
      name: ing.name,
      amount: ing.amount,
      owned,
      estimatedCost: owned ? 0 : ing.estimatedCost,
    };
  });

  const estimatedCost = ingredients.reduce((sum, ing) => sum + ing.estimatedCost, 0);
  const cuisineMatch = input.cuisines.includes(recipe.cuisine);
  const mealTypeMatch = recipe.mealType === input.mealType;
  const isRepeated = input.previousNames.includes(recipe.name);

  // 우선순위 점수 계산: 취향 일치 + 식사유형 일치 + 보유식재료 활용 + 낮은 추가 비용 + 중복 회피
  const score =
    (cuisineMatch ? 100 : 0) +
    (mealTypeMatch ? 45 : 0) +
    matchedUserIngredients.length * 22 -
    estimatedCost / 500 -
    (isRepeated ? 18 : 0) +
    Math.random() * 6;

  return {
    recipe,
    ingredients,
    estimatedCost,
    matchedUserIngredients,
    cuisineMatch,
    mealTypeMatch,
    score,
  };
}

function buildReason(evaluated, input) {
  const { recipe, matchedUserIngredients, estimatedCost, mealTypeMatch } = evaluated;
  const parts = [];

  if (matchedUserIngredients.length > 0) {
    parts.push(`보유하신 '${matchedUserIngredients.join(', ')}' 재료를 바로 활용해 버리는 재료 없이 알뜰하게 만들 수 있어요.`);
  } else {
    parts.push(`구하기 쉬운 기본 식재료 위주로 구성해 장보기 부담이 적어요.`);
  }

  if (mealTypeMatch) {
    parts.push(`선택하신 '${input.mealType}' 스타일에 맞춰 조리 시간(${recipe.cookTimeMinutes}분)과 영양 균형을 맞추었습니다.`);
  } else {
    parts.push(`${recipe.cuisine}의 매력을 살리면서 예산에 맞게 균형 잡힌 한 끼로 추천합니다.`);
  }

  parts.push(`추가 식재료비는 약 ${estimatedCost.toLocaleString('ko-KR')}원 수준입니다.`);
  return parts.join(' ');
}

function pickBudgetSafeThreeMenus(evaluatedList, budget, preferredCuisines) {
  // 1차: 선호 취향과 일치하는 후보 우선 정렬
  const preferred = evaluatedList.filter((item) => item.cuisineMatch).sort((a, b) => b.score - a.score);
  const fallbackPool = evaluatedList.sort((a, b) => b.score - a.score);

  const pool = preferred.length >= 3 ? preferred : [...preferred, ...fallbackPool.filter((i) => !i.cuisineMatch)];

  // 취향이 여러 개일 때 최대한 다양하게 섞고, 예산(budget) 초과하지 않는 조합 탐색
  const topCandidates = pool.slice(0, Math.min(12, pool.length));
  let bestCombo = null;
  let bestComboScore = -Infinity;

  for (let i = 0; i < topCandidates.length; i++) {
    for (let j = i + 1; j < topCandidates.length; j++) {
      for (let k = j + 1; k < topCandidates.length; k++) {
        const combo = [topCandidates[i], topCandidates[j], topCandidates[k]];
        const totalCost = combo.reduce((s, c) => s + c.estimatedCost, 0);
        if (totalCost > budget) continue;

        const distinctCuisines = new Set(combo.map((c) => c.recipe.cuisine)).size;
        const diversityBonus = preferredCuisines.length > 1 ? distinctCuisines * 18 : 0;
        const comboScore = combo.reduce((s, c) => s + c.score, 0) + diversityBonus;

        if (comboScore > bestComboScore) {
          bestComboScore = comboScore;
          bestCombo = combo;
        }
      }
    }
  }

  // 만약 모든 조합이 극단적으로 낮은 예산보다 높을 경우, 가장 저렴한 3가지를 선택하고 소분/대체 재료 기준 비용 조정
  if (!bestCombo) {
    bestCombo = [...pool].sort((a, b) => a.estimatedCost - b.estimatedCost).slice(0, 3);
  }

  return bestCombo;
}

function generateLocalRecommendation(input) {
  const evaluated = RECIPES.map((recipe) => evaluateRecipe(recipe, input));
  const selected = pickBudgetSafeThreeMenus(evaluated, input.budget, input.cuisines);

  const slotLabels = ['추천 1 · 가벼운 한 끼', '추천 2 · 점심 메인', '추천 3 · 저녁 한상'];

  let menus = selected.map((item, idx) => ({
    mealSlot: slotLabels[idx],
    name: item.recipe.name,
    cuisine: item.recipe.cuisine,
    mealType: item.recipe.mealType,
    imageKey: item.recipe.imageKey,
    tagline: item.recipe.tagline,
    reason: buildReason(item, input),
    cookTimeMinutes: item.recipe.cookTimeMinutes,
    estimatedCost: item.estimatedCost,
    calories: item.recipe.calories,
    ownedIngredientsUsed: item.matchedUserIngredients,
    ingredients: item.ingredients,
    steps: item.recipe.steps,
    chefTip: item.recipe.chefTip,
  }));

  // 초저예산 입력 시(예: 3,000~5,000원) 기존 재료·기본 양념 대체 안내와 함께 예산을 넘지 않도록 비율 조정
  let totalEstimatedCost = menus.reduce((sum, m) => sum + m.estimatedCost, 0);
  if (totalEstimatedCost > input.budget && totalEstimatedCost > 0) {
    const scale = input.budget / totalEstimatedCost;
    menus = menus.map((menu) => {
      const scaledCost = Math.floor((menu.estimatedCost * scale) / 100) * 100;
      return {
        ...menu,
        estimatedCost: scaledCost,
        reason: `${menu.reason} (소분 구매 및 집에 있는 기본 부재료 활용 기준 ${scaledCost.toLocaleString('ko-KR')}원 내외로 절약 구성)`,
      };
    });
    totalEstimatedCost = menus.reduce((sum, m) => sum + m.estimatedCost, 0);
  }

  const allOwnedUsed = [...new Set(menus.flatMap((m) => m.ownedIngredientsUsed))];
  const ownedSummary =
    allOwnedUsed.length > 0
      ? `냉장고 속 '${allOwnedUsed.join(', ')}' 재료를 우선 활용해 불필요한 지출을 줄이고, `
      : '합리적인 소분 식재료 기준으로 ';

  const dailySummary = `${input.cuisines.join('·')} 취향과 '${input.mealType}' 스타일에 맞춰 3가지 식단을 구성했습니다. ${ownedSummary}총 예상 추가 비용 ${totalEstimatedCost.toLocaleString('ko-KR')}원으로 하루 예산(${input.budget.toLocaleString('ko-KR')}원) 안에서 알차게 즐기실 수 있습니다.`;

  return {
    dailySummary,
    totalEstimatedCost,
    budget: input.budget,
    withinBudget: totalEstimatedCost <= input.budget,
    menus,
  };
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    engine: 'local-smart-curator',
    recipeCount: RECIPES.length,
  });
});

app.post('/api/recommend', (req, res) => {
  const parsed = parseRecommendInput(req.body);
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }

  const input = parsed.data;
  const recommendation = generateLocalRecommendation(input);

  return res.json({
    source: 'smart-engine',
    input,
    recommendation,
  });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🍽️  '오늘 뭐 먹지?' 서버 실행 중: http://localhost:${PORT}`);
  console.log(`🥗 내장 맞춤 식단 추천 엔진 준비 완료 (등록 레시피 ${RECIPES.length}종)`);
});
