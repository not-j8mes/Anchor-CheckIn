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
    <div
      className="label-card bg-white text-black overflow-hidden"
      style={{
        width: "62mm",
        boxSizing: "border-box",
        fontFamily: "Arial, sans-serif",
        border: "1px solid #d1d5db",
      }}
    >
      {/* Main section */}
      <div style={{ padding: "3mm 3.5mm 2mm" }}>
        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5mm" }}>
          <span style={{ fontSize: "6pt", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {label.organizationName || "Church Check-In"}
          </span>
          <span style={{ fontSize: "6pt", color: "#9ca3af", fontFamily: "monospace" }}>
            {format(new Date(label.checkinDate), "MMM d, h:mm a")}
            {total > 1 && (
              <span style={{ marginLeft: "1.5mm", color: "#2563eb", fontWeight: 700 }}>
                {index + 1}/{total}
              </span>
            )}
          </span>
        </div>

        {/* Child name */}
        <div style={{ fontSize: "20pt", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.01em", marginBottom: "1mm" }}>
          {label.childName}
        </div>

        {/* Room + guardian */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2mm" }}>
          <span style={{ fontSize: "9pt", fontWeight: 600, color: "#374151" }}>
            {label.room || "No Room Assigned"}
          </span>
          <span style={{ fontSize: "8pt", color: "#6b7280" }}>{label.guardianName}</span>
        </div>

        {/* Alerts */}
        {(label.allergies || label.specialNeeds) && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1mm", marginBottom: "2mm" }}>
            {label.allergies && (
              <div style={{ fontSize: "7.5pt", fontWeight: 700, color: "#dc2626", background: "#fef2f2", border: "0.5px solid #fca5a5", borderRadius: "2px", padding: "0.8mm 1.5mm" }}>
                ⚠ ALLERGY: {label.allergies}
              </div>
            )}
            {label.specialNeeds && (
              <div style={{ fontSize: "7.5pt", fontWeight: 700, color: "#b45309", background: "#fffbeb", border: "0.5px solid #fcd34d", borderRadius: "2px", padding: "0.8mm 1.5mm" }}>
                ℹ {label.specialNeeds}
              </div>
            )}
          </div>
        )}

        {/* Security code */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "2mm" }}>
          <div style={{ fontFamily: "monospace", fontSize: "18pt", fontWeight: 800, letterSpacing: "0.12em", background: "#f3f4f6", padding: "1mm 2.5mm", borderRadius: "2px", border: "0.5px solid #d1d5db" }}>
            {label.labelCode}
          </div>
        </div>
      </div>

      {/* Dashed separator */}
      <div style={{ borderTop: "1.5px dashed #d1d5db", margin: "0 3mm" }} />

      {/* Guardian stub */}
      <div style={{ background: "#f9fafb", padding: "2mm 3.5mm", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: "5.5pt", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.8mm" }}>
            Pickup Security Stub
          </div>
          <div style={{ fontSize: "8pt", fontWeight: 600 }}>{label.guardianName}</div>
          <div style={{ fontSize: "6.5pt", color: "#6b7280" }}>
            {label.childName}{label.room ? ` · ${label.room}` : ""}
          </div>
        </div>
        <div style={{ fontFamily: "monospace", fontSize: "15pt", fontWeight: 800, letterSpacing: "0.1em", color: "#1f2937" }}>
          {label.labelCode}
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
        <DialogContent className="max-w-xs print:hidden" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {labels.length > 1 ? `Print ${labels.length} Labels` : "Print Check-In Label"}
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto max-h-[65vh] space-y-4 py-2 flex flex-col items-center">
            {labels.map((label, i) => (
              <LabelCard key={i} label={label} index={i} total={labels.length} />
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X className="w-4 h-4 mr-1" /> Close
            </Button>
            <Button onClick={() => window.print()} data-testid="button-print-labels">
              <Printer className="w-4 h-4 mr-2" />
              Print {labels.length > 1 ? `All ${labels.length} Labels` : "Label"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
