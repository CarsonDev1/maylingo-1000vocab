import Image from "next/image";

export default function Loading() {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
      <Image src="/loading.jpg" alt="" width={220} height={220} priority className="animate-bounce mix-blend-multiply" />
      <p className="text-sm font-bold text-green-600">Loading…</p>
    </div>
  );
}
