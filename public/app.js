const IMAGE_MAP = {
  korean: '/images/korean.jpg',
  western: '/images/western.jpg',
  chinese: '/images/chinese.jpg',
  japanese: '/images/japanese.jpg',
  healthy: '/images/healthy.jpg',
};

const state = {
  cuisines: ['한식'],
  mealType: '건강식',
  budget: 15000,
  ingredients: ['계란', '양파', '두부'],
  isLoading: false,
  lastMenus: [],
};

const els = {
  serverStatusBadge: document.getElementById('serverStatusBadge'),
  railStatusDot: document.getElementById('railStatusDot'),
  todayDateLabel: document.getElementById('todayDateLabel'),

  cuisineButtons: document.querySelectorAll('[data-cuisine]'),
  cuisineCountText: document.getElementById('cuisineCountText'),
  mealTypeButtons: document.querySelectorAll('[data-mealtype]'),

  budgetInput: document.getElementById('budgetInput'),
  budgetRange: document.getElementById('budgetRange'),
  budgetFormatted: document.getElementById('budgetFormatted'),
  budgetPresetBtns: document.querySelectorAll('[data-budget]'),

  ingredientInput: document.getElementById('ingredientInput'),
  addIngredientBtn: document.getElementById('addIngredientBtn'),
  clearIngredientsBtn: document.getElementById('clearIngredientsBtn'),
  ingredientTags: document.getElementById('ingredientTags'),
  quickIngredientBtns: document.querySelectorAll('[data-ing]'),

  presetChips: document.querySelectorAll('[data-preset]'),
  photoTiles: document.querySelectorAll('[data-pick-cuisine]'),

  summaryCuisine: document.getElementById('summaryCuisine'),
  summaryMealType: document.getElementById('summaryMealType'),
  summaryBudget: document.getElementById('summaryBudget'),
  summaryIngredients: document.getElementById('summaryIngredients'),

  recommendForm: document.getElementById('recommendForm'),
  recommendBtn: document.getElementById('recommendBtn'),
  formError: document.getElementById('formError'),

  emptyState: document.getElementById('emptyState'),
  loadingState: document.getElementById('loadingState'),
  resultsContent: document.getElementById('resultsContent'),
  dailySummaryText: document.getElementById('dailySummaryText'),
  totalCostText: document.getElementById('totalCostText'),
  budgetProgressTrack: document.getElementById('budgetProgressTrack'),
  budgetProgressFill: document.getElementById('budgetProgressFill'),
  budgetCapText: document.getElementById('budgetCapText'),
  budgetStatusPill: document.getElementById('budgetStatusPill'),
  menusGrid: document.getElementById('menusGrid'),

  recipeModal: document.getElementById('recipeModal'),
  modalBody: document.getElementById('modalBody'),
  closeModalBtn: document.getElementById('closeModalBtn'),
};

function formatWon(amount) {
  return `${Math.round(Number(amount) || 0).toLocaleString('ko-KR')}원`;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setTodayLabel() {
  const now = new Date();
  const formatted = now.toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
  els.todayDateLabel.textContent = `${formatted} · 오늘의 식탁`;
}

async function checkServerHealth() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (data.ok) {
      els.serverStatusBadge.className = 'server-badge is-ready';
      els.serverStatusBadge.querySelector('.badge-label').textContent = `맞춤 식단 엔진 가동 중 (${data.recipeCount}종 레시피)`;
      els.railStatusDot.className = 'security-dot is-ok';
    }
  } catch {
    els.serverStatusBadge.className = 'server-badge is-missing';
    els.serverStatusBadge.querySelector('.badge-label').textContent = '서버 연결 확인 필요';
    els.railStatusDot.className = 'security-dot is-warn';
  }
}

function renderCuisines() {
  els.cuisineButtons.forEach((btn) => {
    const selected = state.cuisines.includes(btn.dataset.cuisine);
    btn.classList.toggle('is-selected', selected);
    btn.setAttribute('aria-pressed', String(selected));
  });
  els.cuisineCountText.textContent = `${state.cuisines.length}개 선택됨`;
  els.summaryCuisine.textContent = state.cuisines.length > 0 ? state.cuisines.join(', ') : '미선택';
}

function renderMealType() {
  els.mealTypeButtons.forEach((btn) => {
    const selected = btn.dataset.mealtype === state.mealType;
    btn.classList.toggle('is-selected', selected);
    btn.setAttribute('aria-checked', String(selected));
  });
  els.summaryMealType.textContent = state.mealType;
}

