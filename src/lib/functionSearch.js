// src/lib/functionSearch.js
// ─────────────────────────────────────────────────────────────────────────────
// Thai-aware matching for the header's "find a function" search. Pure and
// dependency-free: no React, no router, no permissions (callers pass isVisible).
//
//   const index = buildSearchIndex([{ id, label, keywords?, weakKeywords? }])
//   searchIndex(index, "แจง", { limit: 8, isVisible: (entry) => true })
//     → [{ entry, display, tier, ranges, keyword, converted }]
//
// How a query is tried (a later step runs only if the earlier one found no label):
//   1. as typed      exact > prefix > word-start > substring > keyword > all tokens
//   2. other layout  the same tiers on the Kedmanee ↔ QWERTY conversion, listed after
//   3. fuzzy         Damerau-Levenshtein, only when 1 and 2 found nothing at all
//
//   ranges   [[start, end]] into `display` (the NFC label), widened so they never split
//            a Thai glyph cluster. null when the label itself did not match.
//   keyword  the keyword that matched when the label did not.
// ─────────────────────────────────────────────────────────────────────────────

const TIER = { EXACT: 0, PREFIX: 1, WORD: 2, SUBSTRING: 3, KEYWORD: 4, TOKENS: 5, CONVERTED: 10, FUZZY: 20 }

// Marks that sit on a Thai base letter: a highlight must not start or end between them and it.
const THAI_COMBINING = /[ัิ-ฺ็-๎]/
// Tone marks and diacritics a person may skip when typing fast: ่ ้ ๊ ๋ ์ ็ ฺ ํ ๎
const THAI_FOLDED = /[ฺ็-๎]/
const THAI_TONE = /[่-๋]/
const THAI_CHAR = /[฀-๿]/
const DROPPED = /[\s\p{P}\p{S}]/u

const SARA_AM = "ำ"
const NIKKHAHIT = "ํ"
const SARA_AA = "า"

/**
 * Search key for `text`: NFC, lowercase, no spaces or punctuation, ำ in one form
 * (ํ + า and ํ + tone + า both become ำ, so น้ำ typed either way compares equal).
 * `map[i]` = index in `display` of key character i.
 */
export function toSearchKey(text) {
  const display = String(text ?? "").normalize("NFC")
  let key = ""
  const map = []
  for (let i = 0; i < display.length; ) {
    const ch = String.fromCodePoint(display.codePointAt(i))
    if (ch === NIKKHAHIT && display[i + 1] === SARA_AA) {
      key += SARA_AM
      map.push(i)
      i += 2
      continue
    }
    if (ch === NIKKHAHIT && THAI_TONE.test(display[i + 1] ?? "") && display[i + 2] === SARA_AA) {
      key += display[i + 1] + SARA_AM
      map.push(i, i)
      i += 3
      continue
    }
    if (!DROPPED.test(ch)) {
      const lower = ch.toLowerCase()
      key += lower
      for (let n = 0; n < lower.length; n++) map.push(i)
    }
    i += ch.length
  }
  return { display, key, map }
}

/** Second key: the search key without tone marks and diacritics, so "แจง" finds "แจ้ง". */
export function foldKey(key, map) {
  let folded = ""
  const foldedMap = []
  for (let i = 0; i < key.length; i++) {
    if (THAI_FOLDED.test(key[i])) continue
    folded += key[i]
    foldedMap.push(map ? map[i] : i)
  }
  return { key: folded, map: foldedMap }
}

