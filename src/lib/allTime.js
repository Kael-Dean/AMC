// Report endpoints require a date range, so "all time" sends one wide enough to
// cover every record instead of dropping the params.
export const ALL_TIME_START = "2000-01-01"
export const ALL_TIME_END = "2099-12-31"

function localIso(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** Today in local time (toISOString() is still yesterday before 07:00 in Thailand). */
export const todayIso = () => localIso(new Date())

/** First day of this month, the range a date filter falls back to when all time is switched off. */
export const firstOfMonthIso = () => {
  const d = new Date()
  return localIso(new Date(d.getFullYear(), d.getMonth(), 1))
}

/**
 * End of an all-time report range: today, not ALL_TIME_END. Reports read closing
 * balances at end_date, and a far-future date has no stock row, so the closing
 * balance would come out 0.
 */
export const allTimeEnd = () => todayIso()
