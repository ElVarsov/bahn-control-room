import Link from "next/link"
import type { ReactNode } from "react"
import { fmtDateTime } from "@/lib/present/time"
import { Icon } from "./icons"

export type Section = "queue" | "map" | "board" | "inbox" | "settings" | "driver" | "customers" | "drivers" | "sites"

const GROUPS: { label: string; links: { section: Section; href: string; label: string; icon: string }[] }[] = [
  { label: "Work", links: [
    { section: "queue", href: "/", label: "Needs you", icon: "flag" },
    { section: "map", href: "/map", label: "Fleet radar map", icon: "ferry" },
    { section: "board", href: "/board", label: "All orders", icon: "car" },
    { section: "inbox", href: "/inbox", label: "Inbox", icon: "inbox" },
  ] },
  { label: "Agents", links: [
    { section: "settings", href: "/settings", label: "Autonomy dial", icon: "bot" },
    { section: "driver", href: "/driver?d=drv-140", label: "Driver app", icon: "phone" },
  ] },
  { label: "People and places", links: [
    { section: "customers", href: "/customers", label: "Customers", icon: "people" },
    { section: "drivers", href: "/drivers", label: "Drivers", icon: "driver" },
    { section: "sites", href: "/sites", label: "Places", icon: "building" },
  ] },
]

export function AppFrame({ children, section, snapshotAt, board = false }: { children: ReactNode; section: Section; snapshotAt?: string | null; board?: boolean }) {
  return <div className={`app${board ? " app-board" : ""}`}>
    <aside className="sidebar">
      <div>
        <Link href="/" className="wordmark" aria-label="Control Room home" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "4px 10px" }}>
          <span style={{ width: "26px", height: "26px", borderRadius: "7px", background: "var(--ink)", color: "var(--birch)", display: "inline-grid", placeItems: "center", fontSize: "13px", fontWeight: 800 }}>
            B
          </span>
          <span style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "-0.02em" }}>
            Bahn Ops
          </span>
        </Link>
        <div style={{ margin: "8px 10px 16px", padding: "5px 9px", borderRadius: "7px", background: "var(--teal-bg)", border: "1px solid rgba(31,111,123,0.2)", display: "flex", alignItems: "center", gap: "7px" }}>
          <span className="agent-pulse state-working" style={{ width: "6px", height: "6px" }} />
          <span style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--teal-ink)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Autonomous Corridor
          </span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {GROUPS.map((group) => <div className="nav-group" key={group.label}>
          <div className="nav-label">{group.label}</div>
          {group.links.map((link) => {
            const isActive = section === link.section
            return (
              <Link
                key={link.section}
                href={link.href}
                className={`nav-link${isActive ? " active" : ""}`}
                aria-current={isActive ? "page" : undefined}
                style={{ justifyContent: "space-between" }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
                  <Icon name={link.icon} size={15} />
                  {link.label}
                </span>
                {link.section === "queue" && (
                  <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "1px 7px", borderRadius: "10px", background: "var(--red-bg)", color: "var(--red-ink)", border: "1px solid rgba(180,44,66,0.2)" }}>
                    Action
                  </span>
                )}
                {link.section === "map" && (
                  <span style={{ fontSize: "10px", fontWeight: 700, padding: "1px 5px", borderRadius: "6px", background: "var(--green-bg)", color: "var(--green-ink)", letterSpacing: "0.04em" }}>
                    LIVE
                  </span>
                )}
              </Link>
            )
          })}
        </div>)}
      </nav>

      <div className="sidebar-foot" style={{ marginTop: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", paddingBottom: "8px", borderBottom: "1px solid var(--hair-soft)" }}>
          <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "var(--ink)", display: "grid", placeItems: "center", fontSize: "11px", fontWeight: 700, color: "var(--birch)" }}>
            CR
          </div>
          <div>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink)" }}>Control Room</div>
            <div style={{ fontSize: "10.5px", color: "var(--subtle)" }}>Operations Desk · Helsinki</div>
          </div>
        </div>
        <div>
          {snapshotAt ? `Snapshot ${fmtDateTime(snapshotAt)}` : "Live Simulation"}<br />
          Fictional dataset · read only
        </div>
      </div>
    </aside>
    <div className="main">{children}</div>
  </div>
}