// ─── Wrong keyboard layout ───────────────────────────────────────────────────
// Thai Kedmanee (TIS 820-2538) by physical key: [QWERTY character, Thai character].
const KEDMANEE = [
  // Unshifted
  ["`", "_"], ["1", "ๅ"], ["2", "/"], ["3", "-"], ["4", "ภ"], ["5", "ถ"], ["6", "ุ"], ["7", "ึ"],
  ["8", "ค"], ["9", "ต"], ["0", "จ"], ["-", "ข"], ["=", "ช"],
  ["q", "ๆ"], ["w", "ไ"], ["e", "ำ"], ["r", "พ"], ["t", "ะ"], ["y", "ั"], ["u", "ี"], ["i", "ร"],
  ["o", "น"], ["p", "ย"], ["[", "บ"], ["]", "ล"], ["\\", "ฃ"],
  ["a", "ฟ"], ["s", "ห"], ["d", "ก"], ["f", "ด"], ["g", "เ"], ["h", "้"], ["j", "่"], ["k", "า"],
  ["l", "ส"], [";", "ว"], ["'", "ง"],
  ["z", "ผ"], ["x", "ป"], ["c", "แ"], ["v", "อ"], ["b", "ิ"], ["n", "ื"], ["m", "ท"], [",", "ม"],
  [".", "ใ"], ["/", "ฝ"],
  // Shifted
  ["~", "%"], ["!", "+"], ["@", "๑"], ["#", "๒"], ["$", "๓"], ["%", "๔"], ["^", "ู"], ["&", "฿"],
  ["*", "๕"], ["(", "๖"], [")", "๗"], ["_", "๘"], ["+", "๙"],
  ["Q", "๐"], ["W", "\""], ["E", "ฎ"], ["R", "ฑ"], ["T", "ธ"], ["Y", "ํ"], ["U", "๊"], ["I", "ณ"],
  ["O", "ฯ"], ["P", "ญ"], ["{", "ฐ"], ["}", ","], ["|", "ฅ"],
  ["A", "ฤ"], ["S", "ฆ"], ["D", "ฏ"], ["F", "โ"], ["G", "ฌ"], ["H", "็"], ["J", "๋"], ["K", "ษ"],
  ["L", "ศ"], [":", "ซ"], ["\"", "."],
  ["Z", "("], ["X", ")"], ["C", "ฉ"], ["V", "ฮ"], ["B", "ฺ"], ["N", "์"], ["M", "?"], ["<", "ฒ"],
  [">", "ฬ"], ["?", "ฦ"],
]
const LATIN_TO_THAI = new Map(KEDMANEE)
// Only Thai characters convert back: "/" or "," typed on the Thai layout are ambiguous.
const THAI_TO_LATIN = new Map(KEDMANEE.filter(([, th]) => THAI_CHAR.test(th)).map(([en, th]) => [th, en]))

/** `text` retyped on the other layout; "" when no character converts. */
export function convertLayout(text) {
  const raw = String(text ?? "").normalize("NFC")
  const table = THAI_CHAR.test(raw) ? THAI_TO_LATIN : LATIN_TO_THAI
  let out = ""
  let converted = false
  for (const ch of raw) {
    const next = table.get(ch)
    if (next !== undefined) converted = true
    out += next ?? ch
  }
  return converted ? out.normalize("NFC") : ""
}

// ─── Edit distance ───────────────────────────────────────────────────────────

/** Damerau-Levenshtein (optimal string alignment). Returns max + 1 once the bound is exceeded. */
export function damerauLevenshtein(a, b, max = Infinity) {
  if (Math.abs(a.length - b.length) > max) return max + 1
  return alignmentDistance(a, b, max, false)
}

/** Lowest distance between `q` and any part of `text`: finds "เงนเดือน" inside a longer label. */
function bestPartDistance(q, text, max) {
  return alignmentDistance(q, text, max, true)
}

function alignmentDistance(a, b, max, freeEnds) {
  let prev2 = null
  let prev = Array.from({ length: b.length + 1 }, (_, j) => (freeEnds ? 0 : j))
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let d = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, prev2[j - 2] + 1)
      row.push(d)
      if (d < rowMin) rowMin = d
    }
    if (rowMin > max) return max + 1
    prev2 = prev
    prev = row
  }
  const last = freeEnds ? Math.min(...prev) : prev[b.length]
  return last > max ? max + 1 : last
}

/** Edits a query of this length may contain. Below 3 characters fuzzy is off. */
function allowedEdits(length) {
  if (length < 3) return 0
  if (length <= 5) return 1
  if (length <= 9) return 2
  return 3
}

// ─── Index ───────────────────────────────────────────────────────────────────

const segmenter =
  typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter("th", { granularity: "word" }) : null

function splitWords(display) {
  if (segmenter) {
    return [...segmenter.segment(display)].filter((s) => s.isWordLike).map((s) => ({ text: s.segment, index: s.index }))
  }
  return [...display.matchAll(/[^\s\p{P}\p{S}]+/gu)].map((m) => ({ text: m[0], index: m.index }))
}

function indexKeyword(raw) {
  const { key, map } = toSearchKey(raw)
  return key ? { raw, key, fold: foldKey(key, map).key } : null
}

