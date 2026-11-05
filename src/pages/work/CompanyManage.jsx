// src/pages/work/CompanyManage.jsx
// หน้า "แก้ไขคู่ค้า/บริษัท" (/company-add) — ดูรายชื่อบริษัทที่มีในระบบ เพิ่ม และแก้ไข
//   /company-add?new=1 เปิดฟอร์มเพิ่มบริษัททันที (ลิงก์จากช่องค้นหาบริษัทในหน้า Buy/Sales)
//
// สิทธิ์ (ทั้งหมดผ่าน registry ใน src/lib/permissions.js):
//   เข้าหน้า = COMPANY_PAGE_PERMS (App.jsx) · รายชื่อ = members.search · เพิ่ม = canSeeAddCompany() · แก้ไข = customers.edit
import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Building2, ChevronLeft, ChevronRight, Pencil, Plus, SearchX } from "lucide-react"
import { apiAuth } from "../../lib/api"
import { keepBackState } from "../../lib/drill"
import { getMyPermissionsStatus, loadMyPermissions } from "../../lib/myPermissions"
import { canSeeAddCompany, useCan } from "../../lib/permissions"
import { cx, cardCls, neutralBtnCls, primaryBtnCls } from "../../lib/styles"
import { useIsPhone } from "../../hooks/useMediaQuery"
import { DataList, EmptyState, ErrorState, SearchField, SkeletonTableRows, toast } from "../../components/ui"
import CompanyFormSheet from "../../components/CompanyFormSheet"
import PageTitle from "../../components/PageTitle"

const PAGE_SIZE = 50
const DEBOUNCE_MS = 400
const REQUEST_TIMEOUT_MS = 20000
const COLUMN_COUNT = { withEdit: 5, readOnly: 4 }

const isThaiText = (s) => typeof s === "string" && /[฀-๿]/.test(s)
const fmtCount = (n) => Number(n).toLocaleString("th-TH")
const orDash = (v) => (v == null || String(v).trim() === "" ? "—" : v)

const thCls = "bg-gray-50 px-3 py-2.5 lg:px-4 text-left text-sm font-semibold text-gray-600 dark:bg-raised dark:text-gray-300"

function EditButton({ company, onEdit, className }) {
  return (
    <button
      type="button"
      onClick={() => onEdit(company)}
      aria-label={`แก้ไข ${company.company_name ?? "บริษัท"}`}
      className={cx(neutralBtnCls, className)}
    >
      <Pencil aria-hidden="true" className="size-4" strokeWidth={1.75} />
      แก้ไข
    </button>
  )
}

