// src/components/CompanySearchStatus.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Outcome of the company name search (Buy / Sales), shown under the input when
// the search has nothing to list: zero results, or the request failed.
//
// Only speaks about the query the server actually answered. `companySearchOutcome`
// is null while a search is in flight, and an answer for older text no longer
// matches the input, so nothing shows during the debounce or after a pick.
//
// The role="status" wrapper stays mounted so screen readers announce the change.
// `form` = the page's props-bag.
// ─────────────────────────────────────────────────────────────────────────────
import { Link } from "react-router-dom"
import { ExternalLink } from "lucide-react"
import Can from "./Can"
import { cx, focusRingCls } from "../lib/styles"

const panelCls =
  "mt-1 w-full rounded-xl bg-white px-3 py-2 text-sm shadow-lg ring-1 ring-gray-200 " +
  "dark:bg-gray-800 dark:ring-gray-700"

export default function CompanySearchStatus({ form }) {
  const { customer, showCompanyList, companyResults, companySearchOutcome: outcome } = form
  const query = customer.companyName.trim()
  const show =
    showCompanyList && query.length >= 2 && companyResults.length === 0 && outcome?.query === query

  return (
    <div role="status" aria-live="polite">
      {show && outcome.failed && (
        <p className={cx(panelCls, "text-red-700 dark:text-red-300")}>ค้นหาบริษัทไม่สำเร็จ ลองพิมพ์ใหม่อีกครั้ง</p>
      )}
      {show && !outcome.failed && (
        <div className={cx(panelCls, "text-gray-700 dark:text-gray-200")}>
          <p className="break-words">ไม่พบบริษัท “{query}” ในระบบ</p>
          <Can perm="customers.create">
            {/* New tab: the half-filled order stays intact in this one */}
            <Link
              to="/company-add?new=1"
              target="_blank"
              rel="noopener"
              className={cx(
                "inline-flex min-h-touch items-center gap-1 rounded font-medium text-indigo-700 hover:underline md:mt-1 md:min-h-0 dark:text-indigo-300",
                focusRingCls,
              )}
            >
              เพิ่มบริษัทใหม่
              <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2} />
              <span className="sr-only">(เปิดในแท็บใหม่)</span>
            </Link>
          </Can>
        </div>
      )}
    </div>
  )
}
