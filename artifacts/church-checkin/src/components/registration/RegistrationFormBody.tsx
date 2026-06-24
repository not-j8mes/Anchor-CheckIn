import { useEffect, useMemo, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, MessageSquare, Phone, Plus, Trash2, User, Users } from "lucide-react";
import { SYSTEM_FIELDS_BY_KEY } from "@/lib/systemFields";
import type { FormField, Room } from "@workspace/api-client-react";

// ─── Section classifier (single source of truth) ─────────────────────────────

export type FieldSection = "guardian_info" | "child_info" | "emergency_contact" | "additional_questions" | "waivers";
const SECONDARY_GUARDIAN_SECTION_KEY = "secondary_guardian";

export function getFieldSection(field: FormField): FieldSection {
  if (field.fieldType === "waiver" || field.sectionKey === "waivers") return "waivers";
  if (field.sectionKey === SECONDARY_GUARDIAN_SECTION_KEY) return "guardian_info";
  if (field.fieldKind === "system" && field.systemKey) {
    const def = SYSTEM_FIELDS_BY_KEY.get(field.systemKey);
    if (def?.category === "guardian") return "guardian_info";
    if (def?.category === "emergency_safety") return "emergency_contact";
    if (def?.category === "participant" || def?.category === "individual" || def?.category === "rooms") return "child_info";
    return "additional_questions";
  }
  return (field.sectionKey as FieldSection) ?? "additional_questions";
}

export function isSecondaryGuardianField(field: FormField): boolean {
  return field.sectionKey === SECONDARY_GUARDIAN_SECTION_KEY || (field.systemKey?.startsWith("secondary_guardian_") ?? false);
}

// ─── Field renderer ───────────────────────────────────────────────────────────

const MONTH_OPTIONS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

interface DateParts {
  month: string;
  day: string;
  year: string;
}

function parseDateParts(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: match[1], month: match[2], day: match[3] };
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(month: string, year: string): number {
  const monthNumber = Number(month);
  if (!monthNumber) return 31;
  if (monthNumber === 2) {
    const yearNumber = Number(year);
    return yearNumber && isLeapYear(yearNumber) ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(monthNumber)) return 30;
  return 31;
}

