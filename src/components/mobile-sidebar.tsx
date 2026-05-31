import Sidebar from "@/components/sidebar";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import React from "react";

const MobileSidebar = () => {
  return (
    <Sheet>
      <SheetTrigger>
        <Menu className="text-white" />
      </SheetTrigger>
      <SheetContent className="p-0 z-[100]" side="left">
        <SheetTitle className="sr-only">Điều hướng</SheetTitle>
        <Sidebar />
      </SheetContent>
    </Sheet>
  );
};

export default MobileSidebar;