function renderBudget() {
  els.budgetInput.value = state.budget;
  els.budgetRange.value = Math.min(50000, Math.max(5000, state.budget));
  els.budgetFormatted.textContent = formatWon(state.budget);
  els.summaryBudget.textContent = `${formatWon(state.budget)} 이하`;

  els.budgetPresetBtns.forEach((btn) => {
    btn.classList.toggle('is-active', Number(btn.dataset.budget) === state.budget);
  });
}

function renderIngredients() {
  els.ingredientTags.innerHTML = '';

  if (state.ingredients.length === 0) {
    const emptyNote = document.createElement('span');
    emptyNote.className = 'hint';
    emptyNote.textContent = '아직 등록된 보유 식재료가 없어요. 위 입력창이나 아래 빠른 버튼을 눌러 추가해 보세요.';
    els.ingredientTags.appendChild(emptyNote);
  } else {
    state.ingredients.forEach((ing) => {
      const tag = document.createElement('span');
      tag.className = 'ing-tag';
      tag.innerHTML = `<span>${escapeHtml(ing)}</span>`;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'ing-remove';
      removeBtn.setAttribute('aria-label', `${ing} 삭제`);
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        state.ingredients = state.ingredients.filter((item) => item !== ing);
        renderIngredients();
      });

      tag.appendChild(removeBtn);
      els.ingredientTags.appendChild(tag);
    });
  }

  els.quickIngredientBtns.forEach((btn) => {
    btn.classList.toggle('is-added', state.ingredients.includes(btn.dataset.ing));
  });

  els.summaryIngredients.textContent =
    state.ingredients.length > 0 ? `${state.ingredients.length}개 (${state.ingredients.slice(0, 3).join(', ')}${state.ingredients.length > 3 ? ' 등' : ''})` : '없음';
}

function addIngredientsFromText(rawText) {
  const items = String(rawText)
    .split(/[,\n]/)
    .map((v) => v.trim())
    .filter(Boolean);

  items.forEach((item) => {
    if (!state.ingredients.includes(item) && state.ingredients.length < 30) {
      state.ingredients.push(item);
    }
  });
  renderIngredients();
}

function showFormError(message) {
  if (!message) {
    els.formError.classList.add('hidden');
    els.formError.textContent = '';
    return;
  }
  els.formError.textContent = message;
  els.formError.classList.remove('hidden');
}

