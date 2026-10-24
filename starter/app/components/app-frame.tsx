import Link from "next/link"
import type { ReactNode } from "react"
import { fmtDateTime } from "@/lib/present/time"
import { Icon } from "./icons"

export type Section = "queue" | "board" | "inbox" | "settings" | "driver" | "customers" | "drivers" | "sites"

const GROUPS: { label: string; links: { section: Section; href: string; label: string; icon: string; badge?: string }[] }[] = [
  {
    label: "Control Room",
    links: [
      { section: "queue", href: "/", label: "Needs You", icon: "alert", badge: "14" },
      { section: "board", href: "/board", label: "All 100 Orders", icon: "car" },
      { section: "inbox", href: "/inbox", label: "Support Inbox", icon: "inbox" },
    ],
  },
  {
    label: "Agents & Field",
    links: [
      { section: "settings", href: "/settings", label: "Autonomy Dial", icon: "arrow" },
      { section: "driver", href: "/driver?d=drv-140", label: "Driver Mobile App", icon: "driver" },
    ],
  },
  {
    label: "Directory",
    links: [
      { section: "customers", href: "/customers", label: "Dealers & Buyers", icon: "people" },
      { section: "drivers", href: "/drivers", label: "Driver Network", icon: "driver" },
      { section: "sites", href: "/sites", label: "Sites & Yards", icon: "building" },
    ],
  },
]

export function AppFrame({
  children,
  section,
  snapshotAt,
  board = false,
}: {
  children: ReactNode
  section: Section
  snapshotAt?: string | null
  board?: boolean
}) {
  return (
    <div className={`app${board ? " app-board" : ""}`}>
      <aside className="sidebar">
        <Link href="/" className="wordmark" aria-label="Bahn Control Room home">
          <span style={{ color: "#fd6a31", marginRight: "6px" }}>●</span>
          BAHN CONTROL ROOM
        </Link>
        <div style={{ padding: "0 10px", marginTop: "-16px", marginBottom: "8px", fontSize: "11px", color: "var(--subtle)" }}>
          25,000 Deliveries / Year · 50 Ops
        </div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {GROUPS.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.links.map((link) => (
                <Link
                  key={link.section}
                  href={link.href}
                  className={`nav-link${section === link.section ? " active" : ""}`}
                  aria-current={section === link.section ? "page" : undefined}
                >
                  <Icon name={link.icon} size={15} />
                  <span style={{ flex: 1 }}>{link.label}</span>
                  {link.badge && (
                    <span
                      style={{
                        background: "var(--red-bg)",
                        color: "var(--red-ink)",
                        padding: "1px 6px",
                        borderRadius: "999px",
                        fontSize: "11px",
                        fontWeight: 600,
                      }}
                    >
                      {link.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          {snapshotAt ? `Snapshot: ${fmtDateTime(snapshotAt)}` : "Snapshot: 21 Oct 09:00 UTC"}
          <br />
          <span style={{ color: "var(--teal-ink)", fontWeight: 500 }}>● 86 Orders Running Quietly</span>
        </div>
      </aside>
      <div className="main">{children}</div>
    </div>
  )
}
