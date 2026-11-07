// src/components/onboarding/OnboardingBanner.jsx
// Compact resume strip on Home while onboarding is not done: "กรอกข้อมูลต่อ" before unlock,
// "เริ่มทัวร์เมนู" / "ดูทัวร์ต่อ" after. Hidden while the tour itself is running.
// `preview` (gallery, Super Admin) = { ob, tour, onAction }: a given state instead of the real one,
// and the button calls onAction instead of going anywhere.
import { useNavigate } from "react-router-dom"
import ProgressRing from "./ProgressRing"
import { bannerCopy } from "./bannerCopy"
import { SECTIONS, useOnboarding } from "../../lib/onboarding"
import { resumeTour, startTour, useTourState } from "../../lib/tourState"
import { cx, primaryBtnCls } from "../../lib/styles"

export default function OnboardingBanner({ preview = null }) {
  const liveOb = useOnboarding()
  const liveTour = useTourState()
  const navigate = useNavigate()
  const ob = preview?.ob ?? liveOb
  const tour = preview?.tour ?? liveTour
  if (!ob.needsOnboarding) return null
  if (ob.unlocked && tour.active) return null

  const { unlocked, resuming, title, sub, cta } = bannerCopy(ob, tour)
  const go = () => {
    if (preview) preview.onAction()
    else if (!unlocked) navigate("/onboarding")
    else if (resuming) resumeTour()
    else startTour(0)
  }

  return (
    <section
      aria-label="ข้อมูลเริ่มต้น"
      className="animate-fade-up flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-indigo-200/80 sm:flex-row sm:items-center sm:p-5 dark:bg-surface dark:shadow-none dark:ring-indigo-400/25"
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <ProgressRing
          value={unlocked ? SECTIONS.length : ob.confirmedCount}
          total={SECTIONS.length}
          size={52}
          stroke={5}
        />
        <div className="min-w-0">
          <p className="text-base font-semibold leading-relaxed text-gray-900 dark:text-gray-100">{title}</p>
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{sub}</p>
        </div>
      </div>
      <button type="button" onClick={go} className={cx(primaryBtnCls, "h-11 w-full shrink-0 px-5 sm:w-auto")}>
        {cta}
      </button>
    </section>
  )
}
