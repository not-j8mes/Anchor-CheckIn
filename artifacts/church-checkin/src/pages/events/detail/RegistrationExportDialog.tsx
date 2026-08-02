import { useEffect, useMemo, useState } from "react";
import { differenceInYears, format, parseISO } from "date-fns";
import type { Registration, Room } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Loader2 } from "lucide-react";
import {
  buildCsv,
  downloadCsv,
  getEventRegistrationsExport,
  selectRegistrationExportRows,
  type RegistrationExportRow,
} from "./registrationExport";

type ExportScope = "all" | "filtered" | "rooms";
type ExportPreset = "standard" | "safety" | "full" | "custom";

type FieldDefinition = {
  id: string;
  label: string;
  group:
    | "Child information"
    | "Parent / guardian"
    | "Safety information"
    | "Registration";
  value: (row: RegistrationExportRow) => unknown;
  available?: (rows: RegistrationExportRow[]) => boolean;
};

const FIELDS: FieldDefinition[] = [
  {
    id: "fullName",
    label: "Child name",
    group: "Child information",
    value: (r) => r.fullName,
  },
  {
    id: "firstName",
    label: "First name",
    group: "Child information",
    value: (r) => r.firstName,
  },
  {
    id: "lastName",
    label: "Last name",
    group: "Child information",
    value: (r) => r.lastName,
  },
  {
    id: "dob",
    label: "Date of birth",
    group: "Child information",
    value: (r) => r.childDateOfBirth,
    available: (rows) => rows.some((r) => !!r.childDateOfBirth),
  },
  {
    id: "age",
    label: "Age",
    group: "Child information",
    value: (r) =>
      r.childDateOfBirth
        ? differenceInYears(new Date(), parseISO(r.childDateOfBirth))
        : "",
    available: (rows) => rows.some((r) => !!r.childDateOfBirth),
  },
  {
    id: "room",
    label: "Room / Group",
    group: "Child information",
    value: (r) => r.room,
  },
  {
    id: "guardianName",
    label: "Primary guardian name",
    group: "Parent / guardian",
    value: (r) => r.guardianName,
  },
  {
    id: "guardianPhone",
    label: "Primary guardian phone",
    group: "Parent / guardian",
    value: (r) => r.guardianPhone,
  },
  {
    id: "guardianEmail",
    label: "Primary guardian email",
    group: "Parent / guardian",
    value: (r) => r.guardianEmail,
    available: (rows) => rows.some((r) => !!r.guardianEmail),
  },
  {
    id: "secondaryName",
    label: "Second guardian name",
    group: "Parent / guardian",
    value: (r) =>
      [r.secondaryGuardianFirstName, r.secondaryGuardianLastName]
        .filter(Boolean)
        .join(" "),
    available: (rows) =>
      rows.some(
        (r) => !!r.secondaryGuardianFirstName || !!r.secondaryGuardianLastName,
      ),
  },
  {
    id: "secondaryPhone",
    label: "Second guardian phone",
    group: "Parent / guardian",
    value: (r) => r.secondaryGuardianPhone,
    available: (rows) => rows.some((r) => !!r.secondaryGuardianPhone),
  },
  {
    id: "secondaryEmail",
    label: "Second guardian email",
    group: "Parent / guardian",
    value: (r) => r.secondaryGuardianEmail,
    available: (rows) => rows.some((r) => !!r.secondaryGuardianEmail),
  },
  {
    id: "allergies",
    label: "Allergies",
    group: "Safety information",
    value: (r) => r.allergies,
    available: (rows) => rows.some((r) => !!r.allergies),
  },
  {
    id: "medicalNotes",
    label: "Medical notes",
    group: "Safety information",
    value: (r) => r.medicalNotes,
    available: (rows) => rows.some((r) => !!r.medicalNotes),
  },
  {
    id: "specialNeeds",
    label: "Special needs / accommodations",
    group: "Safety information",
    value: (r) => r.specialNeeds,
    available: (rows) => rows.some((r) => !!r.specialNeeds),
  },
  {
    id: "emergencyName",
    label: "Emergency contact name",
    group: "Safety information",
    value: (r) => r.emergencyContactName,
    available: (rows) => rows.some((r) => !!r.emergencyContactName),
  },
  {
    id: "emergencyRelationship",
    label: "Emergency contact relationship",
    group: "Safety information",
    value: (r) => r.emergencyContactRelationship,
    available: (rows) => rows.some((r) => !!r.emergencyContactRelationship),
  },
  {
    id: "emergencyPhone",
    label: "Emergency contact phone",
    group: "Safety information",
    value: (r) => r.emergencyContactPhone,
    available: (rows) => rows.some((r) => !!r.emergencyContactPhone),
  },
  {
    id: "submittedAt",
    label: "Registration date",
    group: "Registration",
    value: (r) =>
      r.submittedAt ? format(parseISO(r.submittedAt), "yyyy-MM-dd HH:mm") : "",
  },
  {
    id: "registrationId",
    label: "Registration ID",
    group: "Registration",
    value: (r) => r.id,
  },
  {
    id: "checkinStatus",
    label: "Check-in status",
    group: "Registration",
    value: (r) => r.checkinStatus,
  },
];

