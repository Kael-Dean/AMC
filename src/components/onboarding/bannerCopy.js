// src/components/onboarding/bannerCopy.js
// Words of the Home resume strip for one state. OnboardingBanner.jsx shows them, the gallery lists them.
import { SECTIONS } from "../../lib/onboarding"
import { TOUR_LENGTH } from "../../lib/onboardingTour"

/** `ob`: { unlocked, confirmedCount } · `tour`: { started, index } */
export function bannerCopy(ob, tour) {
  const unlocked = ob.unlocked
  const resuming = unlocked && tour.started
  const title = unlocked ? "ข้อมูลครบแล้ว เหลือดูทัวร์เมนูอีกนิด" : "กรอกข้อมูลเริ่มต้นให้ครบ เพื่อเปิดเมนูบริการตนเอง"
  const sub = unlocked
    ? resuming
      ? `ค้างไว้ที่จุด ${tour.index + 1} จาก ${TOUR_LENGTH}`
      : "ใช้เวลาประมาณ 1 นาที แล้วเมนูทั้งหมดจะเปิดให้ใช้"
    : `กรอกแล้ว ${ob.confirmedCount} จาก ${SECTIONS.length} หัวข้อ ใช้เวลาประมาณ 10 นาที`
  const cta = unlocked ? (resuming ? "ดูทัวร์ต่อ" : "เริ่มทัวร์เมนู") : ob.confirmedCount > 0 ? "กรอกข้อมูลต่อ" : "เริ่มกรอกข้อมูล"
  return { unlocked, resuming, title, sub, cta }
}

/** The four states the strip can be in, as `{ ob, tour }`. */
export const BANNER_STATES = [
  { key: "new", ob: { needsOnboarding: true, unlocked: false, confirmedCount: 0 }, tour: { active: false, started: false, index: 0 } },
  { key: "partial", ob: { needsOnboarding: true, unlocked: false, confirmedCount: 3 }, tour: { active: false, started: false, index: 0 } },
  { key: "ready", ob: { needsOnboarding: true, unlocked: true, confirmedCount: SECTIONS.length }, tour: { active: false, started: false, index: 0 } },
  { key: "resume", ob: { needsOnboarding: true, unlocked: true, confirmedCount: SECTIONS.length }, tour: { active: false, started: true, index: 2 } },
]
