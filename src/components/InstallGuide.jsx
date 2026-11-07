// src/components/InstallGuide.jsx
// ─────────────────────────────────────────────────────────────────────────────
// "How to install this app" for computer, Android and iPhone / iPad. A lazy chunk: open it through
// InstallGuideLazy.jsx. Copy lives in lib/installGuideContent.js, pictures in InstallGuideArt.jsx.
//
// All the steps sit on one scrolling view, not a wizard: people read this while looking at
// their browser's own menu. The Sheet is not shown at all inside the installed app (no entry point).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from "react"
import { CircleCheck, Copy, Download, TriangleAlert } from "lucide-react"
import { Sheet, Tabs, panelId, tabId, toast } from "./ui"
import InstallGuideArt from "./InstallGuideArt"
import {
  INSTALL_GUIDE,
  PLATFORM_TABS,
  WORDING_NOTE,
  browserWarning,
  defaultVariant,
} from "../lib/installGuideContent"
import { detectInstallPlatform, promptInstall, useAppInstalled, useInstallOption } from "../lib/pwa"
import { cx, neutralBtnCls, primaryBtnCls, tabPanelCls } from "../lib/styles"

const STRONG = "font-semibold text-gray-900 dark:text-gray-100"
const HEADING = "text-sm font-bold text-gray-900 dark:text-gray-100"
const BODY = "text-sm leading-6 text-gray-700 dark:text-gray-300"
const MUTED = "text-sm leading-6 text-gray-500 dark:text-gray-400"
// Tabs stretch to the Sheet's width, so three labels fit a 320px screen without scrolling.
const FULL_TABS = "w-full [&>button]:min-w-0 [&>button]:flex-1 [&>button]:justify-center [&>button]:px-2"

/** *x* in the copy marks the label to look for on screen. */
function Rich({ text }) {
  return text.split("*").map((part, i) => (i % 2 ? <strong key={i} className={STRONG}>{part}</strong> : part))
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // In-app browsers often have no clipboard API
    const opener = document.activeElement
    const field = document.createElement("textarea")
    field.value = text
    field.setAttribute("readonly", "")
    field.className = "cell-input fixed left-0 top-0 opacity-0"
    document.body.append(field)
    field.select()
    let copied = false
    try {
      copied = document.execCommand("copy")
    } catch {
      copied = false
    }
    field.remove()
    opener?.focus?.({ preventScroll: true })
    return copied
  }
}

function BrowserWarning({ warning }) {
  const url = `${window.location.origin}/`
  const copy = async () => {
    if (await copyText(url)) toast.success("คัดลอกลิงก์แล้ว", { description: "นำไปวางในแถบที่อยู่ของเบราว์เซอร์" })
    else toast.error("คัดลอกไม่สำเร็จ", { description: "กดค้างที่ลิงก์ในกล่องนี้ เพื่อคัดลอกเอง" })
  }
  return (
    <div
      role={warning.kind === "inApp" ? "alert" : undefined}
      className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200 dark:bg-amber-900/25 dark:ring-amber-800/40"
    >
      <p className="flex items-start gap-2 text-sm font-bold leading-6 text-amber-900 dark:text-amber-200">
        <TriangleAlert aria-hidden="true" strokeWidth={2} className="mt-1 size-4 shrink-0" />
        {warning.title}
      </p>
      {warning.lines.map((line) => (
        <p key={line} className="mt-1 text-sm leading-6 text-amber-900 dark:text-amber-100">
          {line}
        </p>
      ))}
      <p className="mt-2 select-all break-all text-sm font-medium text-amber-900 dark:text-amber-100">{url}</p>
      <button type="button" onClick={copy} className={cx(neutralBtnCls, "mt-3 w-full sm:w-auto")}>
        <Copy aria-hidden="true" strokeWidth={1.75} className="size-4" />
        คัดลอกลิงก์
      </button>
    </div>
  )
}

function Steps({ steps }) {
  return (
    <ol className="mt-5 space-y-6">
      {steps.map((step, i) => (
        <li key={step.art + i} className="flex gap-3">
          <span
            aria-hidden="true"
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
          >
            {i + 1}
          </span>
          <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[minmax(0,1fr)_13.5rem] sm:gap-5">
            <div className="min-w-0">
              <p className={BODY}>
                <Rich text={step.text} />
              </p>
              {step.hint && (
                <p className={cx(MUTED, "mt-1")}>
                  <Rich text={step.hint} />
                </p>
              )}
            </div>
            <InstallGuideArt name={step.art} />
          </div>
        </li>
      ))}
    </ol>
  )
}

function AfterInstall({ lines }) {
  return (
    <ul className="mt-2 list-disc space-y-1 pl-5 marker:text-gray-400 dark:marker:text-gray-500">
      {lines.map((line) => (
        <li key={line} className={BODY}>
          {line}
        </li>
      ))}
    </ul>
  )
}

