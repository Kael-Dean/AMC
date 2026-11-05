# Backend request — ขอออกนอกสถานที่: เพิ่ม "วันกลับ" (return_date)

ที่มา: FE ต้องการให้ฟอร์ม "ขอออกนอกสถานที่" (`/work/out-of-office`) ระบุ **วันกลับ** ได้ (กรณีไปค้างคืน/หลายวัน)
ตรวจแล้วที่ `um_backend` (`Phase3/out_of_office_router.py`, `out_of_office_service.py`, alembic `section18A1`, `section28A1`):
**ยังไม่มี field วันกลับ** — มีแค่ `request_date` (วันออก) + `time_out` + `time_back` (เวลากลับ ของวันเดียวกัน)
FE ส่ง `return_date` ไปตอนนี้ไม่ได้: pydantic จะทิ้ง field ที่ไม่รู้จักเงียบ ๆ → ข้อมูลหาย

## สิ่งที่ขอ

### 1. DB (alembic ใหม่)
`outofoffice_request.return_date DATE NULL`
- NULL = กลับวันเดียวกับ `request_date` (พฤติกรรมเดิม, แถวเก่าไม่ต้อง backfill)
- constraint: `return_date IS NULL OR return_date >= request_date`

### 2. `POST /personnel/me/out-of-office` (`OOOCreate`)
เพิ่ม `return_date: Optional[date] = None`
- ถ้าส่งมา ต้อง `>= request_date` ไม่งั้น 422 `"วันกลับต้องไม่ก่อนวันที่ออก"`
- ถ้า `return_date == request_date` ให้ normalize เป็น `null` (หรือเก็บตามจริงก็ได้ แต่ขอให้ตอบกลับสม่ำเสมอ)
- `request_type == "personal"`: **ถามฝั่งนโยบาย** ว่าอนุญาตหลายวันไหม (ถ้าไม่ → 422 เหมือนกฎ work-detail เดิม)

### 3. กฎ validate ที่ต้องตัดสินใจ (`validate_request`)
กฎปัจจุบันผูกกับ "วันเดียว": ช่วงเวลาต้องอยู่ใน `work_start–work_end`, ไม่เกิน `half_day_hours`,
ซ้อนทับคำขออื่น (`time_out < time_back AND ...` ในวันเดียวกัน), `วันที่ขอไม่ใช่วันทำการ`
เมื่อมี `return_date > request_date` (หลายวัน) ต้องกำหนดว่า:
- a) ข้ามกฎครึ่งวัน/เวลาทำงานเมื่อเป็นหลายวันหรือไม่ — **FE เสนอ: ข้าม** (ไม่งั้นหลายวันยื่นไม่ได้เลย)
   และ `time_out` = เวลาออกวันแรก, `time_back` = เวลากลับวัน `return_date`
- b) เช็คซ้อนทับต้องเทียบเป็นช่วง (request_date+time_out → COALESCE(return_date, request_date)+time_back)
- c) `วันที่ขอไม่ใช่วันทำการ` เช็คเฉพาะวันออก หรือทุกวันในช่วง
- d) นับโควตา `personal_monthly_limit` หลายวันนับกี่ครั้ง
- e) `duration_hours` ในรายงาน (`hr_out_of_office*.html`) ต้องคำนวณข้ามวัน

### 4. Response (`OOOOut`) + ทุก endpoint ที่คืนคำขอ
เพิ่ม `return_date: Optional[date]` ใน `OOOOut`
→ `GET /personnel/me/out-of-office`, รายการอนุมัติ/inbox, `/hr/out-of-office*`, ตอบกลับ POST/attachments/cancel
- ข้อความ notify (`router L243`) ใส่ช่วงวันเมื่อ `return_date` ไม่ null
- report PDF/Excel + template `hr_out_of_office*.html` แสดงวันกลับ
- `isCancellable` ฝั่ง FE ใช้ `request_date + time_out` (ยกเลิกได้ก่อนเริ่ม) — ไม่กระทบ

## FE จะทำเมื่อ BE พร้อม
- ฟอร์ม: ช่อง "วันกลับ" (date, `min = วันที่ออก`, ไม่บังคับ → default = วันเดียวกัน) ส่ง `return_date` เฉพาะเมื่อ > วันออก
- แสดง "2 พ.ย. – 4 พ.ย. 2569" ในรายการของฉัน / OutOfOfficeApprovals / Inbox / HROutOfOfficeTab / Documents
- ปรับ `WorkdayStrip` / hint ครึ่งวัน ให้ซ่อนเมื่อเลือกหลายวัน

## ขอให้ตอบกลับ
1. ยืนยันชื่อ field `return_date` (ถ้าอยากใช้ชื่ออื่นแจ้งมา)
2. คำตอบข้อ 3 a–e
3. deploy ลง dev ให้แล้วแจ้ง FE
