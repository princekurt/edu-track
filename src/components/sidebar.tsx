"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/app/actions/auth";
import { ROLE_LABELS } from "@/lib/constants";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  roles: Role[];
  showUnread?: boolean;
}

const ALL: Role[] = ["administrator", "scholarship_staff", "compliance", "disbursement", "scholar"];
const STAFF: Role[] = ["administrator", "scholarship_staff", "compliance", "disbursement"];
const RECORD_STAFF: Role[] = ["administrator", "scholarship_staff"];

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", roles: ALL },
  { href: "/scholars", label: "Scholars", roles: STAFF },
  { href: "/requirements", label: "Requirements", roles: RECORD_STAFF },
  { href: "/disbursements", label: "Disbursements", roles: STAFF },
  { href: "/concerns", label: "Concerns", roles: ALL },
  { href: "/notifications", label: "Notifications", roles: ALL, showUnread: true },
  { href: "/reports", label: "Reports", roles: STAFF },
  { href: "/admin/users", label: "Account management", roles: ["administrator"] },
  { href: "/admin/audit", label: "Audit log", roles: ["administrator"] },
  { href: "/admin/periods", label: "Periods & rules", roles: ["administrator"] },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Sidebar({
  profile,
  unread,
}: {
  profile: { full_name: string; email: string; role: Role };
  unread: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const items = NAV_ITEMS.filter((item) => item.roles.includes(profile.role));

  const nav = (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {items.map((item) => {
        const active =
          pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn("nav-link", active && "nav-link-active")}
            onClick={() => setOpen(false)}
          >
            <span>{item.label}</span>
            {item.showUnread && unread > 0 ? (
              <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white">
                {unread}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="border-t border-slate-200 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
          {initials(profile.full_name || profile.email)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">
            {profile.full_name || "Unnamed user"}
          </p>
          <p className="truncate text-xs text-slate-500">{ROLE_LABELS[profile.role]}</p>
        </div>
      </div>
      <form action={signOut} className="mt-3">
        <button type="submit" className="btn-secondary w-full">
          Sign out
        </button>
      </form>
    </div>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 no-print lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            ET
          </span>
          <span className="text-sm font-semibold text-slate-900">EduTrack</span>
        </Link>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label="Toggle navigation"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-white shadow-xl">
            <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
                ET
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">EduTrack</p>
                <p className="text-xs text-slate-500">EduKar Monitoring</p>
              </div>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      ) : null}

      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-slate-200 bg-white no-print lg:flex">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            ET
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">EduTrack</p>
            <p className="text-xs text-slate-500">EduKar Monitoring</p>
          </div>
        </div>
        {nav}
        {footer}
      </aside>
    </>
  );
}
