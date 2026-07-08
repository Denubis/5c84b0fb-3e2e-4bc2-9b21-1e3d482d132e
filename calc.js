// Zero-dependency finance projection. NO personal data lives here — every figure is
// supplied by the caller (read from the URL fragment in the browser). Pure and
// deterministic: given the same params and `now`, it always returns the same string.
//
// All calendar maths is done in UTC so the result never depends on the runtime's
// timezone. Pay/loan events are anchored at 00:00Z; Sydney (UTC+10/+11) always lands
// on the same calendar date, so UTC date components equal the intended local date.

const DAY_MS = 86_400_000;
const FORTNIGHT_ANCHOR = Date.UTC(2022, 0, 12); // fortnightly pay cadence anchor
const MONTHLY_ANCHOR_DAY = 10;                   // monthly interval falls on the 10th
const AVERAGE_DAYS_IN_YEAR = 365.25;
const ROLLING_DAYS = 30;
const NBSP = String.fromCharCode(160); // original app pads the spend line with non-breaking spaces

const pad = (n) => String(n).padStart(2, "0");

// Every parameter, with a human description. Order is display order in the help panel.
export const PARAMS = [
  { key: "base", label: "Base annual income" },
  { key: "by",   label: "Base year (income anchor)" },
  { key: "om",   label: "Original monthly component" },
  { key: "mo",   label: "Current monthly component" },
  { key: "yr",   label: "Annual increment" },
  { key: "fort", label: "Fortnightly inflow" },
  { key: "sav",  label: "Annual savings target" },
  { key: "loan", label: "Loan balance (positive number)" },
  { key: "offset", label: "Offset balance" },
  { key: "pmt",  label: "Monthly payment" },
  { key: "rate", label: "Interest rate, APR as a decimal (e.g. 0.0541)" },
  { key: "infl", label: "Annual inflation as a decimal (e.g. 0.02)" },
  { key: "sy",   label: "Loan projection start year" },
  { key: "sm",   label: "Loan projection start month (0 = Jan)" },
];

const INCOME_KEYS = ["base", "by", "om", "mo", "yr"];
const SPEND_KEYS = ["fort", "sav"];
const LOAN_KEYS = ["rate", "loan", "pmt", "sav", "offset", "infl", "sy", "sm"];

