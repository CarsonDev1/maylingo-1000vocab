"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, RotateCw, BookOpen, BarChart3, Trophy, PenLine, Mic, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

// Mirrors the native app's bottom tabs (mobile/src/app/(tabs)/_layout.tsx).
const TABS = [
  { label: "Learn", href: "/dashboard", Icon: GraduationCap, match: ["/dashboard", "/lessons", "/learn"] },
  { label: "Review", href: "/review", Icon: RotateCw, match: ["/review"] },
  { label: "Writing", href: "/writing", Icon: PenLine, match: ["/writing"] },
  { label: "Speaking", href: "/speaking", Icon: Mic, match: ["/speaking"] },
  { label: "Roadmap", href: "/topics", Icon: Globe, match: ["/topics"] },
  { label: "Notebook", href: "/notebook", Icon: BookOpen, match: ["/notebook"] },
  { label: "Achievements", href: "/stats", Icon: BarChart3, match: ["/stats"] },
  { label: "Leaderboard", href: "/leaderboard", Icon: Trophy, match: ["/leaderboard"] },
];

/** Bottom tab bar for mobile — replaces the sidebar/hamburger so the web matches the app. Hidden on lg+. */
export default function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex border-t border-slate-200 bg-white lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TABS.map(({ label, href, Icon, match }) => {
        const active = match.some((m) => pathname.startsWith(m));
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors",
              active ? "text-green-600" : "text-slate-400",
            )}
          >
            <Icon className="h-6 w-6" strokeWidth={active ? 2.5 : 2} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
