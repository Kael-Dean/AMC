// src/pages/admin/OnboardingGallery.jsx
// ─────────────────────────────────────────────────────────────────────────────
// "ตัวอย่างการเริ่มใช้งาน": every onboarding in the app, and a safe way to try each (Super Admin only,
// admin.onboarding.view). The list is onboardingRegistry.js. Previews run the real components:
//   OnboardingPreviewHost.jsx    over the app (tour, search intro, install card, guide, banner)
//   OnboardingWizardPreview.jsx  the full-screen wizard, on its own route
// How a preview stays harmless: lib/previewMode.js and previewSession.js.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useId, useRef, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { ChevronDown, Eye } from "lucide-react"
import PageTitle from "../../components/PageTitle"
import { Badge, toast } from "../../components/ui"
import { useIsPhone } from "../../hooks/useMediaQuery"
import { getUser } from "../../lib/auth"
import { backState } from "../../lib/drill"
import { useCan } from "../../lib/permissions"
import { ONBOARDING_GALLERY_PATH, usePreview } from "../../lib/previewMode"
import { cx, focusRingCls, neutralBtnCls } from "../../lib/styles"
import { ONBOARDING_ITEMS, RELATED_LINKS } from "./onboardingRegistry"
import { startPreview } from "./previewSession"

const PAGE_TITLE = "ตัวอย่างการเริ่มใช้งาน"
const WIZARD_PATH = `${ONBOARDING_GALLERY_PATH}/preview/wizard`
const COLLAPSE_OVER = 4 // phones: longer step lists start folded
const MUTED = "text-gray-600 dark:text-gray-400"
const STEP_NUMBER =
  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold tabular-nums text-gray-600 dark:bg-white/[.06] dark:text-gray-300"

const loadHost = () => import("./OnboardingPreviewHost")

function StepBody({ step }) {
  return (
    <span className="min-w-0">
      <span className="block text-sm font-medium leading-snug text-gray-900 dark:text-gray-100">{step.title}</span>
      {step.detail && <span className={cx("mt-0.5 block text-[13px] leading-snug", MUTED)}>{step.detail}</span>}
      {step.meta && <span className={cx("mt-0.5 block font-mono text-xs leading-snug break-all", MUTED)}>{step.meta}</span>}
    </span>
  )
}

function StepList({ steps, wizard }) {
  return (
    <ol className="space-y-0.5">
      {steps.map((step, i) => (
        <li key={step.key}>
          {wizard ? (
            <Link
              to={`${WIZARD_PATH}?step=${step.step}`}
              state={{ trigger: "wizard" }}
              aria-label={`ดูตัวอย่างขั้น ${step.title}`}
              className={cx(
                "-mx-1.5 flex min-h-touch items-start gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors duration-150 hover:bg-gray-100 md:pointer-fine:min-h-0 dark:hover:bg-white/[.05]",
                focusRingCls,
              )}
            >
              <span aria-hidden="true" className={STEP_NUMBER}>{i + 1}</span>
              <StepBody step={step} />
            </Link>
          ) : (
            <div className="flex items-start gap-2.5 py-1.5">
              <span aria-hidden="true" className={STEP_NUMBER}>{i + 1}</span>
              <StepBody step={step} />
            </div>
          )}
        </li>
      ))}
    </ol>
  )
}

function GuideGroups({ groups }) {
  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.key}>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{group.title}</p>
          {group.variants.map((variant) => (
            <details key={variant.key} className="group">
              <summary
                className={cx(
                  "flex min-h-touch cursor-pointer list-none items-center gap-1.5 rounded-lg text-sm text-gray-700 md:pointer-fine:min-h-8 dark:text-gray-200 [&::-webkit-details-marker]:hidden",
                  focusRingCls,
                )}
              >
                <ChevronDown aria-hidden="true" strokeWidth={2} className="size-4 shrink-0 text-gray-500 transition-transform duration-200 group-open:rotate-180 dark:text-gray-400" />
                {variant.title}
                <span className={cx("tabular-nums", MUTED)}>{variant.steps.length} ขั้น</span>
              </summary>
              <ol className="mb-1 ml-5 list-decimal space-y-1 pl-4 text-[13px] leading-snug marker:text-gray-500 dark:marker:text-gray-400">
                {variant.steps.map((text) => (
                  <li key={text} className="text-gray-700 dark:text-gray-300">{text}</li>
                ))}
              </ol>
            </details>
          ))}
        </div>
      ))}
    </div>
  )
}

