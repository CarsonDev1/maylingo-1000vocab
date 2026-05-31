import { Button } from "@/components/ui/button";
import { Flame } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React from "react";

type Props = {
  points: number;
  streak: number;
};

const UserProgress = ({ points, streak }: Props) => {
  return (
    <div className="flex items-center justify-between gap-x-2 w-full">
      <Link href="/lessons">
        <Button variant="ghost">
          <Image src="/us.svg" alt="English" width={32} height={32} className="rounded-md border mr-2" />
          English
        </Button>
      </Link>
      <Link href="/stats">
        <Button variant="ghost" className="text-orange-500">
          <Image src="/points.svg" height={28} width={28} alt="Points" className="mr-2" />
          {points}
        </Button>
      </Link>
      <Link href="/stats">
        <Button variant="ghost" className="text-rose-500">
          <Flame className="h-5 w-5 mr-2 fill-rose-500" />
          {streak}
        </Button>
      </Link>
    </div>
  );
};

export default UserProgress;
