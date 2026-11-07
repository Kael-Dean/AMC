// src/components/onboarding/searchIntroSteps.js
// CONTENT of the search intro: SearchIntro.jsx plays it, the gallery lists it. No React here, and
// not in lib/searchIntro.js because that file is always loaded and this copy should stay lazy.
// Copy rules (same as onboardingTour.js): short Thai sentences, no em dash, one idea per line.
export const SEARCH_INTRO_STEPS = [
  {
    key: "find",
    title: "ค้นหาฟังก์ชันได้จากช่องนี้",
    lines: ["สวัสดี น้องมะลิเอง", "พิมพ์คำที่นึกออก แล้วไปยังฟังก์ชันที่คุณใช้ได้ทันทีจากทุกหน้า"],
    queries: ["ลา", "สลิป", "รายงาน"],
    fallback: "พิมพ์ชื่อฟังก์ชันที่ต้องการ แล้วเลือกจากรายการ",
  },
  {
    key: "typos",
    title: "พิมพ์ผิดก็เจอ",
    lines: ["ไม่ใส่วรรณยุกต์ หรือพิมพ์ผิดบางตัว ก็ยังเจอ", "คำที่พูดกันทุกวันก็ใช้ได้"],
    queries: ["เงนเดือน", "แจง", "กู้"],
    fallback: "พิมพ์คำที่นึกออก ระบบจะหาฟังก์ชันที่ใกล้เคียงให้",
  },
  {
    key: "try",
    title: "ลองเลย",
    lines: ["กดปุ่มด้านล่าง แล้วพิมพ์ในช่องค้นหาได้เลย"],
    queries: [],
    tryWords: ["ลา", "สลิป", "กู้", "รายงาน"],
    fallback: "พิมพ์ชื่อฟังก์ชันที่ต้องการ",
  },
]
