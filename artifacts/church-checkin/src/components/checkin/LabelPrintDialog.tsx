import { LabelData } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface LabelCardProps {
  label: LabelData;
  index: number;
  total: number;
}

function LabelCard({ label, index, total }: LabelCardProps) {
  return (
    <div className="label-card w-full border border-border rounded-lg bg-white text-black overflow-hidden">
      {/* Child Name Tag */}
      <div className="p-4 bg-white flex flex-col justify-between" style={{ minHeight: "140px" }}>
        <div className="flex justify-between items-start">
          <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
            {label.organizationName || "Church Check-In"}
            {total > 1 && (
              <span className="ml-2 text-primary font-bold">
                {index + 1}/{total}
              </span>
            )}
          </div>
          <div className="text-[10px] text-gray-500 font-mono">
            {format(new Date(label.checkinDate), "MMM d, h:mm a")}
          </div>
        </div>

        <div className="my-2">
          <h2 className="text-3xl font-bold leading-none tracking-tight">{label.childName}</h2>
          <div className="flex justify-between items-end mt-2">
            <span className="text-sm font-medium text-gray-700">{label.room || "No Room Assigned"}</span>
            <span className="text-sm text-gray-500">{label.guardianName}</span>
          </div>
        </div>

        <div className="flex justify-between items-end">
          <div className="flex flex-col max-w-[60%] gap-0.5">
            {label.allergies && (
              <span className="text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded inline-block w-fit">
                ALG: {label.allergies}
              </span>
            )}
            {label.specialNeeds && (
              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded inline-block w-fit">
                NOTE: {label.specialNeeds}
              </span>
            )}
          </div>
          <div className="text-xl font-mono font-bold tracking-widest bg-gray-100 px-2 py-1 rounded">
            {label.labelCode}
          </div>
        </div>
      </div>

      {/* Dotted separator */}
      <div className="border-t-2 border-dashed border-gray-300 w-full" />

      {/* Guardian Security Stub */}
      <div className="p-3 bg-gray-50 flex flex-col justify-between" style={{ minHeight: "72px" }}>
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Pickup Security Stub
          </span>
          <span className="text-[10px] text-gray-400 font-mono">
            {format(new Date(label.checkinDate), "MMM d")}
          </span>
        </div>
        <div className="flex justify-between items-end mt-1">
          <div>
            <div className="text-sm font-semibold">{label.guardianName}</div>
            <div className="text-xs text-gray-500">For: {label.childName} · {label.room || "No Room"}</div>
          </div>
          <div className="text-lg font-mono font-bold tracking-widest text-gray-800">
            {label.labelCode}
          </div>
        </div>
      </div>
    </div>
  );
}

interface LabelPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: LabelData[];
}

export function LabelPrintDialog({ open, onOpenChange, labels }: LabelPrintDialogProps) {
  if (labels.length === 0) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Print-only area — rendered outside dialog so window.print() captures it */}
      <div id="print-labels" className="hidden print:block">
        {labels.map((label, i) => (
          <div key={i} className="print-label-wrapper">
            <LabelCard label={label} index={i} total={labels.length} />
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm print:hidden" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {labels.length > 1
                ? `Print ${labels.length} Labels`
                : "Print Check-In Label"}
            </DialogTitle>
          </DialogHeader>

          {/* Scrollable label preview */}
          <div className="max-h-[55vh] overflow-y-auto space-y-4 py-2 pr-1">
            {labels.map((label, i) => (
              <LabelCard key={i} label={label} index={i} total={labels.length} />
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X className="w-4 h-4 mr-1" /> Close
            </Button>
            <Button onClick={handlePrint} data-testid="button-print-labels">
              <Printer className="w-4 h-4 mr-2" />
              Print {labels.length > 1 ? `All ${labels.length} Labels` : "Label"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
