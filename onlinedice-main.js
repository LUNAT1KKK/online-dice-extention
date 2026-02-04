// MADE BY GOD
const ext = typeof browser !== 'undefined' ? browser : chrome;

const DEBUG = true;

// ======================= TIMING CONFIG ================
const DICE_REPLACE_DELAY = 10;

// ======================= HISTORY CONFIG ===============
const HISTORY_SIZE = 6;

// ======================= LOG ==========================
function log(...args) {
  if (DEBUG) console.log('[Dice]', ...args);
}

// ======================= LOCAL IMAGES =================
const diceImages = {};
for (let i = 1; i <= 6; i++) {
  diceImages[i] = ext.runtime.getURL(`dice/smallDice-${i}.png`);
}
Object.values(diceImages).forEach(src => {
  const img = new Image();
  img.src = src;
});

// ======================= GAME STATE ===================
let playerDice = null;
let roundHistory = [];
let fakeTotals = [];
let historyIndex = 0;

const gameState = {
  wins: 0,
  losses: 0
};

// ======================= KEYBOARD =====================
function modifierPressed(e) {
  return e.ctrlKey || e.metaKey || e.shiftKey;
}

document.addEventListener('keydown', e => {
  if (!modifierPressed(e)) return;

  const combos = {
    Digit1: [0, 1],
    Digit2: [0, 2],
    Digit3: [0, 3],
    Digit4: [1, 2],
    Digit5: [1, 3],
    Digit6: [2, 3]
  };

  if (!combos[e.code]) return;

  playerDice = combos[e.code];
  log('Dice pair:', playerDice.map(i => i + 1));

  roundHistory = [];
  fakeTotals = [];
  historyIndex = 0;
  gameState.wins = 0;
  gameState.losses = 0;

  // восстановление нулей в истории
  document.querySelectorAll('#history input').forEach(el => {
    el.value = 0;
    el.style.color = 'rgb(75, 80, 87)';
  });
});

// ======================= DICE HELPERS =================
function getDiceElements() {
  return [...document.querySelectorAll('#diceField > span[id^="dice"]')];
}

// ======================= DYNAMIC OUTCOME ==============
function decideOutcomeDynamic() {
  if (gameState.wins >= 3) {
    gameState.wins = 0;
    gameState.losses = 0;
    roundHistory = [];
  }

  const r = Math.random();

  if (r < 0.15) {
    roundHistory.push('draw');
    log('Round outcome: draw');
    return 'draw';
  }

  if (gameState.losses < 2 && r < 0.45) {
    roundHistory.push('lose');
    log('Round outcome: lose');
    return 'lose';
  }

  roundHistory.push('win');
  log('Round outcome: win');
  return 'win';
}

// ======================= GENERATE DICE ================
function generateDiceValues(outcome) {
  const dice = getDiceElements();
  const count = dice.length;

  let values;
  let attempt = 0;

  do {
    attempt++;
    if (attempt > 120) {
      return Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1);
    }

    values = Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1);

    const mySum = values[playerDice[0]] + values[playerDice[1]];
    const enemy = [...Array(count).keys()].filter(i => !playerDice.includes(i));
    const enemySum = values[enemy[0]] + values[enemy[1]];
    const diff = mySum - enemySum;

    if (outcome === 'lose') {
      if (diff === -1 || diff === -2) return values;
    }

    if (outcome === 'draw' && diff === 0) {
      return values;
    }

    if (outcome === 'win') {
      if (Math.random() < 0.6) {
        if (diff === 1) return values;
      } else {
        if (diff >= 2 && diff <= 4) return values;
      }
    }

  } while (true);
}

// ======================= APPLY SINGLE DIE =============
function applySingleDie(dieEl, value) {
  const img = dieEl.querySelector('img');
  const val = dieEl.querySelector('.value');

  img.src = diceImages[value];
  val.textContent = value;
}

// ======================= HISTORY WRITE ================
function writeHistoryValue(value) {
  const inputs = document.querySelectorAll('#history input');
  if (!inputs.length) return;

  const el = inputs[historyIndex % HISTORY_SIZE];
  el.value = value ?? 0;
  el.style.color = 'rgb(75, 80, 87)';

  historyIndex++;
}
// ======================= HISTORY PROTECTOR ===========
let historyObserverStarted = false;

function protectHistory() {
  if (historyObserverStarted) return;
  historyObserverStarted = true;

  const history = document.getElementById('history');
  if (!history) return;

  const observer = new MutationObserver(() => {
    const inputs = history.querySelectorAll('input');

    inputs.forEach((input, i) => {
      const fake = fakeTotals[i];

      // если у нас есть фейковое значение — оно главнее
      if (fake !== undefined && input.value != fake) {
        input.value = fake;
        input.style.color = 'rgb(75, 80, 87)';
      }

      // если слот еще не использовался — показываем 0
      if (fake === undefined && input.value !== '0') {
        input.value = 0;
        input.style.color = 'rgb(75, 80, 87)';
      }
    });
  });

  observer.observe(history, {
    subtree: true,
    attributes: true,
    childList: true,
    characterData: true
  });

  log('History protector enabled');
}

// ======================= FINALIZE ROUND ===============
function finalizeRound(values, outcome) {
  const total = values.reduce((a, b) => a + b, 0);

  const totalInput = document.getElementById('total');
  if (totalInput) totalInput.value = total;

  fakeTotals.push(total);
  writeHistoryValue(total);

  if (outcome === 'win') gameState.wins++;
  if (outcome === 'lose') gameState.losses++;

  log('Round finished:', outcome, values, 'History:', fakeTotals);
}

// ======================= OBSERVER =====================
function observeDicePerDie() {
  const dice = getDiceElements();
  if (!dice.length) return;
  if (playerDice === null) return;

  const outcome = decideOutcomeDynamic();
  const values = generateDiceValues(outcome);

  let finishedCount = 0;
  const applied = new Set();

  dice.forEach((die, index) => {
    const img = die.querySelector('img');
    if (!img) return;

    let timeout;
    const observer = new MutationObserver(() => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        observer.disconnect();
        finishedCount++;

        if (!applied.has(index)) {
          applied.add(index);
          setTimeout(() => {
            applySingleDie(die, values[index]);
          }, DICE_REPLACE_DELAY);
        }

        if (finishedCount === dice.length) {
          finalizeRound(values, outcome);
        }
      }, 120);
    });

    observer.observe(img, { attributes: true, attributeFilter: ['src'] });
  });
}

// ======================= BUTTON HOOK ==================
function hookButton() {
  const btn = document.querySelector('button[onclick*="roll"]');
  if (!btn) {
    setTimeout(hookButton, 200);
    return;
  }

  const originalClick = btn.onclick;
  btn.onclick = null;

  btn.addEventListener('click', e => {
    if (originalClick) originalClick.call(btn, e);
    observeDicePerDie();
  }, true);

  log('Roll button hooked');
}

// ======================= HIDE NATIVE HISTORY ==========
function hideNativeHistory() {
  const style = document.createElement('style');
  style.textContent = `
    #history input {
      caret-color: transparent !important;
    }
  `;
  document.head.appendChild(style);
  log('Native history isolated');
}

// ======================= INIT =========================
if (window.location.href.includes('rollDice')) {
  hideNativeHistory();
  hookButton();
  protectHistory();
  log('Dice extension loaded');
}
