import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import React from "react";

export function PageHeader({ title, back }: { title: string; back?: string }) {
  return (
    <div className="sticky top-0 bg-white pb-3 lg:pt-[28px] lg:mt-[-28px] flex items-center justify-between border-b-2 mb-5 text-neutral-400 lg:z-50">
      {back ? (
        <Link href={back}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-5 w-5 stroke-2 text-neutral-400" />
          </Button>
        </Link>
      ) : (
        <div className="w-9" />
      )}
      <h1 className="font-bold text-lg text-neutral-700">{title}</h1>
      <div className="w-9" />
    </div>
  );
}
