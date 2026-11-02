import { Loader } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