function Steps({ item }) {
  const isPhone = useIsPhone()
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
  const heading = item.stepsHeading ?? "ขั้นตอน"

  if (item.groups) {
    return (
      <div>
        <h3 className="mb-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">{heading}</h3>
        <GuideGroups groups={item.groups} />
      </div>
    )
  }
  const count = item.steps.length
  const folded = isPhone && count > COLLAPSE_OVER && !expanded
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
        {heading} <span className="tabular-nums">{count}</span>
      </h3>
      <div id={listId}>
        <StepList steps={folded ? item.steps.slice(0, COLLAPSE_OVER) : item.steps} wizard={item.preview === "wizard"} />
      </div>
      {isPhone && count > COLLAPSE_OVER && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((v) => !v)}
          className={cx("mt-1 inline-flex min-h-touch cursor-pointer items-center gap-1 rounded-lg text-sm font-medium text-indigo-700 dark:text-indigo-300", focusRingCls)}
        >
          <ChevronDown aria-hidden="true" strokeWidth={2} className={cx("size-4 transition-transform duration-200", expanded && "rotate-180")} />
          {expanded ? "ย่อรายการ" : `ดูทั้งหมด ${count} รายการ`}
        </button>
      )}
    </div>
  )
}

function Fact({ label, children }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-2">
      <dt className="text-xs font-semibold leading-5 text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">{children}</dd>
    </div>
  )
}

function PreviewAction({ item, onStart }) {
  const isPhone = useIsPhone()
  if (!item.preview) return <p className={cx("mt-3 text-[13px] leading-snug", MUTED)}>{item.noPreview}</p>
  if (isPhone && item.phoneReason) return <p className={cx("mt-3 text-[13px] leading-snug", MUTED)}>{item.phoneReason}</p>
  return (
    <>
      <button
        type="button"
        data-preview-trigger={item.key}
        onClick={() => onStart(item)}
        className={cx(neutralBtnCls, "mt-3 w-full sm:w-auto")}
      >
        <Eye aria-hidden="true" strokeWidth={2} className="size-4" />
        ดูตัวอย่าง
      </button>
      {item.note && <p className={cx("mt-2 text-[13px] leading-snug", MUTED)}>{item.note}</p>}
    </>
  )
}

function Item({ item, userId, onStart }) {
  const seen = item.hasSeen && userId != null ? item.hasSeen(userId) : null
  return (
    <section
      aria-labelledby={`ob-item-${item.key}`}
      className="grid scroll-mt-20 gap-x-8 gap-y-4 border-t border-gray-200/70 py-5 first:border-t-0 first:pt-1 last:pb-1 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)_minmax(0,1fr)] dark:border-line"
    >
      <div className="min-w-0">
        <h2 id={`ob-item-${item.key}`} className="text-base font-bold leading-snug text-gray-900 dark:text-gray-100">
          {item.name}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-gray-700 dark:text-gray-300">{item.teaches}</p>
        <PreviewAction item={item} onStart={onStart} />
      </div>
      <dl className="min-w-0 space-y-2.5">
        <Fact label="ใครเห็น">{item.who}</Fact>
        <Fact label="เมื่อไร">{item.when}</Fact>
        <Fact label="ความถี่">{item.often}</Fact>
        {seen !== null && (
          <Fact label="บัญชีนี้">
            <Badge tone={seen ? "success" : "neutral"}>{seen ? "เห็นแล้ว" : "ยังไม่เห็น"}</Badge>
            <span className={cx("ml-2 font-mono text-xs break-all", MUTED)}>{item.seenKey(userId)}</span>
          </Fact>
        )}
      </dl>
      <div className="min-w-0">
        <Steps item={item} />
      </div>
    </section>
  )
}

