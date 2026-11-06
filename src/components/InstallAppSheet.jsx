// src/components/InstallAppSheet.jsx
// iPhone / iPad have no install prompt: the only way in is Add to Home Screen.
// Button names match what iOS shows in Thai.
import { Share } from "lucide-react"
import { Sheet } from "./ui"
import { cx, primaryBtnCls } from "../lib/styles"

const STEPS = [
  <>
    แตะปุ่มแชร์{" "}
    <Share aria-label="ไอคอนแชร์" strokeWidth={1.75} className="inline-block size-[18px] -translate-y-px text-indigo-600 dark:text-indigo-300" />{" "}
    ในแถบของ Safari (iPhone อยู่ด้านล่าง, iPad อยู่มุมขวาบน)
  </>,
  <>เลื่อนลงแล้วแตะ <strong className="font-semibold text-gray-900 dark:text-gray-100">เพิ่มไปยังหน้าจอโฮม</strong></>,
  <>แตะ <strong className="font-semibold text-gray-900 dark:text-gray-100">เพิ่ม</strong> ที่มุมขวาบน แล้วเปิดแอปจากไอคอนบนหน้าจอโฮม</>,
]

export default function InstallAppSheet({ open, onClose }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="ติดตั้งแอปลงเครื่อง"
      size="sm"
      footer={
        <div className="md:flex md:justify-end">
          <button type="button" onClick={onClose} className={cx(primaryBtnCls, "h-12 w-full md:h-10 md:w-auto")}>
            เข้าใจแล้ว
          </button>
        </div>
      }
    >
      <ol className="space-y-4">
        {STEPS.map((step, i) => (
          <li key={i} className="flex gap-3 text-sm leading-6 text-gray-700 dark:text-gray-300">
            <span
              aria-hidden="true"
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
            >
              {i + 1}
            </span>
            <span className="min-w-0">{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm leading-6 text-gray-500 dark:text-gray-400">
        ถ้าเปิดลิงก์จาก LINE หรือแอปอื่นอยู่ ให้เปิดหน้านี้ใน Safari ก่อน
      </p>
    </Sheet>
  )
}