const STANDARD_FIELDS = ["fullName", "room", "guardianName", "guardianPhone"];
const SAFETY_FIELDS = [
  "fullName",
  "room",
  "allergies",
  "medicalNotes",
  "specialNeeds",
  "guardianPhone",
  "emergencyName",
  "emergencyRelationship",
  "emergencyPhone",
];

export function RegistrationExportDialog({
  open,
  onOpenChange,
  eventId,
  registrations,
  filteredRegistrations,
  configuredRooms,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: number;
  registrations: Registration[];
  filteredRegistrations: Registration[];
  configuredRooms: Room[];
}) {
  const [data, setData] = useState<Awaited<
    ReturnType<typeof getEventRegistrationsExport>
  > | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [scope, setScope] = useState<ExportScope>("all");
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [includeUnassigned, setIncludeUnassigned] = useState(false);
  const [preset, setPreset] = useState<ExportPreset>("standard");
  const [selectedFields, setSelectedFields] =
    useState<string[]>(STANDARD_FIELDS);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setLoadError(false);
    setData(null);
    setScope("all");
    setSelectedRooms([]);
    setIncludeUnassigned(false);
    const saved = localStorage.getItem(
      "registrations:exportPreset",
    ) as ExportPreset | null;
    const initialPreset = saved && saved !== "custom" ? saved : "standard";
    setPreset(initialPreset);
    getEventRegistrationsExport(eventId)
      .then((result) => {
        setData(result);
        const available = FIELDS.filter(
          (field) =>
            (field.id !== "room" ||
              configuredRooms.length > 0 ||
              result.rows.some((row) => !!row.room)) &&
            (!field.available || field.available(result.rows)),
        ).map((field) => field.id);
        setSelectedFields(
          initialPreset === "safety"
            ? SAFETY_FIELDS.filter((id) => available.includes(id))
            : initialPreset === "full"
              ? available
              : STANDARD_FIELDS.filter((id) => available.includes(id)),
        );
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [configuredRooms.length, eventId, open]);

  const availableFields = useMemo(
    () =>
      data
        ? FIELDS.filter(
            (field) =>
              (field.id !== "room" ||
                configuredRooms.length > 0 ||
                data.rows.some((row) => !!row.room)) &&
              (!field.available || field.available(data.rows)),
          )
        : [],
    [configuredRooms.length, data],
  );
  const filteredIds = useMemo(
    () => new Set(filteredRegistrations.map((registration) => registration.id)),
    [filteredRegistrations],
  );
  const roomNames = configuredRooms
    .filter((room) => room.isActive)
    .map((room) => room.name);
  const hasUnassigned = !!data?.rows.some((row) => !row.room);
  const roomCounts = useMemo(
    () =>
      new Map(
        roomNames.map((room) => [
          room,
          data?.rows.filter((row) => row.room === room).length ?? 0,
        ]),
      ),
    [data, roomNames],
  );
  const scopedRows = useMemo(
    () =>
      data
        ? selectRegistrationExportRows(
            data.rows,
            scope,
            filteredIds,
            selectedRooms,
            includeUnassigned,
          )
        : [],
    [data, filteredIds, includeUnassigned, scope, selectedRooms],
  );
  const customFields = data?.customColumns ?? [];
  const totalColumns = selectedFields.length;
  const roomSelectionValid =
    scope !== "rooms" || selectedRooms.length > 0 || includeUnassigned;
  const canExport =
    !loading &&
    !exporting &&
    scopedRows.length > 0 &&
    totalColumns > 0 &&
    roomSelectionValid;

  const applyPreset = (next: ExportPreset) => {
    if (next === "custom") return;
    setPreset(next);
    localStorage.setItem("registrations:exportPreset", next);
    const availableIds = availableFields.map((field) => field.id);
    setSelectedFields(
      next === "standard"
        ? STANDARD_FIELDS.filter((id) => availableIds.includes(id))
        : next === "safety"
          ? SAFETY_FIELDS.filter((id) => availableIds.includes(id))
          : [
              ...availableIds,
              ...customFields.map((label) => `custom:${label}`),
            ],
    );
  };
  const toggleField = (id: string, checked: boolean) => {
    setPreset("custom");
    setSelectedFields((current) =>
      checked ? [...current, id] : current.filter((field) => field !== id),
    );
  };
  const handleExport = () => {
    if (!data || !canExport) return;
    setExporting(true);
    const definitions: Array<{
      label: string;
      value: (row: RegistrationExportRow) => unknown;
    }> = [];
    for (const id of selectedFields) {
      if (id.startsWith("custom:")) {
        const label = id.slice(7);
        definitions.push({
          label,
          value: (row) => row.customAnswers[label] ?? "",
        });
        continue;
      }
      const field = availableFields.find((candidate) => candidate.id === id);
      if (field) definitions.push(field);
    }
    const csv = buildCsv(
      definitions.map((field) => field.label),
      scopedRows.map((row) => definitions.map((field) => field.value(row))),
    );
    const slug =
      data.eventName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "event";
    downloadCsv(
      csv,
      `${slug}-registrations-${format(new Date(), "yyyy-MM-dd")}.csv`,
    );
    setExporting(false);
    onOpenChange(false);
  };

  const renderCheckbox = (id: string, label: string) => (
    <div key={id} className="flex items-start gap-2">
      <Checkbox
        id={`export-${id}`}
        checked={selectedFields.includes(id)}
        onCheckedChange={(checked) => toggleField(id, checked === true)}
      />
      <Label
        htmlFor={`export-${id}`}
        className="cursor-pointer text-sm font-normal leading-4"
      >
        {label}
      </Label>
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !exporting && onOpenChange(next)}
    >
      <DialogContent className="flex h-[95vh] max-h-[900px] w-[calc(100vw-1rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:h-auto sm:max-h-[90vh]">
        <DialogHeader className="border-b px-5 py-4 sm:px-6">
          <DialogTitle>Export Registrations</DialogTitle>
          <DialogDescription>
            Choose which registrants and information to include in the CSV.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Export scope</h3>
            <RadioGroup
              value={scope}
              onValueChange={(value) => setScope(value as ExportScope)}
              className="grid gap-3 sm:grid-cols-3"
            >
              {(
                [
                  ["all", "All registrants", registrations.length],
                  [
                    "filtered",
                    "Current filtered results",
                    filteredRegistrations.length,
                  ],
                  ...(roomNames.length
                    ? [
                        [
                          "rooms",
                          "Selected rooms",
                          scope === "rooms"
                            ? scopedRows.length
                            : registrations.length,
                        ],
                      ]
                    : []),
                ] as Array<[ExportScope, string, number]>
              ).map(([value, label, count]) => (
                <Label
                  key={value}
                  htmlFor={`scope-${value}`}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 font-normal"
                >
                  <RadioGroupItem id={`scope-${value}`} value={value} />
                  <span className="flex-1 text-sm">{label}</span>
                  <span className="text-xs text-muted-foreground">{count}</span>
                </Label>
              ))}
            </RadioGroup>
            {scope === "rooms" && (
              <div className="grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2">
                <div className="flex items-center gap-2 sm:col-span-2">
                  <Checkbox
                    id="rooms-all"
                    checked={
                      selectedRooms.length === roomNames.length &&
                      (!hasUnassigned || includeUnassigned)
                    }
                    onCheckedChange={(checked) => {
                      setSelectedRooms(checked ? roomNames : []);
                      setIncludeUnassigned(checked === true && hasUnassigned);
                    }}
                  />
                  <Label htmlFor="rooms-all" className="cursor-pointer">
                    Select all rooms
                  </Label>
                </div>
                {roomNames.map((room) => (
                  <div key={room} className="flex items-center gap-2">
                    <Checkbox
                      id={`room-${room}`}
                      checked={selectedRooms.includes(room)}
                      onCheckedChange={(checked) =>
                        setSelectedRooms((current) =>
                          checked
                            ? [...current, room]
                            : current.filter((name) => name !== room),
                        )
                      }
                    />
                    <Label
                      htmlFor={`room-${room}`}
                      className="flex flex-1 cursor-pointer justify-between font-normal"
                    >
                      <span>{room}</span>
                      <span className="text-muted-foreground">
                        {roomCounts.get(room)}
                      </span>
                    </Label>
                  </div>
                ))}
                {hasUnassigned && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="room-unassigned"
                      checked={includeUnassigned}
                      onCheckedChange={(checked) =>
                        setIncludeUnassigned(checked === true)
                      }
                    />
                    <Label
                      htmlFor="room-unassigned"
                      className="flex flex-1 cursor-pointer justify-between font-normal"
                    >
                      <span>Unassigned</span>
                      <span className="text-muted-foreground">
                        {data?.rows.filter((row) => !row.room).length}
                      </span>
                    </Label>
                  </div>
                )}
              </div>
            )}
          </section>
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Information to include</h3>
              <Select
                value={preset}
                onValueChange={(value) => applyPreset(value as ExportPreset)}
              >
                <SelectTrigger
                  className="h-9 w-[190px]"
                  aria-label="Export preset"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard roster</SelectItem>
                  <SelectItem value="safety">Safety report</SelectItem>
                  <SelectItem value="full">Full export</SelectItem>
                  <SelectItem value="custom" disabled>
                    Custom
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {loading ? (
              <div
                role="status"
                className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"
              >
                <Loader2 className="h-4 w-4 animate-spin" /> Loading export
                fields…
              </div>
            ) : loadError ? (
              <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                Export information could not be loaded. Close this window and try again.
              </p>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                {(
                  [
                    "Child information",
                    "Parent / guardian",
                    "Safety information",
                    "Registration",
                  ] as const
                ).map((group) => {
                  const fields = availableFields.filter(
                    (field) => field.group === group,
                  );
                  if (!fields.length) return null;
                  return (
                    <div key={group} className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {group}
                      </h4>
                      {fields.map((field) =>
                        renderCheckbox(field.id, field.label),
                      )}
                    </div>
                  );
                })}
                {customFields.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Custom questions
                    </h4>
                    {customFields.map((label) =>
                      renderCheckbox(`custom:${label}`, label),
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
        <DialogFooter className="border-t bg-background px-5 py-4 sm:px-6">
          <p
            className="mr-auto text-sm text-muted-foreground"
            aria-live="polite"
          >
            {scopedRows.length} registrants will be exported with {totalColumns}{" "}
            columns.
          </p>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={exporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={!canExport}
            className="gap-2"
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Preparing CSV…
              </>
            ) : (
              <>
                <Download className="h-4 w-4" /> Export CSV
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
