"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import SidebarItem from "@/components/sidebar-item";

const ITEMS = [
  { label: "Learn", href: "/lessons", iconSrc: "/learn.svg" },
  { label: "Review", href: "/review", iconSrc: "/points.svg" },
  { label: "Writing", href: "/writing", iconSrc: "/writing.svg" },
  { label: "Notebook", href: "/notebook", iconSrc: "/notebook.svg", iconClassName: "scale-100" },
  { label: "Achievements", href: "/stats", iconSrc: "/leaderboard.svg" },
  { label: "Leaderboard", href: "/leaderboard", iconSrc: "/leaderboard-1.svg" },
];

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");

/** Client-side nav: highlights the clicked item immediately instead of waiting for the server render. */
export default function SidebarNav() {
  const pathname = usePathname();
  const [pending, setPending] = useState<string | null>(null);

  // Navigation finished (or changed) — fall back to the real pathname.
  useEffect(() => setPending(null), [pathname]);

  return (
    <>
      {ITEMS.map((item) => (
        <SidebarItem
          key={item.href}
          {...item}
          active={pending ? pending === item.href : isActive(pathname, item.href)}
          onNavigate={() => setPending(item.href)}
        />
      ))}
    </>
  );
}