function CompanyTable({ list, skeleton, canEdit, onEdit }) {
  const cols = canEdit ? COLUMN_COUNT.withEdit : COLUMN_COUNT.readOnly
  return (
    <div className={cardCls}>
      {/* ไม่ครอบ overflow-x-auto: คอลัมน์ชื่อตัดบรรทัดเองได้ และหัวตารางจะ sticky ตามการเลื่อนหน้า */}
      <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
        <colgroup>
          <col />
          <col className="w-36 lg:w-44" />
          <col className="w-32 lg:w-36" />
          <col className="w-32 lg:w-40" />
          {canEdit && <col className="w-26 lg:w-28" />}
        </colgroup>
        <thead className="sticky top-(--topbar-h) z-10">
          <tr>
            <th scope="col" className={cx(thCls, "rounded-tl-2xl")}>ชื่อบริษัท</th>
            <th scope="col" className={thCls}>เลขผู้เสียภาษี</th>
            <th scope="col" className={thCls}>โทรศัพท์</th>
            <th scope="col" className={cx(thCls, !canEdit && "rounded-tr-2xl")}>จังหวัด (สนญ.)</th>
            {canEdit && (
              <th scope="col" className={cx(thCls, "rounded-tr-2xl")}>
                <span className="sr-only">จัดการ</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="text-gray-800 dark:text-gray-200">
          {skeleton ? (
            <SkeletonTableRows rows={8} cols={cols} />
          ) : (
            list.map((c) => (
              <tr key={c.asso_id} className="even:bg-gray-50 dark:even:bg-gray-700/30">
                <td className="px-3 py-2 lg:px-4 font-medium break-words text-gray-900 dark:text-gray-100">{orDash(c.company_name)}</td>
                <td className="px-3 py-2 lg:px-4 tabular-nums">{orDash(c.tax_id)}</td>
                <td className="px-3 py-2 lg:px-4 tabular-nums break-words">{orDash(c.phone_number)}</td>
                <td className="px-3 py-2 lg:px-4 break-words">{orDash(c.hq_province)}</td>
                {canEdit && (
                  <td className="px-2 py-1.5 text-right lg:px-4">
                    <EditButton company={c} onEdit={onEdit} className="!h-9 !px-3" />
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

const COMPANY_FIELDS_PHONE = [
  { label: "เลขผู้เสียภาษี", value: (c) => orDash(c.tax_id) },
  { label: "โทรศัพท์", value: (c) => orDash(c.phone_number) },
  { label: "จังหวัด (สำนักงานใหญ่)", value: (c) => orDash(c.hq_province), span: 2 },
]

export default function CompanyManage() {
  const { can } = useCan()
  // ระหว่างรอ /auth/me/permissions ครั้งแรก can() ใช้ตารางสำรองตามตำแหน่ง ซึ่งอาจให้สิทธิ์เกินจริง
  // → ยังไม่ยิงรายการ ไม่แสดงปุ่ม และไม่เปิดฟอร์มจาก ?new=1 จนกว่าจะรู้สิทธิ์จริง
  const permsPending = ["idle", "loading"].includes(getMyPermissionsStatus())
  useEffect(() => {
    if (permsPending) loadMyPermissions()
  }, [permsPending])
  const listAllowed = can("members.search")
  const canList = !permsPending && listAllowed
  const canEdit = !permsPending && can("customers.edit")
  const canAdd = !permsPending && canSeeAddCompany()
  const isPhone = useIsPhone()

  const [input, setInput] = useState("")
  const [query, setQuery] = useState({ q: "", offset: 0, nonce: 0 })
  const [list, setList] = useState({ status: "loading", refreshing: false, items: [], total: 0, q: "", offset: 0, error: null })
  const [sheet, setSheet] = useState(null) // null | { mode: "add" } | { mode: "edit", company }
  const [params, setParams] = useSearchParams()

  const requestSeq = useRef(0)
  const debounceTimer = useRef(0)
  useEffect(() => () => clearTimeout(debounceTimer.current), [])

  /** ---------- โหลดรายชื่อ ---------- */
  useEffect(() => {
    if (!canList) return
    const seq = ++requestSeq.current
    setList((p) => ({ ...p, status: p.status === "ready" ? "ready" : "loading", refreshing: true, error: null }))

    const qs = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(query.offset) })
    if (query.q) qs.set("q", query.q)

    apiAuth(`/member/companies?${qs}`, { timeoutMs: REQUEST_TIMEOUT_MS })
      .then((data) => {
        if (seq !== requestSeq.current) return
        // คำตอบผิดรูปแบบต้องเป็น error ไม่ใช่ "ไม่มีบริษัท"
        if (!Array.isArray(data?.items)) throw new Error("รูปแบบข้อมูลไม่ถูกต้อง")
        const total = Number.isFinite(data.total) ? data.total : query.offset + data.items.length
        // หน้าปัจจุบันหายไป (รายการลดลงระหว่างดู) → ไปหน้าสุดท้ายที่ยังมีข้อมูล
        if (data.items.length === 0 && total > 0 && query.offset > 0) {
          const lastOffset = Math.floor((total - 1) / PAGE_SIZE) * PAGE_SIZE
          setQuery((p) => ({ ...p, offset: lastOffset }))
          return
        }
        setList({ status: "ready", refreshing: false, items: data.items, total, q: query.q, offset: query.offset, error: null })
      })
      .catch((err) => {
        if (seq !== requestSeq.current) return
        console.error(err)
        const fallback = err?.status === 403 ? "คุณไม่มีสิทธิ์ดูรายชื่อบริษัท" : "โหลดรายชื่อบริษัทไม่สำเร็จ"
        setList({
          status: "error",
          refreshing: false,
          items: [],
          total: 0,
          q: query.q,
          offset: query.offset,
          error: { message: isThaiText(err?.message) ? err.message : fallback, status: err?.status },
        })
      })
  }, [query, canList])

  const reload = useCallback(() => setQuery((p) => ({ ...p, nonce: p.nonce + 1 })), [])

  /** ค้นหาทันที (ล้างคำค้น / กด Enter) ส่วนการพิมพ์รอ debounce */
  const runSearch = useCallback((value) => {
    clearTimeout(debounceTimer.current)
    setQuery((p) => (p.q === value && p.offset === 0 ? p : { ...p, q: value, offset: 0 }))
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

  const goToOffset = (offset) => {
    setQuery((p) => ({ ...p, offset }))
    window.scrollTo({ top: 0 })
  }

  /** ---------- ?new=1 เปิดฟอร์มเพิ่มทันที แล้วล้างออกจาก URL (รีเฟรชไม่เปิดซ้ำ) ---------- */
  useEffect(() => {
    if (params.get("new") !== "1" || !canAdd) return
    setSheet((s) => s ?? { mode: "add" })
    setParams(
      (p) => {
        p.delete("new")
        return p
      },
      { replace: true, state: keepBackState() },
    )
  }, [params, canAdd, setParams])

  /** ---------- หลังบันทึก ---------- */
  const onSaved = (saved, { mode, name, unchanged }) => {
    setSheet(null)
    if (unchanged) {
      toast.info("ไม่มีข้อมูลที่เปลี่ยนแปลง")
      return
    }
    const displayName = saved?.company_name ?? name
    if (mode === "add") {
      toast.success("บันทึกข้อมูลบริษัทแล้ว", { description: displayName })
    } else {
      toast.success("บันทึกการแก้ไขแล้ว", { description: displayName })
      // แสดงค่าใหม่ทันที ระหว่างรอ refetch (ลำดับชื่อ/ผลค้นหาอาจเปลี่ยน)
      if (saved?.asso_id != null) {
        setList((p) => ({
          ...p,
          items: p.items.map((c) => (c.asso_id === saved.asso_id ? { ...c, ...saved } : c)),
        }))
      }
    }
    reload()
  }

  const onGone = () => {
    setSheet(null)
    reload()
  }

  const onEdit = useCallback((company) => setSheet({ mode: "edit", company }), [])
  const openAdd = () => setSheet({ mode: "add" })

  /** ---------- สถานะของรายการ ---------- */
  const ready = list.status === "ready"
  const hasRows = ready && list.items.length > 0
  const rangeStart = list.offset + 1
  const rangeEnd = list.offset + list.items.length
  const paged = ready && list.total > PAGE_SIZE
  const page = Math.floor(list.offset / PAGE_SIZE) + 1
  const pageCount = Math.max(1, Math.ceil(list.total / PAGE_SIZE))

  let countText = ""
  if (hasRows) {
    const range = paged ? `แสดง ${fmtCount(rangeStart)}–${fmtCount(rangeEnd)} จาก ` : ""
    countText = list.q
      ? `${range || "พบ "}${fmtCount(list.total)} บริษัท ตรงกับ “${list.q}”`
      : `${range || "ทั้งหมด "}${fmtCount(list.total)} บริษัท`
  }

  const addButton = canAdd ? (
      <button
        type="button"
        onClick={openAdd}
        className={cx(primaryBtnCls, "w-full !h-12 md:w-auto md:!h-auto md:ml-auto md:!rounded-2xl md:!px-5")}
      >
        <Plus aria-hidden="true" className="size-4" strokeWidth={2} />
        เพิ่มบริษัท
      </button>
    ) : null

  const emptyState = list.q ? (
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
  )

  return (
    <div className="p-4 md:p-6">
      <PageTitle title="แก้ไขคู่ค้า/บริษัท" />

      <div className="flex flex-col gap-3 md:flex-row md:items-stretch md:justify-between">
        {listAllowed && (
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
        )}
        {addButton}
      </div>

      {!listAllowed ? (
        <div className={cx(cardCls, "mt-4")}>
          <EmptyState
            icon={<Building2 aria-hidden="true" className="size-12" strokeWidth={1.25} />}
            title="บัญชีนี้ไม่มีสิทธิ์ดูรายชื่อบริษัท"
            description={canAdd ? "เพิ่มบริษัทใหม่ได้จากปุ่มเพิ่มบริษัท หากต้องการดูรายชื่อ กรุณาติดต่อผู้ดูแลระบบ" : "กรุณาติดต่อผู้ดูแลระบบ"}
          />
        </div>
      ) : (
        <>
          <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm break-words text-gray-600 dark:text-gray-300">
            {countText}
          </p>

          <div className="mt-2">
            {list.status === "error" ? (
              <ErrorState message={list.error?.message} error={list.error} onRetry={reload} />
            ) : ready && !hasRows ? (
              <div className={cardCls}>{emptyState}</div>
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
                    fields={COMPANY_FIELDS_PHONE}
                    actions={canEdit ? (c) => <EditButton company={c} onEdit={onEdit} /> : undefined}
                  />
                ) : (
                  <CompanyTable list={list.items} skeleton={!ready} canEdit={canEdit} onEdit={onEdit} />
                )}
              </div>
            )}
          </div>

          {paged && hasRows && (
            <nav aria-label="เปลี่ยนหน้ารายชื่อบริษัท" className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => goToOffset(Math.max(0, list.offset - PAGE_SIZE))}
                disabled={list.offset === 0 || list.refreshing}
                className={neutralBtnCls}
              >
                <ChevronLeft aria-hidden="true" className="size-4" strokeWidth={2} />
                ก่อนหน้า
              </button>
              <span className="text-sm tabular-nums text-gray-600 dark:text-gray-300">
                หน้า {fmtCount(page)} จาก {fmtCount(pageCount)}
              </span>
              <button
                type="button"
                onClick={() => goToOffset(list.offset + PAGE_SIZE)}
                disabled={rangeEnd >= list.total || list.refreshing}
                className={neutralBtnCls}
              >
                ถัดไป
                <ChevronRight aria-hidden="true" className="size-4" strokeWidth={2} />
              </button>
            </nav>
          )}
        </>
      )}

      {sheet && (
        <CompanyFormSheet
          key={sheet.mode === "edit" ? `edit-${sheet.company.asso_id}` : "add"}
          mode={sheet.mode}
          company={sheet.company}
          onClose={() => setSheet(null)}
          onSaved={onSaved}
          onGone={onGone}
        />
      )}
    </div>
  )
}
