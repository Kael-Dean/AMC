// src/components/CompanyFormSheet.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ฟอร์มเพิ่ม/แก้ไขบริษัท (คู่ค้า) ใน <Sheet> — ใช้โดยหน้า แก้ไขคู่ค้า/บริษัท (/company-add)
// mount เฉพาะตอนเปิด เพื่อให้ state ของฟอร์มเริ่มใหม่ทุกครั้ง
//
//   <CompanyFormSheet mode="add" onClose={…} onSaved={(company, { mode, unchanged }) => …} />
//   <CompanyFormSheet mode="edit" company={row} onClose={…} onSaved={…} onGone={…} />
//
//   add  → POST  /member/customers/company-signup (ส่งครบทุกช่อง)
//   edit → PATCH /member/companies/{asso_id}      (ส่งเฉพาะช่องที่เปลี่ยน)
//
// โหมดแก้ไขตรวจเฉพาะช่องที่ผู้ใช้เปลี่ยน: ข้อมูลเก่าที่ไม่ครบ (เช่น ไม่มีตำบล) ต้องไม่ขวางการแก้เบอร์โทร
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { apiAuth } from "../lib/api"
import { cx, baseField, labelCls, helpTextCls, errorTextCls, neutralBtnCls } from "../lib/styles"
import { useIsPhone } from "../hooks/useMediaQuery"
import { ConfirmDialog, SaveButton, SHEET_SAVED_MS, Sheet, toast, useSaveStatus } from "./ui"

/** ---------- Utils ---------- */
const onlyDigits = (s = "") => String(s ?? "").replace(/\D+/g, "")
/** แสดงข้อความจาก backend เฉพาะเมื่อเป็นภาษาไทยแล้ว */
const isThaiText = (s) => typeof s === "string" && /[฀-๿]/.test(s)
const toNull = (s) => {
  const v = String(s ?? "").trim()
  return v === "" ? null : v
}

const COMPANY_FIELDS = [
  { key: "company_name", label: "ชื่อบริษัท / นิติบุคคล", placeholder: "เช่น บริษัท ตัวอย่าง จำกัด", required: true },
  { key: "tax_id", label: "เลขที่ผู้เสียภาษี (13 หลัก)", placeholder: "เช่น 0123456789012", digits: 13, required: true },
  { key: "phone_number", label: "เบอร์โทรบริษัท (ไม่บังคับ)", placeholder: "เช่น 021234567", inputMode: "tel" },
]

const HQ_FIELDS = [
  { key: "hq_address", label: "บ้านเลขที่ / ที่อยู่ (สำนักงานใหญ่)", placeholder: "เช่น 99/1 หมู่บ้านตัวอย่าง", required: true },
  { key: "hq_moo", label: "หมู่ (สำนักงานใหญ่)", placeholder: "เช่น 4" },
  { key: "hq_tambon", label: "ตำบล (สำนักงานใหญ่)", placeholder: "เช่น หนองปลาไหล", required: true },
  { key: "hq_amphur", label: "อำเภอ (สำนักงานใหญ่)", placeholder: "เช่น เมือง", required: true },
  { key: "hq_province", label: "จังหวัด (สำนักงานใหญ่)", placeholder: "เช่น ขอนแก่น", required: true },
  { key: "hq_postal_code", label: "รหัสไปรษณีย์ (สำนักงานใหญ่)", placeholder: "เช่น 10110", digits: 5 },
]

const BRANCH_FIELDS = [
  { key: "branch_address", label: "บ้านเลขที่ / ที่อยู่ (สาขา)", placeholder: "เช่น 10/2 หมู่บ้านตัวอย่าง" },
  { key: "branch_moo", label: "หมู่ (สาขา)", placeholder: "เช่น 5" },
  { key: "branch_tambon", label: "ตำบล (สาขา)", placeholder: "เช่น บึงเนียม" },
  { key: "branch_amphur", label: "อำเภอ (สาขา)", placeholder: "เช่น เมือง" },
  { key: "branch_province", label: "จังหวัด (สาขา)", placeholder: "เช่น ขอนแก่น" },
  { key: "branch_postal_code", label: "รหัสไปรษณีย์ (สาขา)", placeholder: "เช่น 10220", digits: 5 },
]

const FIELD_KEYS = [...COMPANY_FIELDS, ...HQ_FIELDS, ...BRANCH_FIELDS].map((f) => f.key)
/** ลำดับ Enter → ช่องถัดไป (ปิดท้ายด้วยปุ่มบันทึก) */
const ENTER_ORDER = [...FIELD_KEYS, "submitBtn"]

