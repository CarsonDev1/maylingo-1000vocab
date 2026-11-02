"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  iconSrc: string;
  href: string;
  active: boolean;
  onNavigate?: () => void;
  iconClassName?: string;
};

const SidebarItem = ({ label, iconSrc, href, active, onNavigate, iconClassName }: Props) => {
  return (
    <Button variant={active ? "sidebarOutline" : "sidebar"} className="justify-start h-[52px]" asChild>
      <Link href={href} onClick={onNavigate}>
        <Image src={iconSrc} alt={label} className={cn("mr-5", iconClassName)} height={32} width={32} />
        {label}
      </Link>
    </Button>
  );
};

export default SidebarItem;
