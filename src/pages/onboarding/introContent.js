// src/pages/onboarding/introContent.js
// Words of the wizard's opening and closing steps: IntroSteps.jsx shows them, the gallery lists
// them, Onboarding.jsx walks the step order. No JSX here (react-refresh rule).
import { Clock3, Compass, FilePenLine } from "lucide-react"
import { SECTION_KEYS } from "../../lib/onboarding"

export const WIZARD_STEP_KEYS = ["welcome", ...SECTION_KEYS, "ready", "done"]

export const WELCOME_POINTS = [
  { icon: Clock3, text: "กรอกข้อมูลประมาณ 10 นาที", sub: "บันทึกทีละหัวข้อ หยุดกลางทางแล้วกลับมาทำต่อได้ ต้องทำให้ครบก่อนจึงจะใช้เมนูอื่นได้" },
  { icon: Compass, text: "ทัวร์เมนูบริการตนเอง 1 นาที", sub: "รู้จักเมนูลา สลิปเงินเดือน เงินกู้ และสวัสดิการ" },
  { icon: FilePenLine, text: "หลังจากนี้แก้ข้อมูลผ่านเมนูแจ้งแก้ไขข้อมูล", sub: "HR จะตรวจสอบและอนุมัติให้" },
]

export const INTRO_COPY = {
  welcome: { title: "เตรียมข้อมูลของคุณให้พร้อมใช้งาน", resumeTitle: "มาทำต่อจากที่ค้างไว้" },
  ready: {
    title: "ข้อมูลครบแล้ว",
    body: "ขอบคุณที่สละเวลา ไปดูเมนูบริการตนเองกัน ใช้เวลาประมาณ 1 นาที จุดสุดท้ายของทัวร์กด “ส่งข้อมูลยืนยัน” แล้วเมนูทั้งหมดจะเปิดให้ใช้",
  },
  done: {
    title: "ข้อมูลเริ่มต้นเรียบร้อยแล้ว",
    body: "ถ้าข้อมูลของคุณเปลี่ยน ให้ใช้ปุ่ม “แจ้งแก้ไขข้อมูล” ในหน้าข้อมูลส่วนตัว HR จะตรวจสอบและแก้ให้",
  },
}
