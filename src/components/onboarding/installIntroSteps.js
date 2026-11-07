// src/components/onboarding/installIntroSteps.js
// CONTENT of the install intro: InstallIntro.jsx shows it, the gallery lists it. No React here, and
// not in lib/installIntro.js because that file is always loaded and this copy should stay lazy.
// Copy rules (same as onboardingTour.js): short Thai sentences, no em dash, one idea per line.
export const INSTALL_INTRO_STEPS = [
  {
    key: "home",
    title: "ติดตั้งแอปลงเครื่องได้แล้ว",
    lines: ["สวัสดี น้องมะลิเอง", "ตอนนี้ติดตั้งระบบนี้ไว้ในเครื่องได้ ไม่ต้องเปิดผ่านเว็บทุกครั้ง"],
  },
  {
    key: "open",
    title: "เปิดจากไอคอนได้เลย",
    lines: ["กดไอคอนบนเครื่อง ระบบจะเปิดเต็มจอ ไม่มีแถบเบราว์เซอร์", "ยังต้องต่ออินเทอร์เน็ตเหมือนเดิม ข้อมูลไม่ได้เก็บไว้ในเครื่อง"],
  },
  {
    key: "where",
    title: "ติดตั้งตอนนี้เลยไหม",
    lines: ["ดูวิธีติดตั้งสำหรับเครื่องนี้ได้เลย", "ถ้ายังไม่สะดวก กลับมาได้ที่เมนู “ติดตั้งแอป”"],
  },
]

export const INSTALL_INTRO_ACTIONS = {
  next: "ถัดไป",
  back: "ย้อนกลับ",
  later: "ไว้ก่อน",
  guide: "ดูวิธีติดตั้ง",
}