/** ค่าเริ่มต้นของฟอร์ม: ช่องว่างทั้งหมด หรือค่าจากแถวที่เลือก */
const toForm = (company) =>
  Object.fromEntries(FIELD_KEYS.map((k) => [k, company?.[k] == null ? "" : String(company[k])]))

/** ค่าที่จะส่งให้ backend (ชื่อฟิลด์ตรงกับ CompanyCustomerCreate) */
const toPayload = (form) =>
  Object.fromEntries(
    FIELD_KEYS.map((k) => {
      if (k === "company_name") return [k, form[k].trim()]
      if (k === "tax_id") return [k, onlyDigits(form[k])]
      if (k.endsWith("_postal_code")) return [k, form[k] ? onlyDigits(form[k]) : null] // ส่งเป็นสตริง
      return [k, toNull(form[k])]
    }),
  )

/** ตรวจฟอร์ม: `shouldCheck(key)` = ช่องนี้ต้องตรวจไหม (โหมดแก้ไขตรวจเฉพาะช่องที่เปลี่ยน) */
function validate(form, shouldCheck) {
  const e = {}
  const missing = (k) => shouldCheck(k) && !form[k].trim()
  const badPostal = (k) => shouldCheck(k) && form[k] && onlyDigits(form[k]).length !== 5

  if (missing("company_name")) e.company_name = "กรุณากรอกชื่อบริษัท / นิติบุคคล"
  if (shouldCheck("tax_id") && onlyDigits(form.tax_id).length !== 13) e.tax_id = "เลขผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก"

  // HQ minimal required (บังคับให้ครบเพื่อคุณภาพข้อมูล)
  if (missing("hq_address")) e.hq_address = "กรุณากรอกบ้านเลขที่/ที่อยู่ (สำนักงานใหญ่)"
  if (missing("hq_tambon")) e.hq_tambon = "กรุณากรอกตำบล (สำนักงานใหญ่)"
  if (missing("hq_amphur")) e.hq_amphur = "กรุณากรอกอำเภอ (สำนักงานใหญ่)"
  if (missing("hq_province")) e.hq_province = "กรุณากรอกจังหวัด (สำนักงานใหญ่)"
  if (badPostal("hq_postal_code")) e.hq_postal_code = "รหัสไปรษณีย์ (สำนักงานใหญ่) ต้องมี 5 หลัก"

  // Branch optional—but if filled, postal must be 5 digits
  if (badPostal("branch_postal_code")) e.branch_postal_code = "รหัสไปรษณีย์ (สาขา) ต้องมี 5 หลัก"
  return e
}

/** ---------- Enter-to-next helpers (ยกหลักการจากหน้า Buy) ---------- */
const isEnabledInput = (el) => {
  if (!el || el.disabled) return false
  const style = window.getComputedStyle?.(el)
  if (style && (style.display === "none" || style.visibility === "hidden")) return false
  return el.offsetParent !== null
}

/** ---------- FormGuard: เตือนถ้าจะออกจากหน้า/รีเฟรชแล้วยังกรอกค้าง ---------- */
const useFormGuard = (active) => {
  useEffect(() => {
    if (!active) return
    const h = (e) => {
      e.preventDefault()
      e.returnValue = "" // ให้เบราว์เซอร์โชว์ dialog ยืนยัน
      return ""
    }
    window.addEventListener("beforeunload", h)
    return () => window.removeEventListener("beforeunload", h)
  }, [active])
}

/** ---------- UI pieces ---------- */
const sectionHeadingCls = "mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100"
const fieldError = "!border-red-500 !ring-2 !ring-red-300 dark:!border-red-400 dark:!ring-red-400/40"

function Field({ field, value, error, hint, note, uid, inputRef, onChange, onKeyDown, className }) {
  const id = `${uid}-${field.key}`
  const errId = `${id}-err`
  const hintId = `${id}-hint`
  const describedBy = cx(error && errId, hint && hintId) || undefined
  return (
    <div className={className}>
      <label htmlFor={id} className={cx(labelCls, "md:!text-sm")}>
        {field.label}
        {field.required && (
          <span aria-hidden="true" className="ml-0.5 text-red-600 dark:text-red-400">*</span>
        )}
      </label>
      <input
        ref={inputRef}
        id={id}
        value={value}
        inputMode={field.digits ? "numeric" : field.inputMode}
        maxLength={field.digits}
        autoComplete="off"
        placeholder={field.placeholder}
        aria-required={field.required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cx(baseField, "!rounded-xl !px-3 !py-2.5", error && fieldError)}
        onChange={(e) => onChange(field.digits ? onlyDigits(e.target.value) : e.target.value)}
        onKeyDown={onKeyDown}
      />
      {error && <p id={errId} className={errorTextCls}>{error}</p>}
      {hint && <p id={hintId} className={helpTextCls}>{hint}</p>}
      {note}
    </div>
  )
}

