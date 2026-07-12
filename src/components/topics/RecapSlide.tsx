"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RecapSlide({ title, onDone }: { title: string; onDone: (score?: number) => void }) {
  const items = ["Topic vocabulary + images", "Real-life example sentences", "Grammar/context notes", "AI speaking practice"];
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 text-center">
      <h2 className="text-2xl font-extrabold text-neutral-800">Completed: {title} 🎉</h2>
      <div className="flex flex-col gap-2 text-left">
        {items.map((t, i) => (
          <motion.div key={t} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
            className="flex items-center gap-3 rounded-xl border-2 border-green-100 bg-green-50 px-4 py-2.5 font-medium text-neutral-700">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white"><Check className="h-4 w-4" /></span>
            {t}
          </motion.div>
        ))}
      </div>
      <Button variant="primary" className="w-full" onClick={() => onDone()}>Done</Button>
    </div>
  );
}
