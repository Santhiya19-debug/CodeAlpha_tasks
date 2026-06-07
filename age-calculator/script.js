/**
 * Age Calculator — script.js
 * Author: Internship Project
 *
 * Handles:
 *  - Exact age calculation (years, months, days)
 *  - Input validation (empty, future date)
 *  - DOM manipulation to show results
 *  - Dark/Light theme toggle with localStorage persistence
 *  - Restoring last saved date of birth on page load
 */

// ── DOM References ────────────────────────────────────────
const dobInput       = document.getElementById('dob-input');
const calculateBtn   = document.getElementById('calculate-btn');
const resultsSection = document.getElementById('results-section');
const inputError     = document.getElementById('input-error');
const themeToggle    = document.getElementById('theme-toggle');
const toggleIcon     = document.getElementById('toggle-icon');

// Result display elements
const yearsValue     = document.getElementById('years-value');
const monthsValue    = document.getElementById('months-value');
const daysValue      = document.getElementById('days-value');
const bornOnText     = document.getElementById('born-on-text');
const totalDaysText  = document.getElementById('total-days-text');

// ── Constants ─────────────────────────────────────────────
const STORAGE_KEY_DOB   = 'agecalc_dob';
const STORAGE_KEY_THEME = 'agecalc_theme';

// Full names for formatting the "born on" line
const WEEKDAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTH_NAMES   = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];

// ── Initialisation ────────────────────────────────────────

/**
 * Run once on page load:
 * - Restrict the date picker to today and earlier
 * - Restore saved DOB from localStorage
 * - Restore saved theme
 */
function init() {
  const today = getTodayString();
  dobInput.setAttribute('max', today);

  restoreTheme();
  restoreDOB();
}

// ── Age Calculation ───────────────────────────────────────

/**
 * Returns today's date as "YYYY-MM-DD" (the format <input type="date"> uses).
 */
function getTodayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calculates exact age between a birth date and today.
 * Accounts for whether the birthday has occurred yet this year/month.
 *
 * @param {Date} birthDate
 * @returns {{ years: number, months: number, days: number, totalDays: number }}
 */
function calculateAge(birthDate) {
  const today = new Date();

  let years  = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth()    - birthDate.getMonth();
  let days   = today.getDate()     - birthDate.getDate();

  // If day difference is negative, borrow from months
  if (days < 0) {
    months--;
    // Get the last day of the previous month relative to today
    const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    days += prevMonth.getDate();
  }

  // If month difference is negative, borrow from years
  if (months < 0) {
    years--;
    months += 12;
  }

  // Total days lived (floor to avoid partial-day floats)
  const msPerDay   = 1000 * 60 * 60 * 24;
  const totalDays  = Math.floor((today - birthDate) / msPerDay);

  return { years, months, days, totalDays };
}

/**
 * Formats a Date object as "Monday, 1 January 2000".
 * @param {Date} date
 * @returns {string}
 */
function formatBirthDate(date) {
  const weekday = WEEKDAY_NAMES[date.getDay()];
  const day     = date.getDate();
  const month   = MONTH_NAMES[date.getMonth()];
  const year    = date.getFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
}

/**
 * Formats a large number with commas (e.g. 9123 → "9,123").
 * @param {number} n
 * @returns {string}
 */
function formatNumber(n) {
  return n.toLocaleString();
}

// ── Validation ────────────────────────────────────────────

/**
 * Validates the date input.
 * Returns an error string if invalid, or null if valid.
 * @param {string} value - raw value from the input
 * @returns {string|null}
 */
function validateInput(value) {
  if (!value) {
    return 'Please select your date of birth.';
  }

  const selected = new Date(value + 'T00:00:00'); // avoid timezone shift
  const today    = new Date();
  today.setHours(0, 0, 0, 0);

  if (selected > today) {
    return 'Date of birth cannot be in the future.';
  }

  // Sanity check: no one is older than 150 years
  const minYear = today.getFullYear() - 150;
  if (selected.getFullYear() < minYear) {
    return `Please enter a valid date after ${minYear}.`;
  }

  return null;
}