/** Normalised keys for every entry — build once per catalogue, then search many times. */
export function buildSearchIndex(entries) {
  return entries.map((entry, order) => {
    const { display, key, map } = toSearchKey(entry.label)
    const fold = foldKey(key, map)
    const words = splitWords(display)
    return {
      entry,
      order,
      display,
      key,
      map,
      fold: fold.key,
      foldMap: fold.map,
      wordStarts: new Set(words.map((w) => w.index)),
      wordFolds: words.map((w) => {
        const k = toSearchKey(w.text)
        return foldKey(k.key, k.map).key
      }),
      keywords: (entry.keywords ?? []).map(indexKeyword).filter(Boolean),
      weakKeywords: (entry.weakKeywords ?? []).map(indexKeyword).filter(Boolean),
    }
  })
}

// ─── Matching ────────────────────────────────────────────────────────────────

function toQuery(text) {
  const { key, map } = toSearchKey(text)
  const tokens = String(text ?? "")
    .split(/\s+/)
    .map((part) => {
      const k = toSearchKey(part)
      return { key: k.key, fold: foldKey(k.key, k.map).key }
    })
    .filter((t) => t.fold)
  return { key, fold: foldKey(key, map).key, tokens }
}

/** Display range of key[start, end), widened over Thai marks so no glyph cluster is cut. */
function displayRange(display, map, start, end) {
  let from = map[start]
  let to = map[end - 1] + 1
  while (from > 0 && THAI_COMBINING.test(display[from])) from--
  while (to < display.length && THAI_COMBINING.test(display[to])) to++
  return [from, to]
}

// A letter or two inside a word is noise: "ch" in "Branch", or "ลา" in "เล่า" once tones are folded away.
function allowsMidWord(q, folded) {
  if (!THAI_CHAR.test(q)) return q.length >= 3
  return q.length >= (folded ? 3 : 2)
}

function matchIn(q, key, map, rec, bias) {
  if (!q || !key) return null
  const first = key.indexOf(q)
  if (first < 0) return null
  const range = (at) => [displayRange(rec.display, map, at, at + q.length)]
  if (q.length === key.length) return { tier: TIER.EXACT + bias, ranges: range(0) }
  if (first === 0) return { tier: TIER.PREFIX + bias, ranges: range(0) }
  for (let at = first; at >= 0; at = key.indexOf(q, at + 1)) {
    if (rec.wordStarts.has(map[at])) return { tier: TIER.WORD + bias, ranges: range(at) }
  }
  return allowsMidWord(q, bias > 0) ? { tier: TIER.SUBSTRING + bias, ranges: range(first) } : null
}

function matchLabel(rec, query) {
  const strict = matchIn(query.key, rec.key, rec.map, rec, 0)
  if (strict && strict.tier <= TIER.PREFIX) return strict
  const folded = matchIn(query.fold, rec.fold, rec.foldMap, rec, 0.5)
  if (strict && folded) return strict.tier <= folded.tier ? strict : folded
  return strict ?? folded
}

function matchKeywordList(list, query, base) {
  const fold = query.fold
  const midWord = allowsMidWord(query.key, false)
  const foldedMidWord = allowsMidWord(fold, true)
  let best = null
  list.forEach((kw, position) => {
    let step = null
    if (kw.key === query.key) step = 0
    else if (fold && kw.fold === fold) step = 0.05
    else if (kw.key.startsWith(query.key)) step = 0.1
    else if (fold && kw.fold.startsWith(fold)) step = 0.15
    else if (midWord && kw.key.includes(query.key)) step = 0.2
    else if (foldedMidWord && fold && kw.fold.includes(fold)) step = 0.25
    if (step === null) return
    // Keywords are written most-telling first: คลังสินค้า lists "สต๊อก" before ยกมา does.
    step += Math.min(position, 20) * 0.001
    if (!best || step < best.step) best = { step, keyword: kw.raw }
  })
  return best && { tier: TIER.KEYWORD + base + best.step, ranges: null, keyword: best.keyword }
}

function matchKeywords(rec, query) {
  const strong = matchKeywordList(rec.keywords, query, 0)
  if (strong) return strong
  // Long permission sentences: only worth a match once the query is specific.
  return query.fold.length >= 3 ? matchKeywordList(rec.weakKeywords, query, 0.5) : null
}

