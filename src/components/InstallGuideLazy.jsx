// src/components/InstallGuideLazy.jsx
// Always-loaded doorway to the install guide, whose steps and pictures are a chunk that people who
// never open it don't download. Plain React.lazy, not lazyWithReload: a missing chunk must not
// reload the page under someone's work for an optional guide.
import { Component, lazy, Suspense } from "react"
import { toast } from "./ui/toast"

const InstallGuide = lazy(() => import("./InstallGuide"))

class ChunkBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    toast.error("เปิดคู่มือติดตั้งไม่สำเร็จ", { description: "ตรวจสอบอินเทอร์เน็ต แล้วโหลดหน้านี้ใหม่" })
    this.props.onError()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export default function InstallGuideLazy({ open, onClose, preview = false }) {
  if (!open) return null
  return (
    <ChunkBoundary onError={onClose}>
      <Suspense fallback={null}>
        <InstallGuide onClose={onClose} preview={preview} />
      </Suspense>
    </ChunkBoundary>
  )
}
