// src/pages/onboarding/IntroSteps.jsx
// Welcome (start / continue), Ready (all 8 confirmed → start the tour) and Done (completed).
import { Check } from "lucide-react"
import { Link } from "react-router-dom"
import Celebration from "../../components/onboarding/Celebration"
import ProgressRing from "../../components/onboarding/ProgressRing"
import { SECTIONS } from "../../lib/onboarding"
import { TOUR_LENGTH } from "../../lib/onboardingTour"
import { useTourState } from "../../lib/tourState"
import { cx, focusRingCls, neutralBtnCls, primaryBtnCls } from "../../lib/styles"
import { INTRO_COPY, WELCOME_POINTS } from "./introContent"
import { firstNameOnly } from "./sectionFlow"

const bigBtn = "h-12 w-full px-6 text-base md:pointer-fine:h-12 md:w-auto"

export function WelcomeStep({ data, confirmedCount, onStart, onGoStep }) {
  const name = firstNameOnly(data?.values?.account?.th_first_name)
  const started = confirmedCount > 0
  const sections = data?.sections ?? {}
  return (
    <section aria-labelledby="ob-welcome-title" className="mx-auto max-w-xl">
      <div className="flex items-center gap-5">
        <ProgressRing value={confirmedCount} total={SECTIONS.length} size={88} stroke={7} />
        <div className="min-w-0">
          <p className="text-base text-gray-600 dark:text-gray-300">สวัสดี{name ? ` คุณ${name}` : ""}</p>
          <h1 id="ob-welcome-title" className="mt-0.5 text-2xl font-bold leading-snug text-balance text-gray-900 md:text-[28px] dark:text-gray-100">
            {started ? INTRO_COPY.welcome.resumeTitle : INTRO_COPY.welcome.title}
          </h1>
        </div>
      </div>

      <ul className="mt-8 space-y-5">
        {WELCOME_POINTS.map((point) => {
          const { icon: PointIcon, text, sub } = point
          return (
          <li key={text} className="flex gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
              <PointIcon aria-hidden="true" className="size-5" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 pt-0.5">
              <span className="block text-base font-semibold leading-relaxed text-gray-900 dark:text-gray-100">{text}</span>
              <span className="block text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">{sub}</span>
            </span>
          </li>
          )
        })}
      </ul>

      <div className="mt-8">
        <button type="button" onClick={onStart} className={cx(primaryBtnCls, bigBtn)}>
          {started ? "ทำต่อ" : "เริ่มเลย"}
        </button>
      </div>

      {/* 7-topic checklist: overview + jump straight to any topic */}
      <nav aria-label="หัวข้อทั้งหมด" className="mt-10 border-t border-gray-200/70 pt-6 dark:border-line">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">หัวข้อทั้งหมด {SECTIONS.length} หัวข้อ</h2>
        <ol className="mt-2">
          {SECTIONS.map((s, i) => {
            const done = Boolean(sections[s.key]?.confirmed_at)
            return (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => onGoStep(s.key)}
                  className={cx(
                    "flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl px-2 text-left transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-white/[.05]",
                    focusRingCls,
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                      done
                        ? "bg-emerald-600 text-white dark:bg-emerald-500"
                        : "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200 dark:bg-white/[.06] dark:text-gray-300 dark:ring-line",
                    )}
                  >
                    {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-[15px] font-medium text-gray-800 dark:text-gray-100">{s.label}</span>
                  <span className={cx("text-sm", done ? "text-emerald-700 dark:text-emerald-300" : "text-gray-500 dark:text-gray-400")}>
                    {done ? "เรียบร้อย" : "ยังไม่ได้ทำ"}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>
    </section>
  )
}

export function ReadyStep({ onStartTour, onReview, starting }) {
  const tour = useTourState()
  return (
    <section aria-labelledby="ob-ready-title" className="mx-auto flex max-w-md flex-col items-center pt-4 text-center md:pt-10">
      <Celebration size={144} />
      <h1 id="ob-ready-title" className="mt-4 text-2xl font-bold leading-snug text-gray-900 md:text-[28px] dark:text-gray-100">
        {INTRO_COPY.ready.title}
      </h1>
      <p className="mt-2 text-base leading-relaxed text-gray-600 dark:text-gray-300">
        {INTRO_COPY.ready.body}
      </p>
      {tour.started && (
        <p className="mt-3 text-[15px] font-medium tabular-nums text-gray-700 dark:text-gray-200">
          ค้างไว้ที่จุด {tour.index + 1} จาก {TOUR_LENGTH}
        </p>
      )}
      <div className="mt-8 flex w-full flex-col gap-3 md:w-auto md:flex-row md:justify-center">
        <button
          type="button"
          onClick={onStartTour}
          disabled={starting}
          className={cx(primaryBtnCls, bigBtn, "md:min-w-64")}
          data-autofocus
        >
          {tour.started ? "ดูทัวร์ต่อ" : "เริ่มทัวร์เมนู"}
        </button>
        <button type="button" onClick={onReview} className={cx(neutralBtnCls, bigBtn)}>
          ตรวจข้อมูลอีกครั้ง
        </button>
      </div>
    </section>
  )
}

export function DoneStep({ onHome, profilePath = "/my-profile" }) {
  return (
    <section aria-labelledby="ob-done-title" className="mx-auto max-w-md pt-4 text-center md:pt-10">
      <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
        <Check aria-hidden="true" className="size-8" strokeWidth={2.25} />
      </span>
      <h1 id="ob-done-title" className="mt-5 text-2xl font-bold leading-snug text-gray-900 dark:text-gray-100">
        {INTRO_COPY.done.title}
      </h1>
      <p className="mt-2 text-base leading-relaxed text-gray-600 dark:text-gray-300">
        {INTRO_COPY.done.body}
      </p>
      <div className="mt-8 flex flex-col gap-3 md:flex-row md:justify-center">
        <button type="button" onClick={onHome} className={cx(primaryBtnCls, bigBtn)}>
          กลับหน้าหลัก
        </button>
        <Link to={profilePath} className={cx(neutralBtnCls, bigBtn)}>
          ไปหน้าข้อมูลส่วนตัว
        </Link>
      </div>
    </section>
  )
}
