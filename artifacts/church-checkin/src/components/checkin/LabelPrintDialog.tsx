import { LabelData } from "@workspace/api-client-react";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { renderLabelHtml, printLabels } from "@/lib/label-renderer";

interface LabelPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: LabelData[];
}

export function LabelPrintDialog({ open, onOpenChange, labels }: LabelPrintDialogProps) {
  if (labels.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {labels.length > 1 ? `Print ${labels.length} Labels` : "Print Check-In Label"}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-auto max-h-[70vh] space-y-4 py-2 flex flex-col items-center">
          {labels.map((label, i) => (
            <div
              key={i}
              style={{ transform: "scale(0.85)", transformOrigin: "top center" }}
              dangerouslySetInnerHTML={{ __html: renderLabelHtml(label, i, labels.length) }}
            />
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-1" /> Close
          </Button>
          <Button onClick={() => printLabels(labels)} data-testid="button-print-labels">
            <Printer className="w-4 h-4 mr-2" />
            Print {labels.length > 1 ? `All ${labels.length} Labels` : "Label"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
