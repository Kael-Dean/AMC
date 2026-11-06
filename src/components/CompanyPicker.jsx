// src/components/CompanyPicker.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Company dropdown for the order forms (Buy / Sales): opens on the companies in
// `companydata` and filters as you type (name, tax id or phone).
//
// `form` = the page's props-bag. Picking calls form.pickCompanyResult(record).
//
// GET /order/companies/search returns at most MAX_RESULTS rows with no paging, so
// once the first load hits that cap, typing also asks the server and merges the
// rows in. Companies are reloaded when the window regains focus, so one added from
// the "เพิ่มบริษัทใหม่" tab is there on return.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { ExternalLink } from "lucide-react"
import ComboBox from "./ComboBox"
import Can from "./Can"
import { apiAuth } from "../lib/api"
import { cx, errorTextCls, focusRingCls, helpTextCls } from "../lib/styles"

const MAX_RESULTS = 50
const SEARCH_DEBOUNCE_MS = 300
/** A name already in the form that is not in the list (tax id edited, list still loading) */
const CURRENT_VALUE = "__current__"

const fetchCompanies = async (q) => {
  const data = await apiAuth(`/order/companies/search?q=${encodeURIComponent(q)}`)
  if (!Array.isArray(data)) throw new Error("unexpected response")
  return data
}

const toOption = (rec) => ({
  value: String(rec.asso_id),
  label: rec.company_name ?? "(ไม่มีชื่อ)",
  subLabel: `เลขผู้เสียภาษี ${rec.tax_id ?? "-"} · โทร ${rec.phone_number ?? "-"}`,
  rec,
})

export default function CompanyPicker({ form, id, ariaDescribedBy }) {
  const { refs, customer, memberMeta, errors, missingHints, clearError, clearHint, focusNext, pickCompanyResult } = form

  const [companies, setCompanies] = useState([])
  const [searched, setSearched] = useState([])
  const [status, setStatus] = useState("loading") // loading | ready | error
  const cappedRef = useRef(false)
  const searchTimer = useRef(0)
  const searchSeq = useRef(0)

  const load = useCallback(async () => {
    try {
      const rows = await fetchCompanies("")
      cappedRef.current = rows.length >= MAX_RESULTS
      setCompanies(rows)
      setStatus("ready")
    } catch (err) {
      console.error(err)
      // A failed background refresh keeps the list the user already has
      setStatus((s) => (s === "ready" ? s : "error"))
    }
  }, [])

  useEffect(() => {
    load()
    window.addEventListener("focus", load)
    return () => window.removeEventListener("focus", load)
  }, [load])

  useEffect(() => () => clearTimeout(searchTimer.current), [])

  const onQueryChange = useCallback((query) => {
    clearTimeout(searchTimer.current)
    const seq = ++searchSeq.current
    const q = query.trim()
    if (!cappedRef.current || !q) {
      setSearched([])
      return
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const rows = await fetchCompanies(q)
        if (seq === searchSeq.current) setSearched(rows)
      } catch (err) {
        console.error(err)
      }
    }, SEARCH_DEBOUNCE_MS)
  }, [])

  const name = customer.companyName.trim()
  const { options, value } = useMemo(() => {
    const byId = new Map()
    for (const rec of [...companies, ...searched]) {
      if (rec?.asso_id != null) byId.set(String(rec.asso_id), toOption(rec))
    }
    const list = [...byId.values()]
    if (!name) return { options: list, value: "" }
    const selected = memberMeta.assoId != null ? byId.get(String(memberMeta.assoId)) : null
    if (selected) return { options: list, value: selected.value }
    return { options: [{ value: CURRENT_VALUE, label: name, subLabel: "ข้อมูลในฟอร์ม" }, ...list], value: CURRENT_VALUE }
  }, [companies, searched, memberMeta.assoId, name])

  return (
    <>
      <ComboBox
        id={id}
        ariaDescribedBy={ariaDescribedBy}
        options={options}
        value={value}
        onChange={(_, opt) => {
          if (!opt?.rec) return
          pickCompanyResult(opt.rec)
          clearError("companyName")
          clearError("taxId")
        }}
        placeholder="เลือกบริษัท"
        searchable
        searchPlaceholder="ค้นหาชื่อ เลขภาษี หรือเบอร์โทร"
        emptyText="ไม่พบบริษัทที่ตรงกับคำค้น"
        onQueryChange={onQueryChange}
        loading={status === "loading" && options.length === 0}
        buttonRef={refs.companyName}
        onEnterNext={() => focusNext("companyName")}
        error={!!errors.companyName}
        hintRed={!!missingHints?.companyName}
        clearHint={() => clearHint("companyName")}
        title="เลือกบริษัท"
        ariaLabel="ชื่อบริษัท"
      />

      {status === "error" && (
        <p role="alert" className={errorTextCls}>
          โหลดรายชื่อบริษัทไม่สำเร็จ{" "}
          <button type="button" onClick={load} className={cx("cursor-pointer rounded underline", focusRingCls)}>
            ลองอีกครั้ง
          </button>
        </p>
      )}

      <Can perm="customers.create">
        <p className={helpTextCls}>
          {/* New tab: the half-filled order stays intact in this one */}
          <Link
            to="/company-add/new"
            target="_blank"
            rel="noopener"
            className={cx(
              "inline-flex min-h-touch items-center gap-1 rounded font-medium text-indigo-700 hover:underline md:min-h-0 dark:text-indigo-300",
              focusRingCls,
            )}
          >
            ไม่มีในรายการ? เพิ่มบริษัทใหม่
            <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2} />
            <span className="sr-only">(เปิดในแท็บใหม่)</span>
          </Link>
        </p>
      </Can>
    </>
  )
}