function setLoading(loading) {
  state.isLoading = loading;
  els.recommendBtn.disabled = loading;
  els.recommendBtn.querySelector('.btn-text').textContent = loading
    ? '맞춤형 식단을 구성하고 있습니다...'
    : 'AI 맞춤형 식단 추천받기';

  if (loading) {
    els.emptyState.classList.add('hidden');
    els.resultsContent.classList.add('hidden');
    els.loadingState.classList.remove('hidden');
    document.getElementById('results-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    els.loadingState.classList.add('hidden');
  }
}

function getMenuImage(menu) {
  return IMAGE_MAP[menu.imageKey] || IMAGE_MAP.korean;
}

function renderRecommendations(data) {
  const rec = data.recommendation;
  state.lastMenus = rec.menus || [];

  els.dailySummaryText.textContent = rec.dailySummary;
  els.totalCostText.textContent = formatWon(rec.totalEstimatedCost);
  els.budgetCapText.textContent = `목표 예산: ${formatWon(rec.budget)}`;

  const ratio = Math.min(100, Math.round((rec.totalEstimatedCost / Math.max(1, rec.budget)) * 100));
  els.budgetProgressFill.style.width = `${ratio}%`;
  els.budgetProgressTrack.setAttribute('aria-valuenow', String(ratio));

  if (rec.withinBudget) {
    els.budgetStatusPill.textContent = `예산 ${formatWon(rec.budget - rec.totalEstimatedCost)} 절약`;
    els.budgetStatusPill.classList.remove('is-over');
  } else {
    els.budgetStatusPill.textContent = '예산 근접 초과 주의';
    els.budgetStatusPill.classList.add('is-over');
  }

  els.menusGrid.innerHTML = '';

  state.lastMenus.forEach((menu, index) => {
    const card = document.createElement('article');
    card.className = 'card menu-card';

    const ingredientsHtml = (menu.ingredients || [])
      .map((ing) => {
        const badgeClass = ing.owned ? 'is-owned' : 'is-buy';
        const badgeLabel = ing.owned ? '보유' : ing.estimatedCost > 0 ? formatWon(ing.estimatedCost) : '추가';
        return `
          <li class="ing-item">
            <span class="ing-left">
              <span class="ing-badge ${badgeClass}">${badgeLabel}</span>
              <span>${escapeHtml(ing.name)}</span>
            </span>
            <span class="ing-right">${escapeHtml(ing.amount)}</span>
          </li>`;
      })
      .join('');

    const stepsHtml = (menu.steps || [])
      .map((step) => `<li>${escapeHtml(step)}</li>`)
      .join('');

    card.innerHTML = `
      <div class="menu-media">
        <img src="${getMenuImage(menu)}" alt="${escapeHtml(menu.name)}" />
        <div class="media-badges">
          <span class="slot-badge">${escapeHtml(menu.mealSlot)}</span>
          <span class="cuisine-badge">${escapeHtml(menu.cuisine)} · ${escapeHtml(menu.mealType)}</span>
        </div>
      </div>
      <div class="menu-body">
        <div class="menu-title-row">
          <h3>${escapeHtml(menu.name)}</h3>
          <p class="menu-tagline">${escapeHtml(menu.tagline)}</p>
        </div>

        <div class="menu-stats">
          <div class="stat-item">
            <span>예상 시간</span>
            <strong>⏱ ${menu.cookTimeMinutes}분</strong>
          </div>
          <div class="stat-item">
            <span>추가 재료비</span>
            <strong>💰 ${formatWon(menu.estimatedCost)}</strong>
          </div>
          <div class="stat-item">
            <span>예상 열량</span>
            <strong>🔥 ${menu.calories}kcal</strong>
          </div>
        </div>

        <div class="reason-box">
          <strong>💡 AI 추천 이유</strong>
          <span>${escapeHtml(menu.reason)}</span>
        </div>

        <div>
          <h4 class="sub-block-title">🧺 필요한 식재료와 분량</h4>
          <ul class="ing-list">${ingredientsHtml}</ul>
        </div>

        <div>
          <h4 class="sub-block-title">👩‍🍳 구체적인 조리 순서</h4>
          <ol class="steps-list">${stepsHtml}</ol>
        </div>

        ${menu.chefTip ? `<div class="chef-tip"><strong>✨ 셰프 팁:</strong> ${escapeHtml(menu.chefTip)}</div>` : ''}

        <button type="button" class="detail-btn" data-menu-index="${index}">레시피 크게 보기</button>
      </div>
    `;

    card.querySelector('.detail-btn').addEventListener('click', () => openRecipeModal(menu));
    els.menusGrid.appendChild(card);
  });

  els.emptyState.classList.add('hidden');
  els.resultsContent.classList.remove('hidden');
}

function openRecipeModal(menu) {
  const ingredientsHtml = (menu.ingredients || [])
    .map(
      (ing) => `
      <li class="ing-item">
        <span class="ing-left">
          <input type="checkbox" aria-label="${escapeHtml(ing.name)} 준비 완료" />
          <span class="ing-badge ${ing.owned ? 'is-owned' : 'is-buy'}">${ing.owned ? '보유 재료' : formatWon(ing.estimatedCost)}</span>
          <span>${escapeHtml(ing.name)}</span>
        </span>
        <span class="ing-right">${escapeHtml(ing.amount)}</span>
      </li>`
    )
    .join('');

  const stepsHtml = (menu.steps || []).map((s) => `<li>${escapeHtml(s)}</li>`).join('');

  els.modalBody.innerHTML = `
    <img class="modal-hero-img" src="${getMenuImage(menu)}" alt="${escapeHtml(menu.name)}" />
    <span class="eyebrow">${escapeHtml(menu.mealSlot)} · ${escapeHtml(menu.cuisine)} · ${escapeHtml(menu.mealType)}</span>
    <h2 id="modalTitle" style="margin: 6px 0 6px; font-size: 24px;">${escapeHtml(menu.name)}</h2>
    <p style="margin: 0 0 14px; color: var(--text-sub);">${escapeHtml(menu.tagline)}</p>

    <div class="menu-stats" style="margin-bottom: 16px;">
      <div class="stat-item"><span>예상 조리 시간</span><strong>⏱ ${menu.cookTimeMinutes}분</strong></div>
      <div class="stat-item"><span>추가 식재료 비용</span><strong>💰 ${formatWon(menu.estimatedCost)}</strong></div>
      <div class="stat-item"><span>예상 열량</span><strong>🔥 ${menu.calories}kcal</strong></div>
    </div>

    <div class="reason-box" style="margin-bottom: 16px;">
      <strong>💡 추천 이유</strong>
      <span>${escapeHtml(menu.reason)}</span>
    </div>

    <h4 class="sub-block-title">🧺 필요한 식재료와 분량 (체크리스트)</h4>
    <ul class="ing-list" style="margin-bottom: 18px;">${ingredientsHtml}</ul>

    <h4 class="sub-block-title">👩‍🍳 조리 순서</h4>
    <ol class="steps-list" style="margin-bottom: 16px;">${stepsHtml}</ol>

    ${menu.chefTip ? `<div class="chef-tip"><strong>✨ 셰프 팁:</strong> ${escapeHtml(menu.chefTip)}</div>` : ''}
  `;

  els.recipeModal.classList.remove('hidden');
}

function closeRecipeModal() {
  els.recipeModal.classList.add('hidden');
}

// 이벤트 바인딩
els.cuisineButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const cuisine = btn.dataset.cuisine;
    if (state.cuisines.includes(cuisine)) {
      if (state.cuisines.length > 1) {
        state.cuisines = state.cuisines.filter((c) => c !== cuisine);
      }
    } else {
      state.cuisines.push(cuisine);
    }
    renderCuisines();
  });
});

