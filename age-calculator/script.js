/**
 * Age Calculator — script.js
 * Author: Internship Project
 *
 * Handles:
 *  - Exact age calculation (years, months, days)
 *  - Input validation (empty, future date, out-of-range)
 *  - Two input modes: native date picker & manual DD/MM/YYYY text fields
 *  - Auto-advance focus between manual fields (day → month → year)
 *  - Edit Date: scroll back to input with current DOB pre-filled
 *  - Try Another Date: full reset, clears localStorage
 *  - Dark/Light theme toggle with localStorage persistence
 *  - Restore last saved DOB on page load
 */

// ── DOM References ────────────────────────────────────────
const dobInput       = document.getElementById('dob-input');
const calculateBtn   = document.getElementById('calculate-btn');
const resultsSection = document.getElementById('results-section');
const resultDivider  = document.getElementById('result-divider');
const inputError     = document.getElementById('input-error');
const themeToggle    = document.getElementById('theme-toggle');
const toggleIcon     = document.getElementById('toggle-icon');

// Input mode tabs
const tabPicker      = document.getElementById('tab-picker');
const tabText        = document.getElementById('tab-text');
const panelPicker    = document.getElementById('panel-picker');
const panelText      = document.getElementById('panel-text');

// Manual input fields
const manualDay      = document.getElementById('manual-day');
const manualMonth    = document.getElementById('manual-month');
const manualYear     = document.getElementById('manual-year');

// Result display elements
const yearsValue     = document.getElementById('years-value');
const monthsValue    = document.getElementById('months-value');
const daysValue      = document.getElementById('days-value');
const bornOnText     = document.getElementById('born-on-text');
const totalDaysText  = document.getElementById('total-days-text');

// Post-result action buttons
const editBtn        = document.getElementById('edit-btn');
const resetBtn       = document.getElementById('reset-btn');

// ── Constants ─────────────────────────────────────────────
const STORAGE_KEY_DOB   = 'agecalc_dob';
const STORAGE_KEY_THEME = 'agecalc_theme';

const WEEKDAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTH_NAMES   = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];

// Tracks which input mode is active: 'picker' or 'text'
let activeMode = 'picker';

// ── Initialisation ────────────────────────────────────────

function init() {
  dobInput.setAttribute('max', getTodayString());
  restoreTheme();
  restoreDOB();
}

// ── Utility: Date Helpers ─────────────────────────────────

/** Returns today as "YYYY-MM-DD" — the value format used by <input type="date">. */
function getTodayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calculates exact age between a birth date and today.
 * Borrows correctly so days/months never go negative.
 *
 * @param {Date} birthDate
 * @returns {{ years: number, months: number, days: number, totalDays: number }}
 */
