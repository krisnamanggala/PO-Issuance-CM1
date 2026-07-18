import Link from "next/link";
import type { ReactNode } from "react";

type WorkspaceShellProps = {
  active: "overview" | "register" | "execution" | "bonds" | "alerts" | "master" | "settings";
  user: { displayName: string; email: string; role: "admin" | "editor" };
  children: ReactNode;
};

const navigation = [
  { key: "overview", href: "/", label: "Overview" },
  { key: "register", href: "/register", label: "PO Register" },
  { key: "execution", href: "/execution", label: "Delivery & Cash" },
  { key: "bonds", href: "/bonds", label: "Bond Register" },
  { key: "alerts", href: "/alerts", label: "Alerts" },
  { key: "master", href: "/master-data", label: "Master Data" },
  { key: "settings", href: "/settings", label: "Settings" },
] as const;

export function WorkspaceShell({ active, user, children }: WorkspaceShellProps) {
  return (
    <main className="workspace-shell">
      <header className="workspace-topbar">
        <Link className="workspace-brand" href="/" aria-label="TPEC CM1 PO Monitoring overview">
          <span className="workspace-brand-mark" aria-hidden="true">T</span>
          <span><strong>TPEC CM1</strong><small>PO MONITORING</small></span>
        </Link>
        <div className="workspace-user">
          <span className="workspace-label"><i /> CM1 Workspace</span>
          <span className="workspace-user-name" title={user.email}>{user.displayName}</span>
          <span className="role-chip">{user.role}</span>
          <form action="/sign-out" method="post"><button type="submit" className="text-button">Sign out</button></form>
        </div>
      </header>
      <div className="workspace-body">
        <nav className="workspace-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <Link key={item.key} href={item.href} className={active === item.key ? "active" : ""} aria-current={active === item.key ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="workspace-content">{children}</div>
      </div>
    </main>
  );
}