/** ---------- Component ---------- */
export default function CompanyFormSheet({ mode = "add", company, onClose, onSaved, onGone }) {
  const isEdit = mode === "edit"
  const isPhone = useIsPhone()
  const uid = useId()
  const formId = `${uid}-form`
  const initial = useMemo(() => toForm(isEdit ? company : null), [isEdit, company])

  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState({})
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const save = useSaveStatus()
  const busy = save.status !== "idle"

  const refs = useRef({})
  const setRef = (k) => (el) => { refs.current[k] = el }
  // กันกดซ้ำ: state ของปุ่มยังไม่ทันอัปเดตถ้ากด Enter/คลิกติดกันเร็ว ๆ
  const inFlight = useRef(false)

  /** ช่องที่ค่าต่างจากตอนเปิดฟอร์ม (เทียบหลัง normalize เหมือนที่จะส่งจริง) */
  const changedKeys = useMemo(() => {
    const now = toPayload(form)
    const before = toPayload(initial)
    return FIELD_KEYS.filter((k) => now[k] !== before[k])
  }, [form, initial])

  const isDirty = changedKeys.length > 0
  const taxIdChanged = isEdit && changedKeys.includes("tax_id")
  useFormGuard(isDirty && !busy)

  const update = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }))
    setErrors((prev) => {
      if (!(k in prev)) return prev
      const { [k]: _omit, ...rest } = prev
      return rest
    })
  }

  const focusNext = (currentKey) => {
    const list = ENTER_ORDER.filter((k) => isEnabledInput(refs.current[k]))
    const i = list.indexOf(currentKey)
    const el = i >= 0 && i < list.length - 1 ? refs.current[list[i + 1]] : null
    if (!el) return
    try {
      el.scrollIntoView({ block: "center" })
    } catch { /* เบราว์เซอร์เก่าไม่รองรับ options */ }
    el.focus?.()
    el.select?.()
  }

  const onEnter = (k) => (e) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault()
      focusNext(k)
    }
  }

  // โฟกัสไป error ตัวแรกเฉพาะตอนกดบันทึก — ถ้าโฟกัสทุกครั้งที่ errors เปลี่ยน
  // การพิมพ์แก้ช่องหนึ่ง (ซึ่งล้าง error ของช่องนั้น) จะดึงเคอร์เซอร์ไปช่องผิดถัดไป
  const focusFirstError = useRef(false)
  const reportErrors = (next) => {
    focusFirstError.current = true
    setErrors(next)
  }
  useEffect(() => {
    if (!focusFirstError.current) return
    focusFirstError.current = false
    const first = FIELD_KEYS.find((k) => k in errors)
    const el = first ? refs.current[first] : null
    if (!el) return
    try {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
    } catch { /* เบราว์เซอร์เก่าไม่รองรับ options */ }
    el.focus()
  }, [errors])

  /** แปลง error จาก backend เป็น error รายช่อง หรือ toast */
  const showServerError = (err) => {
    const thai = isThaiText(err?.message) ? err.message : null

    if (err?.status === 409) {
      reportErrors({ tax_id: thai || "เลขผู้เสียภาษีนี้มีบริษัทอื่นใช้แล้ว" })
      return
    }

    // แถวถูกลบไปแล้ว (404 ภาษาไทยจาก backend) — 404 ภาษาอังกฤษคือ route ยังไม่ deploy ไม่ใช่บริษัทหาย
    if (isEdit && err?.status === 404 && thai) {
      toast.error("บันทึกไม่สำเร็จ", { description: thai })
      onGone?.()
      return
    }

    // FastAPI 422 แบบ array: { detail: [{ loc: ["body", "tax_id"], msg }] } → ผูกกับช่องที่ผิด
    const detail = err?.data?.detail
    if (err?.status === 422 && Array.isArray(detail)) {
      const fieldErrors = {}
      detail.forEach((d) => {
        const key = Array.isArray(d?.loc) ? d.loc[d.loc.length - 1] : null
        if (FIELD_KEYS.includes(key)) {
          fieldErrors[key] = isThaiText(d?.msg) ? d.msg : "ข้อมูลช่องนี้ไม่ถูกต้อง"
        }
      })
      if (Object.keys(fieldErrors).length) {
        reportErrors(fieldErrors)
        return
      }
    }

    toast.error("บันทึกไม่สำเร็จ", { description: thai || "ข้อมูลที่กรอกยังอยู่ ลองบันทึกใหม่อีกครั้ง" })
  }

  /** ---------- Submit ---------- */
  const handleSubmit = async (ev) => {
    ev.preventDefault()
    if (inFlight.current || busy) return

    const shouldCheck = isEdit ? (k) => changedKeys.includes(k) : () => true
    const e = validate(form, shouldCheck)
    reportErrors(e)
    if (Object.keys(e).length) return

    const payload = toPayload(form)
    if (isEdit && !isDirty) {
      onSaved?.(company, { mode, unchanged: true })
      return
    }

    inFlight.current = true
    save.start()
    try {
      const body = isEdit
        ? Object.fromEntries(changedKeys.map((k) => [k, payload[k]]))
        : payload
      const saved = await apiAuth(
        isEdit ? `/member/companies/${encodeURIComponent(company.asso_id)}` : "/member/customers/company-signup",
        { method: isEdit ? "PATCH" : "POST", body },
      )
      save.succeed(() => onSaved?.(saved ?? null, { mode, name: payload.company_name }), SHEET_SAVED_MS)
    } catch (err) {
      console.error(err)
      inFlight.current = false
      save.fail()
      showServerError(err)
    }
  }

  const requestClose = () => {
    if (busy) return
    if (isDirty) setConfirmDiscard(true)
    else onClose?.()
  }

  const renderField = (f, extra = {}) => (
    <Field
      key={f.key}
      field={f}
      uid={uid}
      value={form[f.key]}
      error={errors[f.key]}
      inputRef={setRef(f.key)}
      onChange={(v) => update(f.key, v)}
      onKeyDown={onEnter(f.key)}
      {...extra}
    />
  )

  return (
    <>
      <Sheet
        open
        onClose={requestClose}
        title={isEdit ? "แก้ไขข้อมูลบริษัท" : "เพิ่มบริษัท"}
        subtitle={isEdit ? <span className="break-words">{company?.company_name}</span> : undefined}
        size="full"
        busy={busy}
        initialFocus={isPhone ? "[data-sheet-close]" : "form input"}
        footer={
          <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
            <button type="button" onClick={requestClose} disabled={busy} className={cx(neutralBtnCls, "!h-12 md:!h-10")}>
              ยกเลิก
            </button>
            <SaveButton
              ref={setRef("submitBtn")}
              type="submit"
              form={formId}
              status={save.status}
              className="!h-12 !py-0 !text-sm hover:!scale-100 md:!h-10"
            >
              บันทึก
            </SaveButton>
          </div>
        }
      >
        <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-7 text-gray-900 dark:text-gray-100">
          <section aria-labelledby={`${uid}-s-company`}>
            <h3 id={`${uid}-s-company`} className={sectionHeadingCls}>ข้อมูลบริษัท</h3>
            <div className="grid gap-4 md:grid-cols-3">
              {renderField(COMPANY_FIELDS[0], { className: "md:col-span-2" })}
              {renderField(COMPANY_FIELDS[1], {
                hint: "ใช้สำหรับออกเอกสารภาษี",
                note: (
                  <div role="status" aria-live="polite">
                    {taxIdChanged && (
                      <p className="mt-1 text-sm font-medium text-amber-700 dark:text-amber-300">
                        ออเดอร์เดิมจะยังอยู่กับบริษัทนี้
                      </p>
                    )}
                  </div>
                ),
              })}
              {renderField(COMPANY_FIELDS[2])}
            </div>
          </section>

          <section aria-labelledby={`${uid}-s-hq`}>
            <h3 id={`${uid}-s-hq`} className={sectionHeadingCls}>ที่อยู่สำนักงานใหญ่</h3>
            <div className="grid gap-4 md:grid-cols-3">{HQ_FIELDS.map((f) => renderField(f))}</div>
          </section>

          <section aria-labelledby={`${uid}-s-branch`}>
            <h3 id={`${uid}-s-branch`} className={sectionHeadingCls}>ที่อยู่สำนักงานสาขา (ถ้ามี)</h3>
            <div className="grid gap-4 md:grid-cols-3">{BRANCH_FIELDS.map((f) => renderField(f))}</div>
          </section>
        </form>
      </Sheet>

      <ConfirmDialog
        open={confirmDiscard}
        title="ทิ้งข้อมูลที่ยังไม่บันทึก?"
        description="ข้อมูลที่กรอกในฟอร์มนี้จะหายไป"
        confirmLabel="ทิ้งข้อมูล"
        cancelLabel="กรอกต่อ"
        tone="danger"
        initialFocus="cancel"
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false)
          onClose?.()
        }}
      />
    </>
  )
}