export default function InstallGuide({ onClose }) {
  const detected = useMemo(() => detectInstallPlatform(), [])
  const installOption = useInstallOption()
  const installed = useAppInstalled()
  const [platform, setPlatform] = useState(detected.platform)
  // Each platform remembers its own browser tab, so switching away and back loses nothing.
  const [variants, setVariants] = useState(() => ({ [detected.platform]: defaultVariant(detected) }))
  const panelRef = useRef(null)
  const successRef = useRef(null)

  const guide = INSTALL_GUIDE[platform]
  const variantValue = variants[platform] ?? guide.defaultVariant
  const variant = guide.variants.find((v) => v.value === variantValue) ?? guide.variants[0]

  const canPrompt = installOption === "prompt" && !detected.inApp
  const warning = canPrompt ? null : browserWarning(detected)

  // The button under the keyboard focus disappears on these changes: keep focus in the sheet.
  const wasInstalled = useRef(installed)
  useEffect(() => {
    if (installed && !wasInstalled.current) successRef.current?.focus({ preventScroll: true })
    wasInstalled.current = installed
  }, [installed])

  const install = () => {
    panelRef.current?.focus({ preventScroll: true })
    promptInstall().catch(() => {}) // the manual steps are right below
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="ติดตั้งแอปลงเครื่อง"
      size="lg"
      footer={
        <div className="md:flex md:justify-end">
          <button type="button" onClick={onClose} className={cx(primaryBtnCls, "h-12 w-full md:w-auto")}>
            เข้าใจแล้ว
          </button>
        </div>
      }
    >
      {installed ? (
        <>
          <div
            ref={successRef}
            tabIndex={-1}
            role="status"
            className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200 focus:outline-none dark:bg-emerald-900/25 dark:ring-emerald-800/40"
          >
            <p className="flex items-start gap-2 text-sm font-bold leading-6 text-emerald-900 dark:text-emerald-200">
              <CircleCheck aria-hidden="true" strokeWidth={2} className="mt-1 size-4 shrink-0" />
              ติดตั้งแล้ว
            </p>
            <p className="mt-1 text-sm leading-6 text-emerald-900 dark:text-emerald-100">
              {INSTALL_GUIDE[detected.platform].openHint}
            </p>
          </div>
          <h3 className={cx(HEADING, "mt-6")}>หลังติดตั้ง</h3>
          <AfterInstall lines={INSTALL_GUIDE[detected.platform].after} />
        </>
      ) : (
        <>
          {warning && (
            <div className="mb-4">
              <BrowserWarning warning={warning} />
            </div>
          )}

          {canPrompt && (
            <div className="mb-4 flex flex-col gap-3 rounded-2xl bg-indigo-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:bg-indigo-500/10">
              <p className="text-sm font-medium leading-6 text-indigo-900 dark:text-indigo-100">
                เบราว์เซอร์นี้พร้อมติดตั้งแล้ว
              </p>
              <button type="button" onClick={install} className={cx(primaryBtnCls, "h-12 shrink-0 md:pointer-fine:h-10")}>
                <Download aria-hidden="true" strokeWidth={2} className="size-4" />
                ติดตั้งเลย
              </button>
            </div>
          )}

          <Tabs
            items={PLATFORM_TABS}
            value={platform}
            onChange={setPlatform}
            ariaLabel="อุปกรณ์"
            idBase="install-platform"
            className={FULL_TABS}
          />

          <div
            ref={panelRef}
            role="tabpanel"
            id={panelId("install-platform", platform)}
            aria-labelledby={tabId("install-platform", platform)}
            tabIndex={0}
            className={cx(tabPanelCls, "mt-4")}
          >
            <p className={cx(MUTED, "mb-2")}>{guide.switchLabel}</p>
            <Tabs
              items={guide.variants.map(({ value, label }) => ({ value, label }))}
              value={variant.value}
              onChange={(value) => setVariants((prev) => ({ ...prev, [platform]: value }))}
              ariaLabel={guide.switchLabel}
              idBase={`install-${platform}`}
              size="sm"
              className={FULL_TABS}
            />

            <div
              role="tabpanel"
              id={panelId(`install-${platform}`, variant.value)}
              aria-labelledby={tabId(`install-${platform}`, variant.value)}
              className="mt-4"
            >
              {variant.note && <p className={cx(BODY, "font-medium")}>{variant.note}</p>}
              <p className={cx(MUTED, variant.note && "mt-1")}>{WORDING_NOTE}</p>
              <Steps steps={variant.steps} />
              {guide.note && <p className={cx(MUTED, "mt-5")}>{guide.note}</p>}
            </div>

            <h3 className={cx(HEADING, "mt-8")}>หลังติดตั้ง</h3>
            <AfterInstall lines={guide.after} />

            <h3 className={cx(HEADING, "mt-8")}>ถ้าไม่เจอปุ่มนี้</h3>
            <dl className="mt-2 divide-y divide-gray-100 dark:divide-line">
              {guide.trouble.map(({ problem, fix }) => (
                <div key={problem} className="py-3 first:pt-1 last:pb-0">
                  <dt className={cx(BODY, "font-medium text-gray-900 dark:text-gray-100")}>{problem}</dt>
                  <dd className={MUTED}>{fix}</dd>
                </div>
              ))}
            </dl>
          </div>
        </>
      )}
    </Sheet>
  )
}
