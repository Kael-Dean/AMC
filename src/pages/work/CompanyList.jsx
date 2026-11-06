// src/pages/work/CompanyList.jsx
// หน้า "แก้ไขคู่ค้า/บริษัท" (/company-add) — รายชื่อบริษัทที่มีในระบบ (companydata) + ทางไปฟอร์มเพิ่มบริษัท (/company-add/new)
//
// ใช้ GET /order/companies/search ตัวเดียวกับหน้า Buy/Sales: q ว่าง = ทุกบริษัท
// server คืนสูงสุด MAX_RESULTS รายการและไม่มี offset/total จึงบอกจำนวนจริงได้เฉพาะเมื่อไม่ชนเพดาน
// ยังไม่มี route แก้ไขบริษัทใน backend — หน้านี้จึงดูและค้นหาได้อย่างเดียว
import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { Building2, Plus, SearchX } from "lucide-react"
import { apiAuth } from "../../lib/api"
import { canSeeAddCompany } from "../../lib/permissions"
import { cx, cardCls, neutralBtnCls, primaryBtnCls } from "../../lib/styles"
import { useIsPhone } from "../../hooks/useMediaQuery"
import { DataList, EmptyState, ErrorState, SearchField, SkeletonTableRows } from "../../components/ui"
import PageTitle from "../../components/PageTitle"

const MAX_RESULTS = 50
const DEBOUNCE_MS = 400
const REQUEST_TIMEOUT_MS = 20000

const ADD_PATH = "/company-add/new"
const orDash = (v) => (v == null || String(v).trim() === "" ? "—" : v)

const thCls = "bg-gray-50 px-3 py-2.5 lg:px-4 text-left text-sm font-semibold text-gray-600 dark:bg-raised dark:text-gray-300"
const tdCls = "px-3 py-2 lg:px-4 break-words"

const PHONE_FIELDS = [
  { label: "เลขผู้เสียภาษี", value: (c) => orDash(c.tax_id) },
  { label: "โทรศัพท์", value: (c) => orDash(c.phone_number) },
  { label: "จังหวัด (สำนักงานใหญ่)", value: (c) => orDash(c.hq_province), span: 2 },
]

