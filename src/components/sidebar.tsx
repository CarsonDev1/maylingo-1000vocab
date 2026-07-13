import SidebarItem from "@/components/sidebar-item";
import { cn } from "@/lib/utils";
import { ClerkLoaded, ClerkLoading, UserButton } from "@clerk/nextjs";
import { Loader } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React from "react";

type Props = {
  className?: string;
};

const Sidebar = ({ className }: Props) => {
  return (
    <div className={cn("flex h-full lg:w-[256px] lg:fixed left-0 top-0 px-4 border-r-2 flex-col", className)}>
      <Link href="/dashboard">
        <div className="pt-8 pl-4 pb-7 flex items-center gap-x-3">
          <Image src="/mascot.svg" width={40} height={40} alt="Mascot" />
          <h1 className="text-2xl font-extrabold text-green-600 tracking-wide">Maylingo</h1>
        </div>
      </Link>
      <div className="flex flex-col gap-y-2 flex-1">
        <SidebarItem label="Learn" href="/lessons" iconSrc="/learn.svg" />
        <SidebarItem label="Review" href="/review" iconSrc="/points.svg" />
        <SidebarItem label="Writing" href="/writing" iconSrc="/writing.svg" />
        <SidebarItem label="Speaking" href="/speaking" iconSrc="/speaking.svg" />
        <SidebarItem label="Roadmap" href="/topics" iconSrc="/globe.svg" />
        <SidebarItem label="Notebook" href="/notebook" iconSrc="/notebook.svg" iconClassName="scale-100" />
        <SidebarItem label="Achievements" href="/stats" iconSrc="/leaderboard.svg" />
        <SidebarItem label="Leaderboard" href="/leaderboard" iconSrc="/leaderboard-1.svg" />
      </div>
      <div className="p-4">
        <ClerkLoading>
          <Loader className="h-5 w-5 text-muted-foreground animate-spin" />
        </ClerkLoading>
        <ClerkLoaded>
          <UserButton afterSignOutUrl="/" />
        </ClerkLoaded>
      </div>
    </div>
  );
};

export default Sidebar;
