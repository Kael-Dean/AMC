// src/pages/hr/tabs/HRPayrollReviewPanel.jsx
// ─────────────────────────────────────────────────────────────────────────────
// งวดเงินเดือนที่รอ "ผู้ใช้คนนี้" ตรวจสอบ/อนุมัติ + งวดที่อนุมัติแล้วแต่ยังไม่ปิด (ผู้จัดการส่งกลับได้)
//   GET  /hr/payroll/periods?year=YYYY (ค.ศ.)
//   POST /hr/payroll/periods/{y}/{m}/admin-check | asst-check | approve   ตามขั้น (periodActionOf ใน lib/payroll.js)
//   POST /hr/payroll/periods/{y}/{m}/return                               กลับเป็นร่าง + ล้างผลตรวจ (ReturnPeriodSheet)
//   ขั้นผิด → 409 + detail ไทย — แสดงตามที่ backend ส่งมา
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react"
import { apiAuth } from "../../../lib/api"
import { useCan } from "../../../lib/permissions"
import {
  PERIOD_STEP_ACTIONS, PERIOD_TONE, fmtDateTime, fmtPayMonth, money, periodActionOf, periodLabel, periodList, periodPerms,
} from "../../../lib/payroll"
import { cx, neutralBtnCls, primaryBtnCls } from "../../../lib/styles"
import SelectDropdown from "../../../components/SelectDropdown"
import { Badge, ConfirmDialog, EmptyState, ErrorState, SkeletonCard, toast } from "../../../components/ui"
import ReturnPeriodSheet from "../../../components/hr/ReturnPeriodSheet"

const THIS_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = [THIS_YEAR, THIS_YEAR - 1].map((y) => ({ value: String(y), label: `ปี ${y + 543}` }))

function rowMeta(p) {
  switch (p.status) {
    case "admin_checked": return `หัวหน้าฝ่ายอำนวยการตรวจ ${fmtDateTime(p.admin_checked_at)}`
    case "asst_checked": return `ผช.ผจก.ตรวจ ${fmtDateTime(p.asst_checked_at)}`
    case "approved": return `อนุมัติ ${fmtDateTime(p.approved_at)} · รอฝ่ายบุคคลปิดงวด`
    default: return `ส่งตรวจสอบ ${fmtDateTime(p.submitted_at)}`
  }
}