els.photoTiles.forEach((tile) => {
  tile.addEventListener('click', () => {
    const cuisine = tile.dataset.pickCuisine;
    if (!state.cuisines.includes(cuisine)) {
      state.cuisines.push(cuisine);
      renderCuisines();
    }
    document.getElementById('planner-section').scrollIntoView({ behavior: 'smooth' });
  });
});

els.mealTypeButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    state.mealType = btn.dataset.mealtype;
    renderMealType();
  });
});

els.budgetInput.addEventListener('input', (e) => {
  const val = Number(e.target.value);
  if (Number.isFinite(val)) {
    state.budget = Math.max(0, Math.round(val));
    els.budgetFormatted.textContent = formatWon(state.budget);
    els.summaryBudget.textContent = `${formatWon(state.budget)} 이하`;
    els.budgetRange.value = Math.min(50000, Math.max(5000, state.budget));
  }
});

els.budgetRange.addEventListener('input', (e) => {
  state.budget = Number(e.target.value);
  renderBudget();
});

els.budgetPresetBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    state.budget = Number(btn.dataset.budget);
    renderBudget();
  });
});

els.addIngredientBtn.addEventListener('click', () => {
  addIngredientsFromText(els.ingredientInput.value);
  els.ingredientInput.value = '';
  els.ingredientInput.focus();
});

els.ingredientInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addIngredientsFromText(els.ingredientInput.value);
    els.ingredientInput.value = '';
  }
});

els.clearIngredientsBtn.addEventListener('click', () => {
  state.ingredients = [];
  renderIngredients();
});

els.quickIngredientBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const ing = btn.dataset.ing;
    if (state.ingredients.includes(ing)) {
      state.ingredients = state.ingredients.filter((item) => item !== ing);
    } else {
      state.ingredients.push(ing);
    }
    renderIngredients();
  });
});

els.presetChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    const preset = chip.dataset.preset;
    if (preset === 'healthy-korean') {
      state.cuisines = ['한식'];
      state.mealType = '건강식';
      state.budget = 12000;
      state.ingredients = ['두부', '계란', '양파', '시금치'];
    } else if (preset === 'quick-western') {
      state.cuisines = ['양식'];
      state.mealType = '간편식';
      state.budget = 10000;
      state.ingredients = ['계란', '토마토', '마늘', '양파'];
    } else if (preset === 'hearty-mix') {
      state.cuisines = ['한식', '중식', '일식'];
      state.mealType = '든든한 식사';
      state.budget = 18000;
      state.ingredients = ['돼지고기', '김치', '대파', '밥'];
    }
    renderCuisines();
    renderMealType();
    renderBudget();
    renderIngredients();
    showFormError('');
  });
});

els.recommendForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (state.isLoading) return;

  showFormError('');

  if (state.cuisines.length === 0) {
    showFormError('음식 취향을 최소 1가지 이상 선택해 주세요.');
    return;
  }

  if (!Number.isFinite(state.budget) || state.budget < 3000 || state.budget > 500000) {
    showFormError('하루 식비 예산은 3,000원 이상 500,000원 이하로 입력해 주세요.');
    return;
  }

  setLoading(true);

  try {
    const response = await fetch('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cuisines: state.cuisines,
        budget: state.budget,
        ingredients: state.ingredients,
        mealType: state.mealType,
        previousNames: state.lastMenus.map((m) => m.name),
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || '식단 추천 요청에 실패했습니다.');
    }

    renderRecommendations(data);
  } catch (err) {
    showFormError(err.message || '오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    if (state.lastMenus.length === 0) {
      els.emptyState.classList.remove('hidden');
    } else {
      els.resultsContent.classList.remove('hidden');
    }
  } finally {
    setLoading(false);
  }
});

els.closeModalBtn.addEventListener('click', closeRecipeModal);
els.recipeModal.addEventListener('click', (e) => {
  if (e.target === els.recipeModal) {
    closeRecipeModal();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !els.recipeModal.classList.contains('hidden')) {
    closeRecipeModal();
  }
});

// 초기 렌더링
setTodayLabel();
renderCuisines();
renderMealType();
renderBudget();
renderIngredients();
checkServerHealth();
