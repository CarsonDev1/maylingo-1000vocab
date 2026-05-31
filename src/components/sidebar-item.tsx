"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  iconSrc: string;
  href: string;
  iconClassName?: string;
};

const SidebarItem = ({ label, iconSrc, href, iconClassName }: Props) => {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Button variant={active ? "sidebarOutline" : "sidebar"} className="justify-start h-[52px]" asChild>
      <Link href={href}>
        <Image src={iconSrc} alt={label} className={cn("mr-5", iconClassName)} height={32} width={32} />
        {label}
      </Link>
    </Button>
  );
};

export default SidebarItem;