function CompanyTable({ items, skeleton }) {
  return (
    <div className={cardCls}>
      {/* ไม่ครอบ overflow-x-auto: คอลัมน์ชื่อตัดบรรทัดเองได้ และหัวตารางจะ sticky ตามการเลื่อนหน้า */}
      <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
        <colgroup>
          <col />
          <col className="w-36 lg:w-44" />
          <col className="w-32 lg:w-36" />
          <col className="w-32 lg:w-40" />
        </colgroup>
        <thead className="sticky top-(--topbar-h) z-10">
          <tr>
            <th scope="col" className={cx(thCls, "rounded-tl-2xl")}>ชื่อบริษัท</th>
            <th scope="col" className={thCls}>เลขผู้เสียภาษี</th>
            <th scope="col" className={thCls}>โทรศัพท์</th>
            <th scope="col" className={cx(thCls, "rounded-tr-2xl")}>จังหวัด (สนญ.)</th>
          </tr>
        </thead>
        <tbody className="text-gray-800 dark:text-gray-200">
          {skeleton ? (
            <SkeletonTableRows rows={6} cols={4} />
          ) : (
            items.map((c) => (
              <tr key={c.asso_id} className="even:bg-gray-50 dark:even:bg-gray-700/30">
                <td className={cx(tdCls, "font-medium text-gray-900 dark:text-gray-100")}>{orDash(c.company_name)}</td>
                <td className={cx(tdCls, "tabular-nums")}>{orDash(c.tax_id)}</td>
                <td className={cx(tdCls, "tabular-nums")}>{orDash(c.phone_number)}</td>
                <td className={tdCls}>{orDash(c.hq_province)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default function CompanyList() {
  const canAdd = canSeeAddCompany()
  const isPhone = useIsPhone()

  const [input, setInput] = useState("")
  const [query, setQuery] = useState({ q: "", nonce: 0 })
  const [list, setList] = useState({ status: "loading", refreshing: true, items: [], q: "", error: null })

  const requestSeq = useRef(0)
  const debounceTimer = useRef(0)
  useEffect(() => () => clearTimeout(debounceTimer.current), [])

  useEffect(() => {
    const seq = ++requestSeq.current
    setList((p) => ({ ...p, status: p.status === "ready" ? "ready" : "loading", refreshing: true, error: null }))

    apiAuth(`/order/companies/search?q=${encodeURIComponent(query.q)}`, { timeoutMs: REQUEST_TIMEOUT_MS })
      .then((data) => {
        if (seq !== requestSeq.current) return
        // คำตอบผิดรูปแบบต้องเป็น error ไม่ใช่ "ไม่มีบริษัท"
        if (!Array.isArray(data)) throw new Error("unexpected response")
        setList({ status: "ready", refreshing: false, items: data, q: query.q, error: null })
      })
      .catch((err) => {
        if (seq !== requestSeq.current) return
        console.error(err)
        setList({
          status: "error",
          refreshing: false,
          items: [],
          q: query.q,
          error: { message: "โหลดรายชื่อบริษัทไม่สำเร็จ", status: err?.status },
        })
      })
  }, [query])

  const reload = useCallback(() => setQuery((p) => ({ ...p, nonce: p.nonce + 1 })), [])

  /** ค้นหาทันที (ล้างคำค้น / กด Enter) ส่วนการพิมพ์รอ debounce */
  const runSearch = useCallback((value) => {
    clearTimeout(debounceTimer.current)
    setQuery((p) => (p.q === value ? p : { ...p, q: value }))
  }, [])

  const onSearchChange = (value) => {
    setInput(value)
    clearTimeout(debounceTimer.current)
    const trimmed = value.trim()
    if (!trimmed) {
      runSearch("")
      return
    }
    debounceTimer.current = setTimeout(() => runSearch(trimmed), DEBOUNCE_MS)
  }

  const clearSearch = () => {
    setInput("")
    runSearch("")
  }

  const ready = list.status === "ready"
  const hasRows = ready && list.items.length > 0
  const capped = list.items.length >= MAX_RESULTS

  let countText = ""
  if (hasRows) {
    if (capped) {
      countText = list.q
        ? `แสดง ${MAX_RESULTS} รายการแรกที่ตรงกับ “${list.q}” พิมพ์คำค้นให้ละเอียดขึ้นเพื่อหาบริษัทอื่น`
        : `แสดง ${MAX_RESULTS} รายการแรก พิมพ์ค้นหาเพื่อดูบริษัทอื่น`
    } else {
      countText = list.q ? `พบ ${list.items.length} บริษัท ตรงกับ “${list.q}”` : `ทั้งหมด ${list.items.length} บริษัท`
    }
  }

  return (
    <div className="p-4 md:p-6">
      <PageTitle title="แก้ไขคู่ค้า/บริษัท" />

      <div className="flex flex-col gap-3 md:flex-row md:items-stretch md:justify-between">
        <SearchField
          value={input}
          onChange={onSearchChange}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault()
              runSearch(input.trim())
            }
          }}
          open={false}
          minChars={0}
          loading={list.refreshing}
          placeholder="ค้นหาชื่อ เลขภาษี หรือเบอร์โทร"
          ariaLabel="ค้นหาบริษัท"
          className="min-w-0 flex-1 md:max-w-xl"
        />
        {canAdd && (
          <Link
            to={ADD_PATH}
            className={cx(primaryBtnCls, "w-full !h-12 md:w-auto md:!h-auto md:ml-auto md:!rounded-2xl md:!px-5")}
          >
            <Plus aria-hidden="true" className="size-4" strokeWidth={2} />
            เพิ่มบริษัท
          </Link>
        )}
      </div>

      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm break-words text-gray-600 dark:text-gray-300">
        {countText}
      </p>

      <div className="mt-2">
        {list.status === "error" ? (
          <ErrorState message={list.error?.message} error={list.error} onRetry={reload} />
        ) : ready && !hasRows ? (
          <div className={cardCls}>
            {list.q ? (
              <EmptyState
                icon={<SearchX aria-hidden="true" className="size-12" strokeWidth={1.25} />}
                title={<span className="break-words">ไม่พบบริษัทที่ตรงกับ “{list.q}”</span>}
                description="ลองค้นด้วยชื่อ เลขผู้เสียภาษี หรือเบอร์โทร"
                action={<button type="button" onClick={clearSearch} className={neutralBtnCls}>ล้างคำค้นหา</button>}
              />
            ) : (
              <EmptyState
                icon={<Building2 aria-hidden="true" className="size-12" strokeWidth={1.25} />}
                title="ยังไม่มีบริษัทในระบบ"
                description={canAdd ? "เริ่มจากปุ่มเพิ่มบริษัทด้านบน" : undefined}
              />
            )}
          </div>
        ) : (
          <div
            aria-busy={list.refreshing || undefined}
            className={cx("transition-opacity duration-150", ready && list.refreshing && "opacity-60")}
          >
            {isPhone ? (
              <DataList
                items={list.items}
                keyOf={(c) => c.asso_id}
                loading={!ready}
                title={(c) => <span className="break-words">{orDash(c.company_name)}</span>}
                fields={PHONE_FIELDS}
              />
            ) : (
              <CompanyTable items={list.items} skeleton={!ready} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
