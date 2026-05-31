import { useEffect, useRef } from "react";
import { LabelData } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface LabelPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labelData: LabelData | null;
}

export function LabelPrintDialog({ open, onOpenChange, labelData }: LabelPrintDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  if (!labelData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md print:hidden">
        <DialogHeader>
          <DialogTitle>Print Check-In Label</DialogTitle>
        </DialogHeader>

        <div className="py-6 flex justify-center">
          {/* Label Preview */}
          <div className="w-[300px] border border-border rounded-lg shadow-sm bg-white text-black overflow-hidden relative" ref={printRef}>
            
            {/* Child Label */}
            <div className="p-4 bg-white min-h-[200px] flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                  {labelData.organizationName || "Church Check-In"}
                </div>
                <div className="text-[10px] text-gray-500 font-mono">
                  {format(new Date(labelData.checkinDate), "MMM d, h:mm a")}
                </div>
              </div>
              
              <div className="my-2">
                <h2 className="text-3xl font-bold leading-none tracking-tight">{labelData.childName}</h2>
                <div className="flex justify-between items-end mt-2">
                  <span className="text-sm font-medium">{labelData.room || "No Room"}</span>
                  <span className="text-sm text-gray-600">{labelData.guardianName}</span>
                </div>
              </div>
              
              <div className="flex justify-between items-end">
                <div className="flex flex-col max-w-[60%]">
                  {labelData.allergies && (
                    <span className="text-xs font-bold text-red-600 bg-red-50 px-1 rounded inline-block w-fit">
                      ALG: {labelData.allergies}
                    </span>
                  )}
                  {labelData.specialNeeds && (
                    <span className="text-xs font-bold text-amber-600 bg-amber-50 px-1 rounded inline-block w-fit mt-1">
                      NOTE: {labelData.specialNeeds}
                    </span>
                  )}
                </div>
                <div className="text-xl font-mono font-bold tracking-widest bg-gray-100 px-2 py-1 rounded">
                  {labelData.labelCode}
                </div>
              </div>
            </div>

            {/* Dotted separator */}
            <div className="border-t-2 border-dashed border-gray-300 w-full relative">
              <div className="absolute -left-2 -top-2 w-4 h-4 bg-background rounded-full border-r border-gray-300 hidden print:block"></div>
              <div className="absolute -right-2 -top-2 w-4 h-4 bg-background rounded-full border-l border-gray-300 hidden print:block"></div>
            </div>

            {/* Guardian Security Stub */}
            <div className="p-4 bg-gray-50 h-[100px] flex flex-col justify-between">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase">Security Stub</span>
                <span className="text-[10px] text-gray-500 font-mono">
                  {format(new Date(labelData.checkinDate), "MMM d")}
                </span>
              </div>
              
              <div className="flex justify-between items-end mt-2">
                <div>
                  <div className="text-sm font-medium">{labelData.guardianName}</div>
                  <div className="text-xs text-gray-600">For: {labelData.childName} ({labelData.room})</div>
                </div>
                <div className="text-lg font-mono font-bold tracking-widest">
                  {labelData.labelCode}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" /> Print Label
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