export default function OnboardingGallery() {
  const navigate = useNavigate()
  const location = useLocation()
  const { can } = useCan()
  const preview = usePreview()
  const userId = getUser()?.id ?? null
  const previewable = ONBOARDING_ITEMS.filter((item) => item.preview).length
  const related = RELATED_LINKS.filter((link) => can(link.perm))

  const start = async (item) => {
    if (item.preview === "wizard") {
      navigate(WIZARD_PATH, { state: { trigger: item.key } })
      return
    }
    if (item.preview === "wizard-locked") {
      navigate(WIZARD_PATH, { state: { trigger: item.key, lockedFrom: "ยื่นใบลา" } })
      return
    }
    try {
      await loadHost()
    } catch {
      toast.error("เปิดตัวอย่างไม่สำเร็จ", { description: "ตรวจสอบอินเทอร์เน็ต แล้วโหลดหน้านี้ใหม่" })
      return
    }
    startPreview(item.preview, item.key)
  }

  // Focus goes back to the button that started the preview, whether it ran here or on another page.
  const focusTrigger = (key) =>
    requestAnimationFrame(() => document.querySelector(`[data-preview-trigger="${key}"]`)?.focus())

  const lastTrigger = useRef(null)
  useEffect(() => {
    if (preview) lastTrigger.current = preview.trigger
    else if (lastTrigger.current) {
      focusTrigger(lastTrigger.current)
      lastTrigger.current = null
    }
  }, [preview])

  const returnedFrom = location.state?.previewReturn
  const handedOver = location.state?.previewNext
  useEffect(() => {
    if (!returnedFrom) return
    focusTrigger(returnedFrom)
    if (handedOver) toast.info("ขั้นต่อไปคือทัวร์เมนู กด “ดูตัวอย่าง” ที่แถวนี้เพื่อดูต่อ")
    // the note is for this arrival only: not again on reload or when coming back
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
  }, [returnedFrom, handedOver, navigate, location.pathname, location.search])

  return (
    <div className="p-1 md:p-2">
      <PageTitle title={PAGE_TITLE} />
      <p className={cx("max-w-3xl text-sm leading-relaxed", MUTED)}>
        <span className="font-medium text-gray-800 tabular-nums dark:text-gray-200">
          {ONBOARDING_ITEMS.length} รายการ ดูตัวอย่างได้ {previewable} รายการ
        </span>
        <span className="block">
          ตัวอย่างเปิดของจริง แต่ไม่ส่งข้อมูลเข้าระบบ ไม่เก็บที่พิมพ์ และไม่นับว่าเห็นแล้ว ของจริงจึงยังขึ้นตามปกติ
        </span>
      </p>

      <div className="mt-4">
        {ONBOARDING_ITEMS.map((item) => (
          <Item key={item.key} item={item} userId={userId} onStart={start} />
        ))}
      </div>

      {related.length > 0 && (
        <section aria-labelledby="ob-related" className="mt-4 border-t border-gray-200/70 pt-5 dark:border-line">
          <h2 id="ob-related" className="text-base font-bold text-gray-900 dark:text-gray-100">ที่เกี่ยวข้อง</h2>
          <ul className="mt-2 space-y-2">
            {related.map((link) => (
              <li key={link.key} className="text-sm leading-relaxed">
                <Link
                  to={link.to}
                  state={backState(PAGE_TITLE)}
                  className={cx("inline-flex min-h-touch items-center rounded font-medium text-indigo-700 underline underline-offset-2 md:pointer-fine:min-h-0 dark:text-indigo-300", focusRingCls)}
                >
                  {link.label}
                </Link>
                <span className={cx("block", MUTED)}>{link.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