function daysInMonthUTC(y, m) {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

function dayOfYear(y, m, d) {
  return Math.round((Date.UTC(y, m, d) - Date.UTC(y, 0, 1)) / DAY_MS) + 1;
}

function fmtMMdd(instant) {
  return `${pad(instant.getUTCMonth() + 1)}-${pad(instant.getUTCDate())}`;
}

function fmtMMyy(y, m) {
  const d = new Date(Date.UTC(y, m, 1)); // normalises month overflow
  return `${pad(d.getUTCMonth() + 1)}-${String(d.getUTCFullYear()).slice(-2)}`;
}

// Fortnightly pay instants strictly after `now` and before `end`, like RRULE
// FREQ=WEEKLY;INTERVAL=2 from the anchor.
function fortnightlyEvents(now, end) {
  const out = [];
  for (let t = FORTNIGHT_ANCHOR; t < end; t += 14 * DAY_MS) {
    if (t > now) out.push(new Date(t));
  }
  return out;
}

// Monthly instants on the 10th, strictly after `now` and before `end`, like RRULE FREQ=MONTHLY.
function monthlyEvents(now, end) {
  const out = [];
  const endYear = new Date(end).getUTCFullYear();
  for (let y = 2022; y <= endYear; y++) {
    for (let m = 0; m < 12; m++) {
      const t = Date.UTC(y, m, MONTHLY_ANCHOR_DAY);
      if (t > now && t < end) out.push(new Date(t));
    }
  }
  return out;
}

// Projected income (in $k) at a given pay date. Mirrors the original `calc()`.
function income(instant, p) {
  const y = instant.getUTCFullYear();
  const m = instant.getUTCMonth();
  const d = instant.getUTCDate();

  const YEAR = p.yr + (p.om * 12 - p.mo * 12);
  const curBase = p.base + YEAR * (y - p.by);

  const yearFraction = dayOfYear(y, m, d) / dayOfYear(y, 11, 31);

  const som = new Date(Date.UTC(y, m, d - 10)); // start-of-month marker, 10 days back
  const eom = daysInMonthUTC(som.getUTCFullYear(), som.getUTCMonth());

  const amount = curBase + YEAR * yearFraction + p.mo * (som.getUTCDate() / eom);
  return (Math.round((amount / 1000) * 10) / 10).toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

// 30-day rolling spend figure. Mirrors `thirty_day_rolling_amount()`: "30" + space + NBSP + value.
function rollingSpend(p) {
  const amount = ((p.fort * 26 - p.sav) / AVERAGE_DAYS_IN_YEAR) * ROLLING_DAYS;
  const rounded = (Math.round(amount / 50) * 50) / 1000;
  return `30 ${NBSP}${rounded}`;
}

// Months until the offset-mortgage is paid off. Mirrors `time_remaining_until_payoff()`.
function monthsToPayoff(p, now) {
  const dailyRate = p.rate / AVERAGE_DAYS_IN_YEAR;
  let loan = -Math.abs(p.loan); // supplied as a positive balance; internally negative
  let offset = p.offset;
  let adjustedSavings = p.sav;
  let year = p.sy;
  let month = p.sm;
  let monthsRemaining = 0;

  while (loan + offset < 0 && year < 2040 && monthsRemaining < 500) {
    const monthlySavings = adjustedSavings / 12;
    offset += monthlySavings;

    const daysInMonth = daysInMonthUTC(year, month);
    const interest = (loan - offset) * dailyRate * daysInMonth;
    loan = loan + interest + (p.pmt + monthlySavings);

    month++;
    if (month > 11) {
      month = 0;
      year++;
      adjustedSavings += adjustedSavings * p.infl;
    }
    monthsRemaining++;
  }

  const monthsSinceStart =
    (now.getFullYear() - p.sy) * 12 + (now.getMonth() - p.sm);
  return monthsRemaining - monthsSinceStart;
}

function has(p, keys) {
  return keys.every((k) => typeof p[k] === "number" && !Number.isNaN(p[k]));
}

// Parse the URL fragment (or any query-ish string) into a numeric param object.
export function parseParams(fragment) {
  const p = {};
  const src = (fragment || "").replace(/^#/, "");
  for (const [k, v] of new URLSearchParams(src)) {
    const n = parseFloat(v);
    if (!Number.isNaN(n)) p[k] = n;
  }
  return p;
}

// Build the exact multi-line output. Sections render only when their params are present,
// so a partial fragment (e.g. loan-only) still works. With every param supplied the
// result is byte-identical to the original app.
export function computeOutput(p, now) {
  now = now || new Date();
  let out = "";

  if (has(p, INCOME_KEYS)) {
    const end = Date.UTC(now.getUTCFullYear(), 11, 31);
    const endOfYear = new Date(end);
    const events = [
      ...fortnightlyEvents(now.getTime(), end),
      ...monthlyEvents(now.getTime(), end),
      endOfYear,
    ].sort((a, b) => a.getTime() - b.getTime());

    let counter = 0;
    for (const event of events) {
      counter++;
      if (counter < 4) {
        out += `${fmtMMdd(event)} ${income(event, p)}\n`;
      } else if (counter === events.length) {
        out += `${fmtMMdd(event)} ${income(event, p)}\n`;
      }
    }
  }

  if (has(p, SPEND_KEYS)) {
    out += `${NBSP}${NBSP}${NBSP}${rollingSpend(p)}`;
  }

  if (has(p, LOAN_KEYS)) {
    const months = monthsToPayoff(p, now);
    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    const label = fmtMMyy(now.getFullYear() + years, now.getMonth() + remMonths);
    out += `${out ? "\n" : ""}${label} ${years}y ${remMonths}m`;
  }

  return out;
}
