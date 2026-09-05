"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/lib/actions/auth";
import { LogOut } from "lucide-react";

const NAV_GROUPS = [
  {
    label: "Cashflow Harian",
    items: [
      { href: "/transaksi", label: "Input & Tabel Transaksi" },
      { href: "/dashboard/cashflow", label: "Dashboard Cashflow" },
    ],
  },
  {
    label: "Investasi",
    items: [
      { href: "/investasi", label: "Input & Tabel Investasi" },
      { href: "/dashboard/investasi", label: "Dashboard Investasi" },
    ],
  },
] as const;

export function Sidebar({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-[230px] min-w-[230px] flex-col bg-sidebar px-[18px] py-7 text-sidebar-foreground">
      <div>
        <div className="font-[family-name:var(--font-heading)] text-[19px] font-semibold tracking-tight">
          Cuan.id
        </div>
        <div className="mb-9 mt-1 text-[11px] text-[#8FA3C4]">
          Personal Finance Tracker
        </div>
      </div>

      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <div className="mb-2 mt-4 ml-2 text-[10.5px] font-semibold uppercase tracking-wider text-[#5D75A0]">
            {group.label}
          </div>
          {group.items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium text-[#C6D2E6] transition-colors hover:bg-white/[0.06] hover:text-white",
                  active && "bg-white text-primary hover:bg-white hover:text-primary"
                )}
              >
                <span
                  className={cn(
                    "h-[5px] w-[5px] rounded-full bg-current opacity-50",
                    active && "opacity-70"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}

      <div className="mt-auto border-t border-white/10 pt-4 text-[11.5px] leading-relaxed text-[#5D75A0]">
        {userEmail && <div className="mb-2 truncate text-[#C6D2E6]">{userEmail}</div>}
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex items-center gap-1.5 text-[#8FA3C4] transition-colors hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            Keluar
          </button>
        </form>
      </div>
    </aside>
  );
}
