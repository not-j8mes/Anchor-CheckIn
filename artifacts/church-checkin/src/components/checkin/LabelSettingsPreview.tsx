import { useEffect, useMemo, useState } from "react";
import type { LabelData } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import {
  labelDataForType,
  printLabels,
  renderLabelHtml,
  renderParentPickupLabelHtml,
} from "@/lib/label-renderer";
import { cn } from "@/lib/utils";

export const SAMPLE_LABEL: LabelData = {
  childName: "Charlotte Thomas",
  guardianName: "Elizabeth Thomas",
  labelCode: "A7K4",
  checkinDate: "2026-07-28T09:15:00.000Z",
  room: "Nursery",
  allergies: "Tree nuts",
  specialNeeds: null,
};

function ScaledLabel({
  html,
  accessibleLabel,
}: {
  html: string;
  accessibleLabel: string;
}) {
  return (
    <div
      className="mx-auto h-[48.36mm] w-[70.2mm] max-w-full overflow-hidden rounded-[3px] shadow-sm sm:h-[55.8mm] sm:w-[81mm]"
      role="img"
      aria-label={accessibleLabel}
    >
      <div
        className="h-[62mm] w-[90mm] origin-top-left scale-[0.78] sm:scale-90"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

export function LabelSettingsPreview({
  labelType,
  printingEnabled,
  organizationName,
  eventName,
}: {
  labelType: string;
  printingEnabled: boolean;
  organizationName?: string | null;
  eventName?: string | null;
}) {
  const [securityTab, setSecurityTab] = useState<"child" | "parent">("child");
  const isSecurity = labelType === "child_security";
  const previewLabel = useMemo(
    () =>
      labelDataForType(
        {
          ...SAMPLE_LABEL,
          organizationName:
            [organizationName?.trim() || "Your Organization", eventName?.trim()]
              .filter(Boolean)
              .join(" · "),
        },
        labelType,
      ),
    [eventName, labelType, organizationName],
  );

  useEffect(() => setSecurityTab("child"), [labelType]);

  const typeName =
    labelType === "child_security"
      ? "Child security label"
      : labelType === "simple_name"
        ? "Simple child label"
        : "Simple name tag";
  const html =
    isSecurity && securityTab === "parent"
      ? renderParentPickupLabelHtml([previewLabel])
      : renderLabelHtml(previewLabel, 0, 1);

  return (
    <aside
      className="min-w-0 rounded-xl border bg-muted/20 p-4"
      aria-label={`Sample preview of ${typeName}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Label Preview</h3>
            <Badge variant="secondary" className="text-[10px]">
              Sample
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Preview updates as you change the settings.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">90 × 62 mm</span>
      </div>

      {isSecurity && (
        <div
          className="mt-3 grid grid-cols-2 rounded-lg border bg-background p-0.5"
          role="tablist"
          aria-label="Security label preview"
        >
          {(["child", "parent"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={securityTab === tab}
              onClick={() => setSecurityTab(tab)}
              className={cn(
                "min-h-10 rounded-md px-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                securityTab === tab
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab === "child" ? "Child Label" : "Parent Label"}
            </button>
          ))}
        </div>
      )}

      <div className="relative mt-4 overflow-hidden rounded-lg bg-slate-100 p-3">
        <div
          className={cn(
            "transition-opacity",
            !printingEnabled && "opacity-35",
          )}
          aria-hidden={!printingEnabled}
        >
          <ScaledLabel
            html={html}
            accessibleLabel={`Sample ${securityTab === "parent" && isSecurity ? "parent pickup" : typeName} preview for ${previewLabel.organizationName}`}
          />
        </div>
        {!printingEnabled && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <p className="rounded-md border bg-background/95 px-3 py-2 text-center text-xs font-semibold shadow-sm">
              Label printing is currently off
            </p>
          </div>
        )}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Printed size and font rendering may vary slightly by browser and
        printer.
      </p>

      <Button
        type="button"
        variant="outline"
        className="mt-4 w-full gap-2"
        onClick={() => printLabels([previewLabel], labelType)}
      >
        <Printer className="h-4 w-4" />
        Print Test Label
      </Button>
      <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
        Opens your browser’s print dialog using the sample shown above.
      </p>
    </aside>
  );
}