function matchTokens(rec, query) {
  if (query.tokens.length < 2) return null
  const ranges = []
  for (const token of query.tokens) {
    const at = rec.fold.indexOf(token.fold)
    if (at >= 0) {
      ranges.push(displayRange(rec.display, rec.foldMap, at, at + token.fold.length))
      continue
    }
    if (![...rec.keywords, ...rec.weakKeywords].some((kw) => kw.fold.includes(token.fold))) return null
  }
  return { tier: TIER.TOKENS, ranges: ranges.length ? mergeRanges(ranges) : null }
}

function mergeRanges(ranges) {
  const out = []
  for (const [from, to] of [...ranges].sort((a, b) => a[0] - b[0])) {
    const last = out[out.length - 1]
    if (last && from <= last[1]) last[1] = Math.max(last[1], to)
    else out.push([from, to])
  }
  return out
}

function matchFuzzy(rec, query) {
  const max = allowedEdits(query.fold.length)
  // "P02" must not turn into P22: a code is right or it isn't.
  if (!max || /\d/.test(query.fold)) return null
  // Short queries compare with whole words: "any part of the label" would match almost anything.
  const whole = query.fold.length <= 4
  const distanceTo = (target) =>
    whole ? damerauLevenshtein(query.fold, target, max) : bestPartDistance(query.fold, target, max)

  let best = null
  const consider = (target, keyword, bias) => {
    const distance = distanceTo(target)
    if (distance > max) return
    const tier = TIER.FUZZY + distance + bias
    if (!best || tier < best.tier) best = { tier, ranges: null, keyword }
  }
  if (whole) rec.wordFolds.forEach((w) => consider(w, null, 0))
  consider(rec.fold, null, 0)
  rec.keywords.forEach((kw) => consider(kw.fold, kw.raw, 0.5))
  return best
}

function collect(index, matcher, isVisible, extraTier = 0, converted = false) {
  const hits = []
  for (const rec of index) {
    if (isVisible && !isVisible(rec.entry)) continue
    const m = matcher(rec)
    if (!m) continue
    hits.push({
      entry: rec.entry,
      display: rec.display,
      tier: m.tier + extraTier,
      ranges: m.ranges ?? null,
      keyword: m.keyword ?? null,
      converted,
      length: rec.key.length,
      order: rec.order,
    })
  }
  return hits
}

const byRank = (a, b) => a.tier - b.tier || a.length - b.length || a.order - b.order

const exactTiers = (query) => (rec) => matchLabel(rec, query) ?? matchKeywords(rec, query) ?? matchTokens(rec, query)

/** Ranked hits for `text`. Whitespace or punctuation-only queries match nothing. */
export function searchIndex(index, text, { limit = 8, isVisible } = {}) {
  const raw = String(text ?? "").trim()
  const query = toQuery(raw)

  const hits = query.key ? collect(index, exactTiers(query), isVisible) : []

  // A label match means the layout was right. Without one (nothing, or only an English
  // keyword that happens to contain these letters) the other layout gets a turn.
  if (!hits.some((h) => h.tier < TIER.KEYWORD)) {
    const other = convertLayout(raw)
    const otherQuery = other ? toQuery(other) : null
    if (otherQuery && otherQuery.key.length >= 2) {
      const seen = new Set(hits.map((h) => h.entry.id))
      // Labels and whole or leading keywords only: "ot" is not a typo for the "นะ" inside สถานะ.
      const strongEnough = TIER.CONVERTED + TIER.KEYWORD + 0.2
      for (const hit of collect(index, exactTiers(otherQuery), isVisible, TIER.CONVERTED, true)) {
        if (hit.tier < strongEnough && !seen.has(hit.entry.id)) hits.push(hit)
      }
    }
  }

  const ranked = hits.length || !query.key ? hits : collect(index, (rec) => matchFuzzy(rec, query), isVisible)
  return ranked.sort(byRank).slice(0, limit)
}

/** Splits `display` into [{ text, match }] for rendering a highlight. */
export function highlightParts(display, ranges) {
  if (!ranges?.length) return [{ text: display, match: false }]
  const parts = []
  let at = 0
  for (const [from, to] of ranges) {
    if (from > at) parts.push({ text: display.slice(at, from), match: false })
    parts.push({ text: display.slice(from, to), match: true })
    at = to
  }
  if (at < display.length) parts.push({ text: display.slice(at), match: false })
  return parts
}
