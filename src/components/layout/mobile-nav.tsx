"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "./sidebar";

interface MobileNavProps {
  role: "ADMIN" | "EMPLOYEE";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileNav({ role, open, onOpenChange }: MobileNavProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Menú de navegación</SheetTitle>
        </SheetHeader>
        <Sidebar role={role} className="border-r-0" />
      </SheetContent>
    </Sheet>
  );
}