function calculateAge(birthDate) {
  const today = new Date();

  let years  = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth()    - birthDate.getMonth();
  let days   = today.getDate()     - birthDate.getDate();

  if (days < 0) {
    months--;
    // Days in the month before today's month
    const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    days += prevMonth.getDate();
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  const msPerDay  = 1000 * 60 * 60 * 24;
  const totalDays = Math.floor((today - birthDate) / msPerDay);

  return { years, months, days, totalDays };
}

/** Formats a Date as "Monday, 1 January 2000". */
function formatBirthDate(date) {
  const weekday = WEEKDAY_NAMES[date.getDay()];
  const day     = date.getDate();
  const month   = MONTH_NAMES[date.getMonth()];
  const year    = date.getFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
}

/** Adds comma separators to a number (9123 → "9,123"). */
function formatNumber(n) {
  return n.toLocaleString();
}

// ── Input Mode Switching ──────────────────────────────────

/**
 * Switches the visible input panel and updates ARIA tab state.
 * @param {'picker'|'text'} mode
 */
function switchMode(mode) {
  activeMode = mode;

  // Update tab button states
  tabPicker.classList.toggle('active', mode === 'picker');
  tabText.classList.toggle('active',   mode === 'text');
  tabPicker.setAttribute('aria-selected', mode === 'picker');
  tabText.setAttribute('aria-selected',   mode === 'text');

  // Show/hide panels
  panelPicker.classList.toggle('hidden', mode !== 'picker');
  panelText.classList.toggle('hidden',   mode !== 'text');

  clearError();

  // Focus the first field of the newly visible panel
  if (mode === 'picker') {
    dobInput.focus();
  } else {
    manualDay.focus();
  }
}

// ── Manual Input: Auto-advance & Numeric Filtering ────────

/**
 * Strips non-numeric characters from a text input as the user types.
 * Advances focus to the next field once the max length is reached.
 *
 * @param {HTMLInputElement} field   - current input
 * @param {HTMLInputElement|null} next - input to focus after, or null
 */
function handleManualInput(field, next) {
  // Keep only digits
  field.value = field.value.replace(/\D/g, '');

  // Auto-jump to the next field when the slot is full
  if (next && field.value.length >= parseInt(field.getAttribute('maxlength'), 10)) {
    next.focus();
  }
}

// ── Validation ────────────────────────────────────────────

/**
 * Validates a date given as a "YYYY-MM-DD" string.
 * Returns an error message string, or null when valid.
 * @param {string} value
 * @returns {string|null}
 */
function validateDateString(value) {
  if (!value) return 'Please enter your date of birth.';

  const selected = new Date(value + 'T00:00:00');

  // Invalid date object (e.g. 31 Feb)
  if (isNaN(selected.getTime())) return 'That date does not exist. Please check day and month.';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (selected > today) return 'Date of birth cannot be in the future.';

  const minYear = today.getFullYear() - 150;
  if (selected.getFullYear() < minYear) return `Please enter a valid year after ${minYear}.`;

  return null;
}

/**
 * Reads and validates the active input mode, returning a
 * "YYYY-MM-DD" string on success or null (+ shows error) on failure.
 * @returns {string|null}
 */
function getValidatedDateValue() {
  if (activeMode === 'picker') {
    const value = dobInput.value;
    const error = validateDateString(value);
    if (error) { showError(error, 'picker'); return null; }
    return value;
  }

  // Manual mode — build YYYY-MM-DD from the three fields
  const d = manualDay.value.trim();
  const m = manualMonth.value.trim();
  const y = manualYear.value.trim();

  if (!d || !m || !y) {
    showError('Please fill in the day, month, and year.', 'text');
    return null;
  }

  if (y.length !== 4) {
    showError('Please enter a 4-digit year (e.g. 1998).', 'text');
    return null;
  }

  const dayNum   = parseInt(d, 10);
  const monthNum = parseInt(m, 10);
  const yearNum  = parseInt(y, 10);

  if (monthNum < 1 || monthNum > 12) {
    showError('Month must be between 01 and 12.', 'text');
    return null;
  }

  if (dayNum < 1 || dayNum > 31) {
    showError('Day must be between 01 and 31.', 'text');
    return null;
  }

  // Zero-pad to "YYYY-MM-DD" for the Date constructor
  const padded = `${y}-${String(monthNum).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
  const error  = validateDateString(padded);
  if (error) { showError(error, 'text'); return null; }

  return padded;
}

// ── UI Helpers ────────────────────────────────────────────

/**
 * Displays a validation error.
 * @param {string} message
 * @param {'picker'|'text'} mode
 */
function showError(message, mode) {
  inputError.textContent = message;
  inputError.classList.add('visible');

  if (mode === 'picker') {
    dobInput.classList.add('is-error');
    dobInput.setAttribute('aria-invalid', 'true');
  } else {
    // Highlight all three manual fields
    [manualDay, manualMonth, manualYear].forEach(f => f.classList.add('is-error'));
  }
}

/** Clears the error state from both input modes. */
function clearError() {
  inputError.textContent = '';
  inputError.classList.remove('visible');

  dobInput.classList.remove('is-error');
  dobInput.removeAttribute('aria-invalid');

  [manualDay, manualMonth, manualYear].forEach(f => {
    f.classList.remove('is-error');
    f.removeAttribute('aria-invalid');
  });
}

/**
 * Fills a date value back into the active input panel.
 * Used by "Edit Date" to pre-populate the fields.
 * @param {string} value - "YYYY-MM-DD"
 */
function fillInputs(value) {
  // Always fill the picker regardless of current mode
  dobInput.value = value;

  // Also fill the manual fields
  const parts  = value.split('-');   // ["YYYY","MM","DD"]
  manualYear.value  = parts[0] || '';
  manualMonth.value = parts[1] ? String(parseInt(parts[1], 10)) : '';
  manualDay.value   = parts[2] ? String(parseInt(parts[2], 10)) : '';
}

/**
 * Renders the results section with animated stat cards.
 * @param {{ years, months, days, totalDays }} age
 * @param {Date} birthDate
 */
function displayResults(age, birthDate) {
  yearsValue.textContent  = age.years;
  monthsValue.textContent = age.months;
  daysValue.textContent   = age.days;

  bornOnText.innerHTML      = `Born on <strong>${formatBirthDate(birthDate)}</strong>`;
  totalDaysText.textContent = `That's ${formatNumber(age.totalDays)} days you've been alive! 🎉`;

  // Show divider and results section
  resultDivider.style.display = 'block';
  resultsSection.classList.remove('hidden');

  // Replay entry animations on every calculation
  document.querySelectorAll('.stat-card').forEach(card => {
    card.classList.remove('animate');
    void card.offsetWidth; // force reflow
    card.classList.add('animate');
  });
}

/** Hides the results section and the divider above it. */
function hideResults() {
  resultsSection.classList.add('hidden');
  resultDivider.style.display = 'none';
}

// ── Main Handler ──────────────────────────────────────────

/** Called on "Calculate Age" click (or Enter key). */
function handleCalculate() {
  clearError();

  const value = getValidatedDateValue();
  if (!value) return; // validation already showed the error

  const birthDate = new Date(value + 'T00:00:00');
  const age       = calculateAge(birthDate);

  displayResults(age, birthDate);

  // Save for next visit
  localStorage.setItem(STORAGE_KEY_DOB, value);
}

// ── Post-Result Actions ───────────────────────────────────

/**
 * "Edit Date" — keeps results visible but scrolls up and focuses
 * the input so the user can tweak the date without losing context.
 */
function handleEdit() {
  const saved = localStorage.getItem(STORAGE_KEY_DOB);
  if (saved) fillInputs(saved);

  // Scroll the card top into view smoothly
  document.querySelector('.card').scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Focus the right field after scroll settles
  setTimeout(() => {
    if (activeMode === 'picker') dobInput.focus();
    else manualDay.focus();
  }, 350);
}

/**
 * "Try Another Date" — wipes everything so the user can start fresh.
 * Also removes the saved DOB from localStorage.
 */
function handleReset() {
  // Clear all inputs
  dobInput.value    = '';
  manualDay.value   = '';
  manualMonth.value = '';
  manualYear.value  = '';

  clearError();
  hideResults();

  // Remove saved date so it won't be auto-restored next load
  localStorage.removeItem(STORAGE_KEY_DOB);

  // Scroll up and focus
  document.querySelector('.card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => {
    if (activeMode === 'picker') dobInput.focus();
    else manualDay.focus();
  }, 350);
}

// ── Theme Management ──────────────────────────────────────

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  toggleIcon.textContent = (theme === 'dark') ? '☀️' : '🌙';
  localStorage.setItem(STORAGE_KEY_THEME, theme);
}

function restoreTheme() {
  const saved = localStorage.getItem(STORAGE_KEY_THEME) || 'light';
  applyTheme(saved);
}

function handleThemeToggle() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ── Restore Last DOB ──────────────────────────────────────

/** On page load, re-fill inputs with the last saved date and show results. */
function restoreDOB() {
  const saved = localStorage.getItem(STORAGE_KEY_DOB);
  if (!saved) return;

  fillInputs(saved);

  const error = validateDateString(saved);
  if (!error) {
    const birthDate = new Date(saved + 'T00:00:00');
    displayResults(calculateAge(birthDate), birthDate);
  }
}

// ── Event Listeners ───────────────────────────────────────

// Primary action
calculateBtn.addEventListener('click', handleCalculate);

// Enter key in the picker input
dobInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleCalculate();
});

// Enter key in the last manual field
manualYear.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleCalculate();
});

// Clear errors as soon as the user edits any field
dobInput.addEventListener('change', () => {
  if (inputError.classList.contains('visible')) clearError();
});

[manualDay, manualMonth, manualYear].forEach(field => {
  field.addEventListener('input', () => {
    if (inputError.classList.contains('visible')) clearError();
  });
});

// Auto-advance focus: day → month → year
manualDay.addEventListener('input',   () => handleManualInput(manualDay,   manualMonth));
manualMonth.addEventListener('input', () => handleManualInput(manualMonth, manualYear));
manualYear.addEventListener('input',  () => handleManualInput(manualYear,  null));

// Tab switching
tabPicker.addEventListener('click', () => switchMode('picker'));
tabText.addEventListener('click',   () => switchMode('text'));

// Keyboard navigation within the tab bar (arrow keys)
[tabPicker, tabText].forEach(tab => {
  tab.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      switchMode(activeMode === 'picker' ? 'text' : 'picker');
    }
  });
});

// Post-result actions
editBtn.addEventListener('click',  handleEdit);
resetBtn.addEventListener('click', handleReset);

// Theme
themeToggle.addEventListener('click', handleThemeToggle);

// ── Bootstrap ─────────────────────────────────────────────
init();