function formatDateParts(parts: DateParts): string {
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function DateOfBirthSelect({
  value,
  onChange,
  required,
  disabled,
  minYear,
  maxYear = new Date().getFullYear(),
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  minYear?: number;
  maxYear?: number;
}) {
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const [parts, setParts] = useState<DateParts>(() =>
    parseDateParts(value) ?? { month: "", day: "", year: "" },
  );
  const resolvedMinYear = minYear ?? maxYear - 100;

  useEffect(() => {
    hiddenInputRef.current?.setCustomValidity("");
    const parsed = parseDateParts(value);
    if (parsed) {
      setParts(parsed);
      return;
    }
    setParts((current) => {
      if (current.month && current.day && current.year) {
        return { month: "", day: "", year: "" };
      }
      return current;
    });
  }, [value]);

  const dayOptions = useMemo(() => {
    const maxDay = daysInMonth(parts.month, parts.year);
    return Array.from({ length: maxDay }, (_, index) => {
      const day = index + 1;
      return { value: String(day).padStart(2, "0"), label: String(day) };
    });
  }, [parts.month, parts.year]);

  const yearOptions = useMemo(
    () =>
      Array.from({ length: maxYear - resolvedMinYear + 1 }, (_, index) =>
        String(maxYear - index),
      ),
    [maxYear, resolvedMinYear],
  );

  const updatePart = (key: keyof DateParts, nextValue: string) => {
    setParts((current) => {
      const next = { ...current, [key]: nextValue };
      const maxDay = daysInMonth(next.month, next.year);
      if (Number(next.day) > maxDay) {
        next.day = String(maxDay).padStart(2, "0");
      }

      hiddenInputRef.current?.setCustomValidity("");
      if (next.month && next.day && next.year) {
        onChange(formatDateParts(next));
      } else {
        onChange("");
      }
      return next;
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-xs leading-5 text-muted-foreground">
        Choose month, day, and year.
      </p>
      <input
        ref={hiddenInputRef}
        tabIndex={-1}
        aria-hidden="true"
        required={required}
        value={value}
        readOnly
        className="sr-only"
        onInvalid={(event) => {
          event.currentTarget.setCustomValidity("Please select the child's full date of birth.");
        }}
      />
      <div className="grid gap-3 sm:grid-cols-[1.3fr_0.8fr_1fr]">
        <Select
          value={parts.month}
          onValueChange={(selected) => updatePart("month", selected)}
          disabled={disabled}
        >
          <SelectTrigger
            aria-label="Birth month"
            className="h-12 w-full min-w-0 rounded-lg border-border bg-white text-base shadow-sm focus:ring-2 focus:ring-primary/25"
          >
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent
            position="popper"
            side="bottom"
            sideOffset={6}
            collisionPadding={16}
            className="max-h-72 overflow-y-auto"
          >
            {MONTH_OPTIONS.map((month) => (
              <SelectItem key={month.value} value={month.value}>
                {month.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={parts.day}
          onValueChange={(selected) => updatePart("day", selected)}
          disabled={disabled}
        >
          <SelectTrigger
            aria-label="Birth day"
            className="h-12 w-full min-w-0 rounded-lg border-border bg-white text-base shadow-sm focus:ring-2 focus:ring-primary/25"
          >
            <SelectValue placeholder="Day" />
          </SelectTrigger>
          <SelectContent
            position="popper"
            side="bottom"
            sideOffset={6}
            collisionPadding={16}
            className="max-h-72 overflow-y-auto"
          >
            {dayOptions.map((day) => (
              <SelectItem key={day.value} value={day.value}>
                {day.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={parts.year}
          onValueChange={(selected) => updatePart("year", selected)}
          disabled={disabled}
        >
          <SelectTrigger
            aria-label="Birth year"
            className="h-12 w-full min-w-0 rounded-lg border-border bg-white text-base shadow-sm focus:ring-2 focus:ring-primary/25"
          >
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent
            position="popper"
            side="bottom"
            sideOffset={6}
            collisionPadding={16}
            className="max-h-72 overflow-y-auto"
          >
            {yearOptions.map((year) => (
              <SelectItem key={year} value={year}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function FieldInput({
  field,
  value,
  onChange,
  rooms = [],
}: {
  field: FormField;
  value: string;
  onChange: (v: string) => void;
  rooms?: Room[];
}) {
  const { fieldType, placeholder, options, required, label } = field;

  if (field.systemKey === "date_of_birth") {
    return (
      <DateOfBirthSelect
        value={value}
        onChange={onChange}
        required={required}
      />
    );
  }

  if (field.systemKey === "room_assignment") {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-12 w-full min-w-0 rounded-lg border-border bg-white text-base shadow-sm focus:ring-2 focus:ring-primary/25">
          <SelectValue placeholder="Select a room or group" />
        </SelectTrigger>
        <SelectContent>
          {rooms.map((room) => (
            <SelectItem key={room.id} value={room.name}>
              {room.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (fieldType === "textarea") {
    return (
      <Textarea
        required={required}
        placeholder={placeholder ?? ""}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-24 w-full min-w-0 resize-y rounded-lg border-border bg-white text-base shadow-sm focus-visible:ring-2 focus-visible:ring-primary/25"
        rows={3}
      />
    );
  }

  if ((fieldType === "select" || fieldType === "multiselect") && options) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-12 w-full min-w-0 rounded-lg border-border bg-white text-base shadow-sm focus:ring-2 focus:ring-primary/25">
          <SelectValue placeholder={placeholder ?? "Select an option"} />
        </SelectTrigger>
        <SelectContent>
          {options.split(",").map((opt) => (
            <SelectItem key={opt.trim()} value={opt.trim()}>
              {opt.trim()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (fieldType === "checkbox") {
    return (
      <div className="flex items-center space-x-2 mt-2">
        <Checkbox
          id={`field-${field.id}`}
          checked={value === "true"}
          onCheckedChange={(c) => onChange(c ? "true" : "")}
        />
        <Label
          htmlFor={`field-${field.id}`}
          className="cursor-pointer text-sm font-normal text-muted-foreground"
        >
          {placeholder ?? label}
        </Label>
      </div>
    );
  }

  if (fieldType === "waiver") {
    return (
      <div className="space-y-3">
        <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/20 p-4 text-sm leading-relaxed text-foreground">
          {placeholder || "No waiver text has been provided."}
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-white p-4 shadow-sm transition-colors hover:bg-muted/20">
          <input
            type="checkbox"
            required
            checked={value === "true"}
            onChange={(event) => onChange(event.target.checked ? "true" : "")}
            className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
          />
          <span className="text-sm leading-relaxed">I have read and agree to the {label}.</span>
        </label>
      </div>
    );
  }

  return (
    <Input
      type={
        fieldType === "date"
          ? "date"
          : fieldType === "email"
            ? "email"
            : fieldType === "number"
              ? "number"
              : fieldType === "phone"
                ? "tel"
                : "text"
      }
      required={required}
      placeholder={placeholder ?? ""}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-12 w-full min-w-0 rounded-lg border-border bg-white text-base shadow-sm focus-visible:ring-2 focus-visible:ring-primary/25"
    />
  );
}

function RequiredLabel({ field }: { field: FormField }) {
  return (
    <Label className="flex items-center gap-1 text-sm font-semibold text-foreground">
      {field.label}
      {field.required && <span className="text-destructive">*</span>}
    </Label>
  );
}

function FieldBlock({
  field,
  value,
  onChange,
  rooms,
}: {
  field: FormField;
  value: string;
  onChange: (v: string) => void;
  rooms: Room[];
}) {
  return (
    <div className="min-w-0 space-y-2">
      <RequiredLabel field={field} />
      <FieldInput field={field} value={value} onChange={onChange} rooms={rooms} />
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  description,
  tone = "amber",
  children,
}: {
  icon: typeof User;
  title: string;
  description: string;
  tone?: "amber" | "rose" | "sky" | "indigo";
  children: React.ReactNode;
}) {
  const toneClasses = {
    amber: "bg-amber-50 text-amber-800",
    rose: "bg-rose-50 text-rose-700",
    sky: "bg-sky-50 text-sky-700",
    indigo: "bg-indigo-50 text-indigo-700",
  }[tone];

  return (
    <Card className="w-full max-w-full min-w-0 overflow-hidden rounded-2xl border-card-border bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="flex items-start gap-3 border-b border-border/70 px-5 py-5 sm:px-6">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${toneClasses}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-wrap text-lg font-serif font-bold leading-6 text-foreground">{title}</h3>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
      <CardContent className="p-5 sm:p-6">{children}</CardContent>
    </Card>
  );
}

// ─── Form body ────────────────────────────────────────────────────────────────

export interface RegistrationFormBodyProps {
  formFields: FormField[];
  rooms: Room[];
  isChildCheckin: boolean;
  allowAdditionalPeople?: boolean;
  allowSecondGuardian?: boolean;
  guardianAnswers: Record<number, string>;
  childrenAnswers: Record<number, string>[];
  emergencyAnswers: Record<number, string>;
  additionalAnswers: Record<number, string>;
  onGuardianChange: (fieldId: number, value: string) => void;
  onChildChange: (childIndex: number, fieldId: number, value: string) => void;
  onEmergencyChange: (fieldId: number, value: string) => void;
  onAdditionalChange: (fieldId: number, value: string) => void;
  onAddChild: () => void;
  onRemoveChild: (index: number) => void;
  visibleSections?: FieldSection[];
}

export function RegistrationFormBody({
  formFields,
  rooms,
  isChildCheckin,
  allowAdditionalPeople = false,
  allowSecondGuardian = true,
  guardianAnswers,
  childrenAnswers,
  emergencyAnswers,
  additionalAnswers,
  onGuardianChange,
  onChildChange,
  onEmergencyChange,
  onAdditionalChange,
  onAddChild,
  onRemoveChild,
  visibleSections,
}: RegistrationFormBodyProps) {
  const guardianFields = formFields.filter((f) => getFieldSection(f) === "guardian_info");
  const primaryGuardianFields = guardianFields.filter((field) => !isSecondaryGuardianField(field));
  const secondaryGuardianFields = guardianFields.filter(isSecondaryGuardianField);
  const [showSecondaryGuardian, setShowSecondaryGuardian] = useState(() =>
    allowSecondGuardian && secondaryGuardianFields.some((field) => !!guardianAnswers[field.id]),
  );
  const childFields = formFields.filter((f) => getFieldSection(f) === "child_info");
  const emergencyFields = formFields.filter((f) => getFieldSection(f) === "emergency_contact");
  const additionalFields = formFields.filter((f) => getFieldSection(f) === "additional_questions");
  const waiverFields = formFields.filter((f) => getFieldSection(f) === "waivers");
  const isSectionVisible = (section: FieldSection) =>
    !visibleSections || visibleSections.includes(section);

  const removeSecondaryGuardian = () => {
    secondaryGuardianFields.forEach((field) => onGuardianChange(field.id, ""));
    setShowSecondaryGuardian(false);
  };

  return (
    <div className="space-y-5">
      {/* Parent / Guardian section */}
      {isSectionVisible("guardian_info") && guardianFields.length > 0 && (
        <SectionCard
          icon={Users}
          title="Parent / Guardian Information"
          description="Tell us who we should contact about this registration."
        >
          <div className="space-y-5">
            {primaryGuardianFields.map((field) => (
              <FieldBlock
                key={field.id}
                field={field}
                value={guardianAnswers[field.id] ?? ""}
                onChange={(v) => onGuardianChange(field.id, v)}
                rooms={rooms}
              />
            ))}
            {allowSecondGuardian && secondaryGuardianFields.length > 0 && !showSecondaryGuardian && (
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-12 w-full min-w-0 whitespace-normal rounded-lg border-dashed border-amber-300 bg-amber-50/70 px-3 py-3 text-sm font-semibold leading-5 text-foreground shadow-sm hover:border-primary hover:bg-amber-100/80 sm:text-base"
                onClick={() => setShowSecondaryGuardian(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Second Parent / Guardian
              </Button>
            )}
            {allowSecondGuardian && secondaryGuardianFields.length > 0 && showSecondaryGuardian && (
              <div className="space-y-5 rounded-xl border border-border bg-[#fffcf5] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">
                      Second Parent / Guardian
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Optional additional contact for this registration.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 rounded-md text-muted-foreground hover:bg-white hover:text-destructive"
                    onClick={removeSecondaryGuardian}
                  >
                    <Trash2 className="w-4 h-4 mr-1" /> Remove
                  </Button>
                </div>
                {secondaryGuardianFields.map((field) => (
                  <div key={field.id} className="space-y-2">
                    <Label className="flex items-center gap-1 text-sm font-semibold text-foreground">
                      {field.label.replace(/^Secondary\s+/i, "")}
                      {field.required && <span className="text-destructive">*</span>}
                    </Label>
                    <FieldInput
                      field={field}
                      value={guardianAnswers[field.id] ?? ""}
                      onChange={(v) => onGuardianChange(field.id, v)}
                      rooms={rooms}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* Per-child sections */}
      {isSectionVisible("child_info") && (
        <SectionCard
          icon={User}
          title={isChildCheckin ? "Child Information" : "Attendee Information"}
          description={
            childrenAnswers.length > 1
              ? `Provide details about your ${isChildCheckin ? "children" : "attendees"}.`
              : `Provide details about your ${isChildCheckin ? "child" : "attendee"}.`
          }
        >
          <div className="space-y-5">
            {childrenAnswers.map((childAnswerMap, idx) => {
              const showChildCard = childrenAnswers.length > 1;
              const fields = childFields.length > 0 ? (
                <div className="space-y-5">
                  {childFields.map((field) => (
                    <FieldBlock
                      key={field.id}
                      field={field}
                      value={childAnswerMap[field.id] ?? ""}
                      onChange={(v) => onChildChange(idx, field.id, v)}
                      rooms={rooms}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No {isChildCheckin ? "child" : "attendee"}-specific fields configured for this form.
                </p>
              );

              if (!showChildCard) return <div key={idx}>{fields}</div>;

              return (
                <div key={idx} className="overflow-hidden rounded-xl border border-border bg-white">
                  <div className="flex items-center justify-between gap-3 border-b border-amber-100 bg-amber-50 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-amber-800" />
                      <h4 className="text-sm font-bold text-foreground">
                        {isChildCheckin ? "Child" : "Person"} {idx + 1}
                      </h4>
                    </div>
                    {idx > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-md text-xs text-muted-foreground hover:bg-white hover:text-destructive"
                        onClick={() => onRemoveChild(idx)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                      </Button>
                    )}
                  </div>
                  <div className="p-4">{fields}</div>
                </div>
              );
            })}

            {(isChildCheckin || allowAdditionalPeople) && (
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-12 w-full min-w-0 whitespace-normal rounded-lg border-dashed border-amber-300 bg-amber-50/70 px-3 py-3 text-sm font-semibold leading-5 text-foreground shadow-sm hover:border-primary hover:bg-amber-100/80 sm:text-base"
                onClick={onAddChild}
              >
                <Plus className="w-4 h-4 mr-2" />
                {isChildCheckin ? "Add Another Child" : "Add Another Person"}
              </Button>
            )}
          </div>
        </SectionCard>
      )}

      {/* Emergency Contact — shown once, not per-child */}
      {isSectionVisible("emergency_contact") && emergencyFields.length > 0 && (
        <SectionCard
          icon={Phone}
          title="Emergency Contact Information"
          description="Who should we contact in case of an emergency?"
          tone="rose"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            {emergencyFields.map((field) => (
              <FieldBlock
                key={field.id}
                field={field}
                value={emergencyAnswers[field.id] ?? ""}
                onChange={(v) => onEmergencyChange(field.id, v)}
                rooms={rooms}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {/* Additional Questions — shown once, not per-child/person */}
      {isSectionVisible("additional_questions") && additionalFields.length > 0 && (
        <SectionCard
          icon={MessageSquare}
          title="Additional Questions"
          description="A few extra details to help us serve you well."
          tone="sky"
        >
          <div className="space-y-5">
            {additionalFields.map((field) => (
              <FieldBlock
                key={field.id}
                field={field}
                value={additionalAnswers[field.id] ?? ""}
                onChange={(v) => onAdditionalChange(field.id, v)}
                rooms={rooms}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {/* Waivers — optional section shown once at the end */}
      {isSectionVisible("waivers") && waiverFields.length > 0 && (
        <SectionCard
          icon={FileText}
          title="Waivers"
          description="Please review and accept the required agreements."
          tone="indigo"
        >
          <div className="space-y-6">
            {waiverFields.map((field) => (
              <div key={field.id} className="space-y-2">
                <Label className="flex items-center gap-1 text-sm font-semibold text-foreground">
                  {field.label}
                  <span className="text-destructive">*</span>
                </Label>
                <FieldInput
                  field={field}
                  value={additionalAnswers[field.id] ?? ""}
                  onChange={(v) => onAdditionalChange(field.id, v)}
                  rooms={rooms}
                />
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