function PeriodRow({ p, step, onAct, onReturn, onOpen }) {
  return (
    <li className="flex flex-col gap-3 px-4 py-3.5 md:flex-row md:items-center md:gap-6">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-gray-900 dark:text-gray-100">{fmtPayMonth(p.year, p.month, { long: true })}</p>
          <Badge tone={PERIOD_TONE[p.status] ?? "neutral"}>{periodLabel(p)}</Badge>
        </div>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{rowMeta(p)}</p>
      </div>
      <dl className="flex gap-6 text-sm md:text-right">
        <div>
          <dt className="text-xs text-gray-500 dark:text-gray-400">จำนวนคน</dt>
          <dd className="tabular-nums text-gray-900 dark:text-gray-100">{p.payouts ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500 dark:text-gray-400">ยอดจ่ายสุทธิรวม</dt>
          <dd className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{money(p.total_net)}</dd>
        </div>
      </dl>
      <div className="grid grid-cols-2 gap-2 md:flex md:shrink-0 [&>*:last-child:nth-child(odd)]:col-span-2">
        <button type="button" onClick={() => onOpen(p)} className={cx(neutralBtnCls, step.action && "col-span-2 md:col-span-1")}>ดูรายการ</button>
        {step.canReturn && <button type="button" onClick={() => onReturn(p)} className={neutralBtnCls}>ส่งกลับแก้ไข</button>}
        {step.action && (
          <button type="button" onClick={() => onAct(p, step.action)} className={primaryBtnCls}>{PERIOD_STEP_ACTIONS[step.action].confirmLabel}</button>
        )}
      </div>
    </li>
  )
}

/** onOpenMonth(year, month) → สลับไปแท็บ "งวดประจำเดือน" ของเดือนนั้น */
export default function HRPayrollReviewPanel({ onOpenMonth, onCountChange }) {
  const { can } = useCan()
  const perms = periodPerms(can)
  const [year, setYear] = useState(String(THIS_YEAR))
  const [periods, setPeriods] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [acting, setActing] = useState(null) // { period, action }
  const [actBusy, setActBusy] = useState(false)
  const [actErr, setActErr] = useState("")
  const [returning, setReturning] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    setError("")
    apiAuth(`/hr/payroll/periods?year=${year}`)
      .then((d) => setPeriods(periodList(d)))
      .catch((e) => setError(e.message || "โหลดงวดเงินเดือนไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [year])

  useEffect(() => { load() }, [load])

  const waiting = periods.filter((p) => periodActionOf(p, perms).action)
  // ผู้จัดการยังส่งกลับได้หลังอนุมัติ จนกว่าฝ่ายบุคคลจะปิดงวด
  const approved = perms.approve ? periods.filter((p) => p.status === "approved") : []

  useEffect(() => {
    if (String(THIS_YEAR) === year && !loading) onCountChange?.(waiting.length)
  }, [waiting.length, year, loading, onCountChange])

  const copy = acting ? PERIOD_STEP_ACTIONS[acting.action] : null

  const act = async () => {
    const { period: p } = acting
    setActBusy(true)
    setActErr("")
    try {
      await apiAuth(copy.path(p), { method: "POST" })
      toast.success(copy.success, { description: `${fmtPayMonth(p.year, p.month, { long: true })} — ${copy.next}` })
      setActing(null)
      load()
    } catch (err) {
      setActErr(err.message || "ทำรายการไม่สำเร็จ")
    } finally {
      setActBusy(false)
    }
  }

  const rowHandlers = {
    onAct: (period, action) => { setActErr(""); setActing({ period, action }) },
    onReturn: setReturning,
    onOpen: (x) => onOpenMonth(x.year, x.month),
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          แสดงเฉพาะงวดที่ถึงขั้นของคุณ — ตรวจยอดก่อนยืนยัน ถ้าไม่ถูกต้องส่งกลับให้ฝ่ายบุคคลแก้ไขพร้อมเหตุผล
        </p>
        <div className="w-36">
          <SelectDropdown value={year} onChange={setYear} options={YEAR_OPTIONS} placeholder="เลือกปี" />
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading ? (
        <div className="space-y-3"><SkeletonCard /><SkeletonCard /></div>
      ) : (
        <>
          <section aria-labelledby="payroll-review-h" className="rounded-2xl bg-white ring-1 ring-gray-200/70 shadow-sm dark:bg-surface dark:ring-line dark:shadow-none">
            <h3 id="payroll-review-h" className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900 dark:border-line dark:text-gray-100">
              รอตรวจสอบ/อนุมัติ <span className="font-normal tabular-nums text-gray-500 dark:text-gray-400">({waiting.length})</span>
            </h3>
            {waiting.length === 0 ? (
              <EmptyState title="ไม่มีงวดที่รอคุณ" description={`ปี ${Number(year) + 543} ไม่มีงวดเงินเดือนที่ถึงขั้นของคุณ`} className="!py-10" />
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-line">
                {waiting.map((p) => (
                  <PeriodRow key={`${p.year}-${p.month}`} p={p} step={periodActionOf(p, perms)} {...rowHandlers} />
                ))}
              </ul>
            )}
          </section>

          {approved.length > 0 && (
            <section aria-labelledby="payroll-approved-h" className="rounded-2xl bg-white ring-1 ring-gray-200/70 shadow-sm dark:bg-surface dark:ring-line dark:shadow-none">
              <h3 id="payroll-approved-h" className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900 dark:border-line dark:text-gray-100">
                อนุมัติแล้ว รอปิดงวด <span className="font-normal tabular-nums text-gray-500 dark:text-gray-400">({approved.length})</span>
              </h3>
              <ul className="divide-y divide-gray-100 dark:divide-line">
                {approved.map((p) => (
                  <PeriodRow key={`${p.year}-${p.month}`} p={p} step={periodActionOf(p, perms)} {...rowHandlers} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!acting}
        title={acting ? copy.title(fmtPayMonth(acting.period.year, acting.period.month, { long: true })) : ""}
        description={copy?.description}
        confirmLabel={copy?.confirmLabel}
        loading={actBusy}
        loadingLabel={copy?.loadingLabel}
        error={actErr}
        onConfirm={act}
        onCancel={() => setActing(null)}
      >
        {acting && (
          <dl className="grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3 text-sm dark:bg-white/[.03]">
            <div><dt className="text-xs text-gray-500 dark:text-gray-400">จำนวนคน</dt><dd className="tabular-nums text-gray-900 dark:text-gray-100">{acting.period.payouts ?? "—"}</dd></div>
            <div><dt className="text-xs text-gray-500 dark:text-gray-400">ยอดจ่ายสุทธิรวม</dt><dd className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{money(acting.period.total_net)}</dd></div>
          </dl>
        )}
      </ConfirmDialog>

      <ReturnPeriodSheet period={returning} onClose={() => setReturning(null)} onDone={load} />
    </div>
  )
}
