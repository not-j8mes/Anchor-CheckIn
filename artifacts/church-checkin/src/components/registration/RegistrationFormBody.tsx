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
import { MessageSquare, Phone, Plus, Trash2, User, Users } from "lucide-react";
import { SYSTEM_FIELDS_BY_KEY } from "@/lib/systemFields";
import type { FormField, Room } from "@workspace/api-client-react";

// ─── Section classifier (single source of truth) ─────────────────────────────

export type FieldSection = "guardian_info" | "child_info" | "emergency_contact" | "additional_questions";

export function getFieldSection(field: FormField): FieldSection {
  if (field.fieldKind === "system" && field.systemKey) {
    const def = SYSTEM_FIELDS_BY_KEY.get(field.systemKey);
    if (def?.category === "guardian") return "guardian_info";
    if (def?.category === "emergency_safety") return "emergency_contact";
    if (def?.category === "participant" || def?.category === "individual" || def?.category === "rooms") return "child_info";
    return "additional_questions";
  }
  return (field.sectionKey as FieldSection) ?? "additional_questions";
}

// ─── Field renderer ───────────────────────────────────────────────────────────

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

  if (field.systemKey === "room_assignment") {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
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
        className="resize-y"
        rows={3}
      />
    );
  }

  if ((fieldType === "select" || fieldType === "multiselect") && options) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
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
          className="text-sm font-normal text-muted-foreground cursor-pointer"
        >
          {placeholder ?? label}
        </Label>
      </div>
    );
  }

  if (fieldType === "waiver") {
    return (
      <div className="space-y-3">
        <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed text-foreground">
          {placeholder || "No waiver text has been provided."}
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/30">
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
      className="h-11 text-base"
    />
  );
}

// ─── Form body ────────────────────────────────────────────────────────────────

export interface RegistrationFormBodyProps {
  formFields: FormField[];
  rooms: Room[];
  isChildCheckin: boolean;
  allowAdditionalPeople?: boolean;
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
}

export function RegistrationFormBody({
  formFields,
  rooms,
  isChildCheckin,
  allowAdditionalPeople = false,
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
}: RegistrationFormBodyProps) {
  const guardianFields = formFields.filter((f) => getFieldSection(f) === "guardian_info");
  const childFields = formFields.filter((f) => getFieldSection(f) === "child_info");
  const emergencyFields = formFields.filter((f) => getFieldSection(f) === "emergency_contact");
  const additionalFields = formFields.filter((f) => getFieldSection(f) === "additional_questions");

  return (
    <div className="space-y-6">
      {/* Parent / Guardian section */}
      {guardianFields.length > 0 && (
        <Card className="shadow-sm overflow-hidden">
          <div className="bg-primary px-6 py-4 flex items-center gap-2">
            <User className="w-5 h-5 text-primary-foreground" />
            <h3 className="text-lg font-semibold text-primary-foreground">
              Parent / Guardian Information
            </h3>
          </div>
          <CardContent className="p-6 space-y-5">
            {guardianFields.map((field) => (
              <div key={field.id} className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1">
                  {field.label}
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
          </CardContent>
        </Card>
      )}

      {/* Per-child sections */}
      {childrenAnswers.map((childAnswerMap, idx) => (
        <Card key={idx} className="shadow-sm overflow-hidden">
          <div className="bg-secondary px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-secondary-foreground" />
              <h3 className="text-lg font-semibold text-secondary-foreground">
                {childrenAnswers.length > 1
                  ? `${isChildCheckin ? "Child" : "Person"} ${idx + 1}`
                  : isChildCheckin ? "Child Information" : "Attendee Information"}
              </h3>
            </div>
            {childrenAnswers.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-secondary-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => onRemoveChild(idx)}
              >
                <Trash2 className="w-4 h-4 mr-1" /> Remove
              </Button>
            )}
          </div>
          <CardContent className="p-6 space-y-5">
            {childFields.length > 0 ? (
              childFields.map((field) => (
                <div key={field.id} className="space-y-1.5">
                  <Label className="text-sm font-medium flex items-center gap-1">
                    {field.label}
                    {field.required && <span className="text-destructive">*</span>}
                  </Label>
                  <FieldInput
                    field={field}
                    value={childAnswerMap[field.id] ?? ""}
                    onChange={(v) => onChildChange(idx, field.id, v)}
                    rooms={rooms}
                  />
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No {isChildCheckin ? "child" : "attendee"}-specific fields configured for this form.
              </p>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Add another child/person */}
      {(isChildCheckin || allowAdditionalPeople) && (
        <Button
          type="button"
          variant="outline"
          className="w-full border-dashed h-12 text-base font-medium"
          onClick={onAddChild}
        >
          <Plus className="w-4 h-4 mr-2" />
          {isChildCheckin ? "Add Another Child" : "Add Another Person"}
        </Button>
      )}

      {/* Emergency Contact — shown once, not per-child */}
      {emergencyFields.length > 0 && (
        <Card className="shadow-sm overflow-hidden">
          <div className="bg-rose-50 border-b border-rose-100 px-6 py-4 flex items-center gap-2">
            <Phone className="w-5 h-5 text-rose-700" />
            <h3 className="text-lg font-semibold text-rose-900">Emergency Contact Information</h3>
          </div>
          <CardContent className="p-6 space-y-5">
            {emergencyFields.map((field) => (
              <div key={field.id} className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1">
                  {field.label}
                  {field.required && <span className="text-destructive">*</span>}
                </Label>
                <FieldInput
                  field={field}
                  value={emergencyAnswers[field.id] ?? ""}
                  onChange={(v) => onEmergencyChange(field.id, v)}
                  rooms={rooms}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Additional Questions — shown once, not per-child/person */}
      {additionalFields.length > 0 && (
        <Card className="shadow-sm overflow-hidden">
          <div className="bg-muted/60 border-b border-border px-6 py-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground">Additional Questions</h3>
          </div>
          <CardContent className="p-6 space-y-5">
            {additionalFields.map((field) => (
              <div key={field.id} className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1">
                  {field.label}
                  {field.required && <span className="text-destructive">*</span>}
                </Label>
                <FieldInput
                  field={field}
                  value={additionalAnswers[field.id] ?? ""}
                  onChange={(v) => onAdditionalChange(field.id, v)}
                  rooms={rooms}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