// ── UI Helpers ────────────────────────────────────────────

/**
 * Shows a validation error below the input.
 * @param {string} message
 */
function showError(message) {
  inputError.textContent = message;
  inputError.classList.add('visible');
  dobInput.classList.add('is-error');
  dobInput.setAttribute('aria-invalid', 'true');
}

/**
 * Clears any visible validation error.
 */
function clearError() {
  inputError.textContent = '';
  inputError.classList.remove('visible');
  dobInput.classList.remove('is-error');
  dobInput.removeAttribute('aria-invalid');
}

/**
 * Populates the results section and triggers entry animations.
 * @param {{ years, months, days, totalDays }} age
 * @param {Date} birthDate
 */
function displayResults(age, birthDate) {
  // Update numbers
  yearsValue.textContent  = age.years;
  monthsValue.textContent = age.months;
  daysValue.textContent   = age.days;

  // Formatted detail lines
  bornOnText.innerHTML  = `Born on <strong>${formatBirthDate(birthDate)}</strong>`;
  totalDaysText.textContent = `That's ${formatNumber(age.totalDays)} days you've been alive! 🎉`;

  // Show the section and re-trigger animations
  resultsSection.classList.remove('hidden');

  // Remove then re-add animate class to replay animation on recalculate
  const statCards = document.querySelectorAll('.stat-card');
  statCards.forEach(card => {
    card.classList.remove('animate');
    void card.offsetWidth; // force reflow so animation restarts
    card.classList.add('animate');
  });
}

// ── Main Handler ──────────────────────────────────────────

/**
 * Called when the user clicks "Calculate Age".
 * Validates input, calculates age, and renders results.
 */
function handleCalculate() {
  clearError();

  const value = dobInput.value;
  const error = validateInput(value);

  if (error) {
    showError(error);
    resultsSection.classList.add('hidden');
    return;
  }

  // Parse carefully with local midnight to avoid timezone issues
  const birthDate = new Date(value + 'T00:00:00');
  const age       = calculateAge(birthDate);

  displayResults(age, birthDate);

  // Remember this date for next visit
  localStorage.setItem(STORAGE_KEY_DOB, value);
}

// ── Theme Management ──────────────────────────────────────

/**
 * Applies the given theme ('light' or 'dark') to the document.
 * Saves preference to localStorage.
 * @param {string} theme
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  toggleIcon.textContent = (theme === 'dark') ? '☀️' : '🌙';
  localStorage.setItem(STORAGE_KEY_THEME, theme);
}

/**
 * Reads the saved theme and applies it on page load.
 * Defaults to 'light' if nothing is stored.
 */
function restoreTheme() {
  const saved = localStorage.getItem(STORAGE_KEY_THEME) || 'light';
  applyTheme(saved);
}

/**
 * Toggles between light and dark themes.
 */
function handleThemeToggle() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ── Restore Last DOB ──────────────────────────────────────

/**
 * Fills the date input with the last saved DOB from localStorage.
 * Automatically runs the calculation if a valid date is found.
 */
function restoreDOB() {
  const saved = localStorage.getItem(STORAGE_KEY_DOB);
  if (!saved) return;

  dobInput.value = saved;

  // Auto-calculate only if the saved date is still valid
  const error = validateInput(saved);
  if (!error) {
    const birthDate = new Date(saved + 'T00:00:00');
    const age       = calculateAge(birthDate);
    displayResults(age, birthDate);
  }
}

// ── Event Listeners ───────────────────────────────────────

calculateBtn.addEventListener('click', handleCalculate);

// Allow pressing Enter inside the date input to trigger calculation
dobInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleCalculate();
});

// Clear error styling as soon as the user changes the value
dobInput.addEventListener('change', () => {
  if (inputError.classList.contains('visible')) clearError();
});

themeToggle.addEventListener('click', handleThemeToggle);

// ── Bootstrap ─────────────────────────────────────────────
init();
