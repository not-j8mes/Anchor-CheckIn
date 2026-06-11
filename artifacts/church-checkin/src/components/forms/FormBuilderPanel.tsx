import { useState, useEffect, useRef } from "react";
import {
  useGetForm,
  useUpdateForm,
  useListFormFields,
  useCreateFormField,
  useUpdateFormField,
  useDeleteFormField,
  useReorderFormFields,
  useListRooms,
  getGetFormQueryKey,
  getListFormFieldsQueryKey,
  getListRoomsQueryKey,
  type FormField,
  type FormFieldInput,
  type Room,
  FormFieldFieldKind,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Settings,
  Trash2,
  GripVertical,
  Save,
  ArrowUp,
  ArrowDown,
  Sparkles,
  MessageSquare,
  Search,
  Check,
  CheckCircle2,
  Pencil,
  Eye,
  Users,
  User,
  Baby,
  ChevronDown,
  Info,
  DoorOpen,
  RefreshCw,
  Phone,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  SYSTEM_FIELDS,
  SYSTEM_FIELD_CATEGORIES,
  getSystemField,
  SYSTEM_FIELDS_BY_KEY,
  type SystemFieldCategory,
  type SystemFieldDef,
} from "@/lib/systemFields";

// ─── Section definitions ───────────────────────────────────────────────────────

type SectionKey = "guardian_info" | "child_info" | "emergency_contact" | "additional_questions";

interface SectionDef {
  key: SectionKey;
  title: string;
  description?: string;
  repeats?: boolean;
  headerClass: string;
  titleClass: string;
  iconClass: string;
  Icon: React.ElementType;
  addSystemLabel: string;
  addCustomLabel: string;
}

const SECTIONS: SectionDef[] = [
  {
    key: "guardian_info",
    title: "Parent / Guardian Information",
    headerClass: "bg-amber-50 border-b border-amber-100",
    titleClass: "text-amber-900",
    iconClass: "text-amber-700",
    Icon: Users,
    addSystemLabel: "Add Guardian Field",
    addCustomLabel: "Add Custom Question",
  },
  {
    key: "child_info",
    title: "Child Information",
    description: "This section repeats when a parent registers another child.",
    repeats: true,
    headerClass: "bg-orange-50 border-b border-orange-100",
    titleClass: "text-orange-900",
    iconClass: "text-orange-700",
    Icon: Baby,
    addSystemLabel: "Add Child Field",
    addCustomLabel: "Add Custom Question",
  },
  {
    key: "emergency_contact",
    title: "Emergency Contact Information",
    headerClass: "bg-rose-50 border-b border-rose-100",
    titleClass: "text-rose-900",
    iconClass: "text-rose-700",
    Icon: Phone,
    addSystemLabel: "Add Emergency Field",
    addCustomLabel: "Add Custom Question",
  },
  {
    key: "additional_questions",
    title: "Additional Questions",
    headerClass: "bg-slate-50 border-b border-slate-100",
    titleClass: "text-slate-800",
    iconClass: "text-slate-500",
    Icon: MessageSquare,
    addSystemLabel: "Add System Field",
    addCustomLabel: "Add Custom Question",
  },
];

const SECTION_CATEGORY_MAP: Record<SystemFieldCategory, SectionKey> = {
  guardian: "guardian_info",
  emergency_safety: "emergency_contact",
  participant: "child_info",
  rooms: "child_info",
  individual: "additional_questions",
};

function getFieldSection(field: FormField): SectionKey {
  // System fields always auto-place by category (ignores any stored sectionKey, which may be stale).
  if (field.fieldKind === "system" && field.systemKey) {
    const def = SYSTEM_FIELDS_BY_KEY.get(field.systemKey);
    if (def) return SECTION_CATEGORY_MAP[def.category] ?? "additional_questions";
  }
  // Custom fields: explicit sectionKey wins.
  if (field.sectionKey) return field.sectionKey as SectionKey;
  return "additional_questions";
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Short Text",
  textarea: "Long Text",
  select: "Dropdown",
  multiselect: "Multiple Choice",
  checkbox: "Checkbox",
  date: "Date",
  phone: "Phone",
  email: "Email",
  number: "Number",
};

const CATEGORY_ORDER: SystemFieldCategory[] = ["participant", "guardian", "emergency_safety", "individual", "rooms"];

const CATEGORY_DISPLAY_LABELS: Record<SystemFieldCategory, string> = {
  participant: "Child Profile",
  guardian: "Guardian Info",
  emergency_safety: "Safety Info",
  individual: "Individual / Adult",
  rooms: "Room / Group",
};

// Categories that are auto-placed — shown in the picker per section
const SECTION_CATEGORY_FILTER: Record<SectionKey, SystemFieldCategory[]> = {
  guardian_info: ["guardian"],
  child_info: ["participant", "rooms"],
  emergency_contact: ["emergency_safety"],
  additional_questions: ["individual", "guardian", "emergency_safety", "participant", "rooms"],
};

// ─── Types ──────────────────────────────────────────────────────────────────────

type ModalMode = "none" | "system-picker" | "field-editor" | "preview";

interface FormBuilderPanelProps {
  formId: number;
  eventId?: number;
  hideAdditionalPeople?: boolean;
  hideSettings?: boolean;
}

// ─── FieldCard ──────────────────────────────────────────────────────────────────

interface FieldCardProps {
  field: FormField;
  index: number;
  total: number;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (dir: "up" | "down") => void;
  onInlineUpdate: (updates: Partial<FormFieldInput>, onSaved?: () => void) => void;
}

function FieldCard({ field, index, total, onEdit, onDelete, onMove, onInlineUpdate }: FieldCardProps) {
  const isSystem = field.fieldKind === FormFieldFieldKind.system;
  const sysDef = isSystem && field.systemKey ? getSystemField(field.systemKey) : undefined;

  const [labelEditing, setLabelEditing] = useState(false);
  const [labelDraft, setLabelDraft] = useState(field.label);
  const [placeholderEditing, setPlaceholderEditing] = useState(false);
  const [placeholderDraft, setPlaceholderDraft] = useState(field.placeholder ?? "");
  const [savedFlash, setSavedFlash] = useState(false);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const placeholderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!labelEditing) setLabelDraft(field.label);
  }, [field.label, labelEditing]);

  useEffect(() => {
    if (!placeholderEditing) setPlaceholderDraft(field.placeholder ?? "");
  }, [field.placeholder, placeholderEditing]);

  useEffect(() => {
    if (labelEditing) labelInputRef.current?.focus();
  }, [labelEditing]);

  useEffect(() => {
    if (placeholderEditing) placeholderInputRef.current?.focus();
  }, [placeholderEditing]);

  const flashSaved = () => {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const handleLabelSave = () => {
    setLabelEditing(false);
    const trimmed = labelDraft.trim();
    if (!trimmed) { setLabelDraft(field.label); return; }
    if (trimmed === field.label) return;
    onInlineUpdate({ label: trimmed });
  };

  const handleLabelKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); handleLabelSave(); }
    if (e.key === "Escape") { setLabelEditing(false); setLabelDraft(field.label); }
  };

  const handlePlaceholderSave = () => {
    setPlaceholderEditing(false);
    if (placeholderDraft === (field.placeholder ?? "")) return;
    onInlineUpdate({ placeholder: placeholderDraft }, flashSaved);
  };

  const handlePlaceholderKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); handlePlaceholderSave(); }
    if (e.key === "Escape") { setPlaceholderEditing(false); setPlaceholderDraft(field.placeholder ?? ""); }
  };

  const metaText = isSystem
    ? `System · ${sysDef ? CATEGORY_DISPLAY_LABELS[sysDef.category] : "System"} · ${FIELD_TYPE_LABELS[field.fieldType] ?? field.fieldType}`
    : `Custom · ${FIELD_TYPE_LABELS[field.fieldType] ?? field.fieldType}`;

  const showPlaceholder = !["checkbox", "select", "multiselect"].includes(field.fieldType);

  return (
    <div className="flex items-stretch rounded-lg border border-border bg-background hover:shadow-sm transition-shadow overflow-hidden">
      {/* Reorder column */}
      <div className="p-2 flex flex-col gap-1 text-muted-foreground border-r border-border bg-muted/10 justify-center">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onMove("up")} disabled={index === 0}>
          <ArrowUp className="w-3 h-3" />
        </Button>
        <GripVertical className="w-4 h-4 mx-auto opacity-30" />
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onMove("down")} disabled={index === total - 1}>
          <ArrowDown className="w-3 h-3" />
        </Button>
      </div>

      {/* Content */}
      <div className="p-3 flex-1 min-w-0">
        {/* Row 1: icon + label + required checkbox + saved flash + action buttons */}
        <div className="flex items-center gap-2">
          <div className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center ${isSystem ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
            {isSystem ? <Sparkles className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
          </div>

          {/* Editable label */}
          <div className="flex-1 min-w-0">
            {labelEditing ? (
              <input
                ref={labelInputRef}
                className="w-full text-sm font-medium rounded border border-input bg-background px-1.5 py-0.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-foreground"
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onBlur={handleLabelSave}
                onKeyDown={handleLabelKeyDown}
                aria-label="Rename field label"
              />
            ) : (
              <button
                type="button"
                className="group/label inline-flex items-center gap-1.5 max-w-full rounded px-1.5 py-0.5 -ml-1.5 cursor-pointer hover:bg-amber-50 transition-colors"
                onClick={() => setLabelEditing(true)}
                title="Click to rename"
                aria-label={`Rename field: ${field.label}`}
              >
                <span className="text-sm font-medium text-foreground truncate">{field.label}</span>
                <Pencil className="w-3 h-3 flex-shrink-0 text-muted-foreground/30 group-hover/label:text-amber-600 transition-colors" />
              </button>
            )}
          </div>

          {/* Required pill toggle */}
          <button
            type="button"
            onClick={() => onInlineUpdate({ required: !field.required })}
            aria-pressed={!!field.required}
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
              field.required
                ? "bg-amber-50 border-amber-400/80 text-amber-900 hover:bg-amber-100 focus-visible:ring-amber-400"
                : "bg-background border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground focus-visible:ring-border"
            }`}
          >
            {field.required && <Check className="w-3 h-3 flex-shrink-0" />}
            Required
          </button>

          {/* Saved flash */}
          {savedFlash && (
            <span className="text-xs text-green-600 flex items-center gap-0.5 flex-shrink-0 animate-in fade-in duration-150">
              <CheckCircle2 className="w-3 h-3" /> Saved
            </span>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground" onClick={onEdit}>
              <Settings className="w-3 h-3 mr-1" /> Edit
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive/60 hover:text-destructive hover:bg-destructive/10"
              onClick={onDelete}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Row 2: metadata */}
        <p className="text-xs text-muted-foreground mt-1 ml-7">{metaText}</p>

        {/* Row 3: placeholder (text-based fields only) */}
        {showPlaceholder && (
          <div className="mt-1 ml-7">
            {placeholderEditing ? (
              <input
                ref={placeholderInputRef}
                className="w-full text-xs text-muted-foreground bg-transparent border-b border-primary/50 outline-none py-0.5"
                value={placeholderDraft}
                onChange={(e) => setPlaceholderDraft(e.target.value)}
                onBlur={handlePlaceholderSave}
                onKeyDown={handlePlaceholderKeyDown}
                placeholder="Enter placeholder text…"
                aria-label="Edit placeholder text"
              />
            ) : (
              <button
                type="button"
                className="text-xs italic cursor-text text-left block text-muted-foreground/50 hover:text-muted-foreground"
                onClick={() => setPlaceholderEditing(true)}
              >
                {field.placeholder ? field.placeholder : "Add placeholder…"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

export function FormBuilderPanel({ formId, eventId: eventIdProp, hideAdditionalPeople = false, hideSettings = false }: FormBuilderPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Data ──────────────────────────────────────────────────────────────────────
  const { data: form, isLoading: formLoading } = useGetForm(formId, {
    query: { queryKey: getGetFormQueryKey(formId) },
  });
  const { data: fields, isLoading: fieldsLoading } = useListFormFields(formId, {
    query: { queryKey: getListFormFieldsQueryKey(formId) },
  });
  const eventId = eventIdProp ?? form?.eventId ?? 0;
  const { data: eventRooms = [] } = useListRooms(eventId, {
    query: { enabled: !!eventId, queryKey: getListRoomsQueryKey(eventId) },
  });

  const isChildCheckin = !form?.registrationType || form?.registrationType === "child_checkin";

  // ── Form settings state ───────────────────────────────────────────────────────
  const [formSettings, setFormSettings] = useState({
    title: "",
    description: "",
    isActive: true,
    isPublic: true,
    allowAdditionalPeople: false,
  });

  useEffect(() => {
    if (form) {
      setFormSettings({
        title: form.title,
        description: form.description ?? "",
        isActive: form.isActive,
        isPublic: form.isPublic,
        allowAdditionalPeople: form.allowAdditionalPeople ?? false,
      });
    }
  }, [form]);

  // ── Modal state ───────────────────────────────────────────────────────────────
  const [modalMode, setModalMode] = useState<ModalMode>("none");
  const [editingField, setEditingField] = useState<Partial<FormField> | null>(null);
  const [systemSearch, setSystemSearch] = useState("");
  const [pickerTargetSection, setPickerTargetSection] = useState<SectionKey | null>(null);

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const invalidateFields = () =>
    queryClient.invalidateQueries({ queryKey: getListFormFieldsQueryKey(formId) });

  const updateForm = useUpdateForm({
    mutation: {
      onSuccess: () => {
        toast({ title: "Form settings saved" });
        queryClient.invalidateQueries({ queryKey: getGetFormQueryKey(formId) });
      },
    },
  });

  const createFormField = useCreateFormField({
    mutation: {
      onSuccess: () => { setModalMode("none"); invalidateFields(); },
      onError: () => { toast({ title: "Failed to add field", variant: "destructive" }); },
    },
  });

  const updateFormField = useUpdateFormField();

  const deleteFormField = useDeleteFormField({
    mutation: {
      onSuccess: () => { toast({ title: "Field removed" }); invalidateFields(); },
    },
  });

  const reorderFormFields = useReorderFormFields({
    mutation: { onSuccess: invalidateFields },
  });

  // ── Derived data ──────────────────────────────────────────────────────────────
  const addedSystemKeys = new Set<string>(
    fields
      ?.filter((f) => f.fieldKind === FormFieldFieldKind.system && f.systemKey)
      .map((f) => f.systemKey!) ?? []
  );

  const filteredSystemFields = SYSTEM_FIELDS.filter((def) => {
    const q = systemSearch.toLowerCase();
    const matchesSearch = !q || def.label.toLowerCase().includes(q) || def.key.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (pickerTargetSection) {
      return SECTION_CATEGORY_FILTER[pickerTargetSection].includes(def.category);
    }
    return true;
  });

  // Group fields by section, sorted by global sortOrder
  const fieldsBySection = (() => {
    const sorted = [...(fields ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    const result: Record<SectionKey, FormField[]> = {
      guardian_info: [],
      child_info: [],
      emergency_contact: [],
      additional_questions: [],
    };
    sorted.forEach((f) => result[getFieldSection(f)].push(f));
    return result;
  })();

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleAddSystemField = (def: SystemFieldDef) => {
    createFormField.mutate({
      formId,
      data: {
        fieldKind: "system",
        systemKey: def.key,
        label: def.label,
        fieldType: def.fieldType as FormFieldInput["fieldType"],
        required: false,
        sortOrder: fields?.length ?? 0,
        placeholder: def.placeholder ?? "",
        options: def.defaultOptions ?? "",
        sectionKey: SECTION_CATEGORY_MAP[def.category],
      },
    });
  };

  const handleSaveField = () => {
    if (!editingField?.id && !editingField?.label?.trim()) {
      toast({ title: "Label is required", variant: "destructive" });
      return;
    }
    const data: FormFieldInput = {
      label: editingField?.label?.trim() ?? "",
      fieldType: editingField?.fieldType as FormFieldInput["fieldType"] ?? "text",
      required: !!editingField?.required,
      sortOrder: editingField?.sortOrder ?? (fields?.length ?? 0),
      placeholder: editingField?.placeholder ?? "",
      options: editingField?.options ?? "",
      fieldKind: editingField?.fieldKind as FormFieldInput["fieldKind"],
      systemKey: editingField?.systemKey ?? undefined,
      sectionKey: editingField?.sectionKey ?? "additional_questions",
    };
    if (editingField?.id) {
      updateFormField.mutate({ formId, fieldId: editingField.id, data }, {
        onSuccess: () => { setModalMode("none"); invalidateFields(); },
        onError: () => { toast({ title: "Failed to update field", variant: "destructive" }); },
      });
    } else {
      createFormField.mutate({ formId, data: { ...data, fieldKind: "custom" } });
    }
  };

  const handleInlineUpdate = (field: FormField, updates: Partial<FormFieldInput>, onSaved?: () => void) => {
    const data: FormFieldInput = {
      label: field.label,
      fieldType: field.fieldType as FormFieldInput["fieldType"],
      required: !!field.required,
      sortOrder: field.sortOrder,
      fieldKind: field.fieldKind as FormFieldInput["fieldKind"],
      // Use ?? undefined so null values are omitted from the JSON body —
      // Drizzle skips undefined fields in SET, preserving the DB value.
      systemKey: field.systemKey ?? undefined,
      sectionKey: field.sectionKey ?? undefined,
      placeholder: field.placeholder ?? undefined,
      options: field.options ?? undefined,
      ...updates,
    };
    updateFormField.mutate({ formId, fieldId: field.id, data }, {
      onSuccess: () => { invalidateFields(); onSaved?.(); },
      onError: () => { toast({ title: "Failed to update field", variant: "destructive" }); },
    });
  };

  const handleDeleteField = (field: FormField) => {
    const isSystem = field.fieldKind === FormFieldFieldKind.system;
    const msg = isSystem && field.required
      ? `"${field.label}" is a required system field. Removing it may break registrations. Remove anyway?`
      : `Remove "${field.label}" from this form?`;
    if (!confirm(msg)) return;
    deleteFormField.mutate({ formId, fieldId: field.id });
  };

  const handleMoveSectionField = (fieldId: number, section: SectionKey, dir: "up" | "down") => {
    if (!fields) return;
    const sectionArr = [...fieldsBySection[section]];
    const idx = sectionArr.findIndex((f) => f.id === fieldId);
    if (idx === -1) return;
    if (dir === "up" && idx === 0) return;
    if (dir === "down" && idx === sectionArr.length - 1) return;
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    [sectionArr[idx], sectionArr[swapIdx]] = [sectionArr[swapIdx], sectionArr[idx]];
    // Rebuild full global order: guardian → child → emergency → additional
    const orderedIds = (["guardian_info", "child_info", "emergency_contact", "additional_questions"] as SectionKey[]).flatMap(
      (s) => (s === section ? sectionArr : fieldsBySection[s]).map((f) => f.id)
    );
    reorderFormFields.mutate({ formId, data: { fieldIds: orderedIds } });
  };

  const openCustomEditor = (targetSection: SectionKey = "additional_questions") => {
    setEditingField({ fieldKind: "custom", fieldType: "text", required: false, sectionKey: targetSection });
    setModalMode("field-editor");
  };

  const openSystemPicker = (targetSection: SectionKey | null = null) => {
    setPickerTargetSection(targetSection);
    setSystemSearch("");
    setModalMode("system-picker");
  };

  const openFieldEditor = (field: FormField) => {
    setEditingField({ ...field });
    setModalMode("field-editor");
  };

  // ── Loading / empty states ────────────────────────────────────────────────────
  if (formLoading || fieldsLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-muted w-1/3 rounded" />
        <div className="h-48 bg-muted/50 rounded-xl" />
      </div>
    );
  }

  if (!form) return <div className="p-4 text-muted-foreground">Form not found.</div>;

  const isEditingSystemField = editingField?.fieldKind === FormFieldFieldKind.system;
  const hasRegistrations = (form.submissionCount ?? 0) > 0;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className={`grid grid-cols-1 gap-6 ${hideSettings ? "" : "md:grid-cols-3"}`}>
      {/* ── Left: field builder ───────────────────────────────────────────────── */}
      <div className={`space-y-4 ${hideSettings ? "" : "md:col-span-2"}`}>
        {hasRegistrations && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 px-4 py-3 text-sm">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="text-amber-800 dark:text-amber-300">
              <span className="font-semibold">
                This form has {form.submissionCount} registration{form.submissionCount === 1 ? "" : "s"}.
              </span>{" "}
              Changes apply only to future submissions.
            </div>
          </div>
        )}

        <div className="flex justify-between items-center gap-2 flex-wrap">
          <div>
            <h2 className="text-lg font-serif font-bold">Form Fields</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Click a field name to rename it. Use the Required toggle to mark fields as required or optional.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setModalMode("preview")}>
              <Eye className="w-4 h-4 mr-1.5" /> Preview
            </Button>
            {!isChildCheckin && (
              <>
                <Button size="sm" onClick={() => openSystemPicker()}>
                  <Sparkles className="w-4 h-4 mr-1.5" /> Add System Field
                </Button>
                <Button size="sm" variant="outline" onClick={() => openCustomEditor()}>
                  <Plus className="w-4 h-4 mr-1.5" /> Add Custom Question
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ── Sectioned layout (child check-in) ──────────────────────────────── */}
        {isChildCheckin ? (
          <div className="space-y-4">
            {SECTIONS.map((section) => {
              const sectionFields = fieldsBySection[section.key];
              return (
                <div key={section.key} className="rounded-xl border border-border overflow-hidden shadow-sm">
                  {/* Section header */}
                  <div className={`px-4 py-2.5 flex items-center justify-between ${section.headerClass}`}>
                    <div className="flex items-center gap-2.5">
                      <section.Icon className={`w-4 h-4 ${section.iconClass}`} />
                      <span className={`font-semibold text-sm ${section.titleClass}`}>{section.title}</span>
                      {section.repeats && (
                        <span className={`flex items-center gap-1 text-xs opacity-70 ml-1 ${section.titleClass}`}>
                          <RefreshCw className="w-3 h-3" />
                          Repeats per child
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {section.key !== "additional_questions" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className={`h-7 text-xs opacity-70 hover:opacity-100 hover:bg-black/10 ${section.titleClass}`}
                          onClick={() => openSystemPicker(section.key)}
                        >
                          <Sparkles className="w-3 h-3 mr-1" />
                          {section.addSystemLabel}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className={`h-7 text-xs opacity-70 hover:opacity-100 hover:bg-black/10 ${section.titleClass}`}
                        onClick={() => openCustomEditor(section.key)}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        {section.addCustomLabel}
                      </Button>
                    </div>
                  </div>

                  {/* Section description */}
                  {section.description && (
                    <div className="px-4 py-2 bg-muted/20 border-b border-border flex items-center gap-2">
                      <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <p className="text-xs text-muted-foreground">{section.description}</p>
                    </div>
                  )}

                  {/* Fields */}
                  <div className="p-3 space-y-2 bg-background">
                    {sectionFields.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4 italic">
                        No fields in this section yet.
                      </p>
                    ) : (
                      sectionFields.map((field, idx) => (
                        <FieldCard
                          key={field.id}
                          field={field}
                          index={idx}
                          total={sectionFields.length}
                          onEdit={() => openFieldEditor(field)}
                          onDelete={() => handleDeleteField(field)}
                          onMove={(dir) => handleMoveSectionField(field.id, section.key, dir)}
                          onInlineUpdate={(updates, onSaved) => handleInlineUpdate(field, updates, onSaved)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── Flat layout (non child check-in) ──────────────────────────────── */
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={() => openSystemPicker()}>
                <Sparkles className="w-4 h-4 mr-1.5" /> Add System Field
              </Button>
              <Button size="sm" variant="outline" onClick={() => openCustomEditor()}>
                <Plus className="w-4 h-4 mr-1.5" /> Add Custom Question
              </Button>
            </div>
            {!fields || fields.length === 0 ? (
              <Card className="border-dashed bg-transparent">
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground text-sm">
                    No fields yet. Add system fields or custom questions.
                  </p>
                </CardContent>
              </Card>
            ) : (
              [...fields].sort((a, b) => a.sortOrder - b.sortOrder).map((field, index) => (
                <FieldCard
                  key={field.id}
                  field={field}
                  index={index}
                  total={fields.length}
                  onEdit={() => openFieldEditor(field)}
                  onDelete={() => handleDeleteField(field)}
                  onMove={(dir) => {
                    const sorted = [...fields].sort((a, b) => a.sortOrder - b.sortOrder);
                    const reordered = [...sorted];
                    if (dir === "up" && index > 0) {
                      [reordered[index], reordered[index - 1]] = [reordered[index - 1], reordered[index]];
                    } else if (dir === "down" && index < reordered.length - 1) {
                      [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
                    } else return;
                    reorderFormFields.mutate({ formId, data: { fieldIds: reordered.map((f) => f.id) } });
                  }}
                  onInlineUpdate={(updates, onSaved) => handleInlineUpdate(field, updates, onSaved)}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Right: form settings sidebar ──────────────────────────────────────── */}
      {!hideSettings && <div>
        <Card className="border-card-border shadow-sm sticky top-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="w-4 h-4 text-primary" /> Form Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fb-title">Title</Label>
              <Input
                id="fb-title"
                value={formSettings.title}
                onChange={(e) => setFormSettings((p) => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fb-desc">Header Text</Label>
              <Textarea
                id="fb-desc"
                rows={2}
                placeholder="Welcome message shown above this form…"
                value={formSettings.description}
                onChange={(e) => setFormSettings((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between py-2 border-t border-border">
              <div>
                <Label className="text-sm">Active</Label>
                <p className="text-xs text-muted-foreground">Accepting responses</p>
              </div>
              <Switch
                checked={formSettings.isActive}
                onCheckedChange={(c) => setFormSettings((p) => ({ ...p, isActive: c }))}
              />
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <div>
                <Label className="text-sm">Public</Label>
                <p className="text-xs text-muted-foreground">Show in embed links</p>
              </div>
              <Switch
                checked={formSettings.isPublic}
                onCheckedChange={(c) => setFormSettings((p) => ({ ...p, isPublic: c }))}
              />
            </div>
            {!hideAdditionalPeople && (
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label className="text-sm flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    Additional People
                  </Label>
                  <p className="text-xs text-muted-foreground">Allow registering multiple people</p>
                </div>
                <Switch
                  checked={formSettings.allowAdditionalPeople}
                  onCheckedChange={(c) => setFormSettings((p) => ({ ...p, allowAdditionalPeople: c }))}
                />
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              size="sm"
              onClick={() => updateForm.mutate({ formId, data: formSettings })}
              disabled={updateForm.isPending}
            >
              <Save className="w-4 h-4 mr-1.5" />
              {updateForm.isPending ? "Saving…" : "Save Settings"}
            </Button>
          </CardFooter>
        </Card>
      </div>}

      {/* ── System Field Picker ───────────────────────────────────────────────── */}
      <Dialog open={modalMode === "system-picker"} onOpenChange={(open) => !open && setModalMode("none")}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              {pickerTargetSection
                ? `Add Field — ${SECTIONS.find((s) => s.key === pickerTargetSection)?.title}`
                : "Add System Field"}
            </DialogTitle>
            <DialogDescription>
              {pickerTargetSection
                ? "Showing fields for this section. Fields auto-place into the correct section."
                : "System fields map to structured database columns. The key is permanent — you can freely rename the label."}
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9"
              placeholder="Search fields…"
              value={systemSearch}
              onChange={(e) => setSystemSearch(e.target.value)}
              autoFocus
            />
          </div>

          <div className="max-h-[380px] overflow-y-auto -mx-6 px-6 space-y-5 pb-1">
            {CATEGORY_ORDER.map((category) => {
              const defsInCategory = filteredSystemFields.filter((d) => d.category === category);
              if (defsInCategory.length === 0) return null;
              const sectionForCategory = SECTION_CATEGORY_MAP[category];
              const sectionLabel = SECTIONS.find((s) => s.key === sectionForCategory)?.title ?? sectionForCategory;
              return (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {CATEGORY_DISPLAY_LABELS[category]}
                    </p>
                    <span className="text-xs text-muted-foreground/60">→ {sectionLabel}</span>
                  </div>
                  <div className="space-y-1">
                    {defsInCategory.map((def) => {
                      const alreadyAdded = addedSystemKeys.has(def.key);
                      const isRoomField = def.key === "room_assignment";
                      const noRooms = isRoomField && eventRooms.length === 0;
                      const isDisabled = alreadyAdded || noRooms || createFormField.isPending;
                      return (
                        <button
                          key={def.key}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => !isDisabled && handleAddSystemField(def)}
                          className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left transition-colors text-sm group ${isDisabled ? "opacity-50 cursor-not-allowed" : "hover:bg-muted/70 cursor-pointer"}`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {isRoomField ? (
                              <DoorOpen className="w-3.5 h-3.5 flex-shrink-0 text-primary/70" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5 flex-shrink-0 text-primary/70" />
                            )}
                            <div className="min-w-0">
                              <span className="font-medium text-foreground">{def.label}</span>
                              {isRoomField ? (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  {eventRooms.length > 0 ? `${eventRooms.length} rooms` : "No rooms configured"}
                                </span>
                              ) : (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  {FIELD_TYPE_LABELS[def.fieldType] ?? def.fieldType}
                                </span>
                              )}
                            </div>
                          </div>
                          {alreadyAdded ? (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Added
                            </span>
                          ) : noRooms ? (
                            <span className="text-xs text-muted-foreground flex-shrink-0">Add rooms first</span>
                          ) : (
                            <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0">+ Add</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {filteredSystemFields.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                No fields match{systemSearch ? ` "${systemSearch}"` : " the current filter"}.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalMode("none")}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Field editor ─────────────────────────────────────────────────────── */}
      <Dialog open={modalMode === "field-editor"} onOpenChange={(open) => !open && setModalMode("none")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingField?.id
                ? isEditingSystemField ? "Edit System Field" : "Edit Custom Question"
                : "Add Custom Question"}
            </DialogTitle>
            <DialogDescription>
              {editingField?.id
                ? "Advanced settings. Label, required, and placeholder are editable directly on the field card."
                : "Configure this custom question."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* ── Editing an existing field: advanced settings only ── */}
            {editingField?.id ? (
              <>
                {isEditingSystemField && editingField.systemKey && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary/5 border border-primary/20">
                    <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <div className="text-xs">
                      <span className="font-medium text-primary">System field</span>
                      <span className="text-muted-foreground ml-1.5">key: <code className="font-mono">{editingField.systemKey}</code></span>
                    </div>
                  </div>
                )}

                {/* Field type — readonly for system, editable for custom */}
                <div className="space-y-1.5">
                  <Label>Field Type</Label>
                  {isEditingSystemField ? (
                    <div className="h-9 px-3 py-2 rounded-md border border-input bg-muted/40 text-sm text-muted-foreground flex items-center">
                      {FIELD_TYPE_LABELS[editingField?.fieldType ?? "text"] ?? editingField?.fieldType}
                    </div>
                  ) : (
                    <Select
                      value={editingField?.fieldType ?? "text"}
                      onValueChange={(v) => setEditingField((p) => ({ ...p, fieldType: v as FormField["fieldType"] }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Short Text</SelectItem>
                        <SelectItem value="textarea">Long Text</SelectItem>
                        <SelectItem value="select">Dropdown</SelectItem>
                        <SelectItem value="multiselect">Multiple Choice</SelectItem>
                        <SelectItem value="checkbox">Checkbox</SelectItem>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="phone">Phone Number</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Options — custom select/multiselect only */}
                {!isEditingSystemField && (editingField?.fieldType === "select" || editingField?.fieldType === "multiselect") && (
                  <div className="space-y-1.5 animate-in fade-in zoom-in duration-200">
                    <Label>Options (comma-separated)</Label>
                    <Input
                      value={editingField?.options ?? ""}
                      onChange={(e) => setEditingField((p) => ({ ...p, options: e.target.value }))}
                      placeholder="Option A, Option B, Option C"
                    />
                  </div>
                )}

                {/* Section selector */}
                {isChildCheckin && !isEditingSystemField && (
                  <div className="space-y-1.5">
                    <Label>Section</Label>
                    <Select
                      value={editingField?.sectionKey ?? "additional_questions"}
                      onValueChange={(v) => setEditingField((p) => ({ ...p, sectionKey: v }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SECTIONS.map((s) => (
                          <SelectItem key={s.key} value={s.key}>{s.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {isChildCheckin && isEditingSystemField && (
                  <p className="text-xs text-muted-foreground">System fields are auto-placed by category and cannot be moved.</p>
                )}
              </>
            ) : (
              /* ── Adding a new custom field: full form ── */
              <>
                <div className="space-y-1.5">
                  <Label>Field Label</Label>
                  <Input
                    value={editingField?.label ?? ""}
                    onChange={(e) => setEditingField((p) => ({ ...p, label: e.target.value }))}
                    placeholder="e.g. T-Shirt Size"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Field Type</Label>
                    <Select
                      value={editingField?.fieldType ?? "text"}
                      onValueChange={(v) => setEditingField((p) => ({ ...p, fieldType: v as FormField["fieldType"] }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Short Text</SelectItem>
                        <SelectItem value="textarea">Long Text</SelectItem>
                        <SelectItem value="select">Dropdown</SelectItem>
                        <SelectItem value="multiselect">Multiple Choice</SelectItem>
                        <SelectItem value="checkbox">Checkbox</SelectItem>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="phone">Phone Number</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2 pt-7">
                    <Switch
                      id="fe-required"
                      checked={editingField?.required ?? false}
                      onCheckedChange={(c) => setEditingField((p) => ({ ...p, required: c }))}
                    />
                    <Label htmlFor="fe-required">Required</Label>
                  </div>
                </div>

                {isChildCheckin && (
                  <div className="space-y-1.5">
                    <Label>Section</Label>
                    <Select
                      value={editingField?.sectionKey ?? "additional_questions"}
                      onValueChange={(v) => setEditingField((p) => ({ ...p, sectionKey: v }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SECTIONS.map((s) => (
                          <SelectItem key={s.key} value={s.key}>{s.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {(editingField?.fieldType === "select" || editingField?.fieldType === "multiselect") && (
                  <div className="space-y-1.5 animate-in fade-in zoom-in duration-200">
                    <Label>Options (comma-separated)</Label>
                    <Input
                      value={editingField?.options ?? ""}
                      onChange={(e) => setEditingField((p) => ({ ...p, options: e.target.value }))}
                      placeholder="Option A, Option B, Option C"
                    />
                  </div>
                )}

                {!["checkbox", "select", "multiselect"].includes(editingField?.fieldType ?? "text") && (
                  <div className="space-y-1.5">
                    <Label>Placeholder (optional)</Label>
                    <Input
                      value={editingField?.placeholder ?? ""}
                      onChange={(e) => setEditingField((p) => ({ ...p, placeholder: e.target.value }))}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalMode("none")}>Cancel</Button>
            <Button onClick={handleSaveField} disabled={createFormField.isPending || updateFormField.isPending}>
              {editingField?.id ? "Save Changes" : "Add Question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Preview dialog ────────────────────────────────────────────────────── */}
      <Dialog open={modalMode === "preview"} onOpenChange={(open) => !open && setModalMode("none")}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" /> Form Preview
            </DialogTitle>
            <DialogDescription>
              How the form looks to registrants. No data will be saved.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-border bg-background overflow-hidden">
            <div className="bg-primary/5 border-b border-border px-6 py-5">
              <h2 className="text-xl font-serif font-bold">{formSettings.title || "Untitled Form"}</h2>
              {formSettings.description && (
                <p className="mt-1.5 text-sm text-muted-foreground">{formSettings.description}</p>
              )}
            </div>

            <div className="space-y-0">
              {isChildCheckin ? (
                <>
                  {/* Guardian section */}
                  {fieldsBySection.guardian_info.length > 0 && (
                    <div>
                      <div className="bg-amber-50 border-b border-amber-100 px-6 py-3.5 flex items-center gap-2">
                        <Users className="w-4 h-4 text-amber-700" />
                        <span className="text-base font-semibold text-amber-900">Parent / Guardian Information</span>
                      </div>
                      <div className="px-6 py-5 space-y-5">
                        {fieldsBySection.guardian_info.map((field) => (
                          <PreviewField key={field.id} field={field} rooms={eventRooms} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Child section */}
                  {fieldsBySection.child_info.length > 0 && (
                    <div className="border-t border-border">
                      <div className="bg-orange-50 border-b border-orange-100 px-6 py-3.5 flex items-center gap-2">
                        <Baby className="w-4 h-4 text-orange-700" />
                        <span className="text-base font-semibold text-orange-900">Child Information</span>
                      </div>
                      <div className="px-6 py-5 space-y-5">
                        {fieldsBySection.child_info.map((field) => (
                          <PreviewField key={field.id} field={field} rooms={eventRooms} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add another child button */}
                  <div className="border-t border-border px-6 py-4">
                    <button type="button" disabled className="text-sm text-primary flex items-center gap-1.5 opacity-60">
                      <Plus className="w-3.5 h-3.5" /> Add Another Child
                    </button>
                  </div>

                  {/* Emergency Contact section */}
                  {fieldsBySection.emergency_contact.length > 0 && (
                    <div className="border-t border-border">
                      <div className="bg-rose-50 border-b border-rose-100 px-6 py-3.5 flex items-center gap-2">
                        <Phone className="w-4 h-4 text-rose-700" />
                        <span className="text-base font-semibold text-rose-900">Emergency Contact Information</span>
                      </div>
                      <div className="px-6 py-5 space-y-5">
                        {fieldsBySection.emergency_contact.map((field) => (
                          <PreviewField key={field.id} field={field} rooms={eventRooms} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Additional Questions — separate section, shown once, never repeats */}
                  {fieldsBySection.additional_questions.length > 0 && (
                    <div className="border-t border-border">
                      <div className="bg-slate-50 border-b border-slate-100 px-6 py-3.5 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-slate-500" />
                        <span className="text-base font-semibold text-slate-800">Additional Questions</span>
                      </div>
                      <div className="px-6 py-5 space-y-5">
                        {fieldsBySection.additional_questions.map((field) => (
                          <PreviewField key={field.id} field={field} rooms={eventRooms} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="px-6 py-5 space-y-5">
                  {!fields || fields.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic text-center py-6">No fields added yet.</p>
                  ) : (
                    [...fields].sort((a, b) => a.sortOrder - b.sortOrder).map((field) => (
                      <PreviewField key={field.id} field={field} rooms={eventRooms} />
                    ))
                  )}
                  {formSettings.allowAdditionalPeople && (
                    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Additional People</span>
                      </div>
                      <button type="button" disabled className="text-sm text-primary flex items-center gap-1.5 opacity-60">
                        <Plus className="w-3.5 h-3.5" /> Add another person
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Submit button */}
              <div className="border-t border-border px-6 py-5">
                <button type="button" disabled className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium opacity-60 cursor-not-allowed">
                  Complete Registration
                </button>
                <p className="text-xs text-center text-muted-foreground mt-2">Submit button disabled in preview</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalMode("none")}>Close Preview</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Preview field renderer ──────────────────────────────────────────────────

function PreviewField({ field, rooms = [] }: { field: FormField; rooms?: Room[] }) {
  const label = (
    <div className="flex items-center gap-1.5 mb-1.5">
      <span className="text-sm font-medium text-foreground">{field.label}</span>
      {field.required && <span className="text-destructive text-xs font-bold">*</span>}
    </div>
  );

  const inputClass = "w-full h-9 rounded-md border border-input bg-muted/30 px-3 text-sm text-muted-foreground cursor-not-allowed";
  const textareaClass = "w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed resize-none";
  const placeholder = field.placeholder || "";

  if (field.systemKey === "room_assignment") {
    return (
      <div>
        {label}
        <div className={`${inputClass} flex items-center justify-between`}>
          <span className="text-muted-foreground/60">{rooms.length > 0 ? rooms[0].name : "No rooms available"}</span>
          <ChevronDown className="w-4 h-4 opacity-50" />
        </div>
        {rooms.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">Options: {rooms.map((r) => r.name).join(", ")}</p>
        )}
      </div>
    );
  }

  if (field.fieldType === "textarea") {
    return <div>{label}<textarea disabled rows={3} placeholder={placeholder} className={textareaClass} /></div>;
  }

  if (field.fieldType === "select") {
    const opts = field.options ? field.options.split(",").map((o) => o.trim()) : [];
    return (
      <div>
        {label}
        <div className={`${inputClass} flex items-center justify-between`}>
          <span>{opts[0] ?? "Select an option…"}</span>
          <ChevronDown className="w-4 h-4 opacity-50" />
        </div>
      </div>
    );
  }

  if (field.fieldType === "multiselect") {
    const opts = field.options ? field.options.split(",").map((o) => o.trim()) : [];
    return (
      <div>
        {label}
        <div className="flex flex-wrap gap-2">
          {opts.slice(0, 4).map((opt) => (
            <label key={opt} className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-not-allowed">
              <input type="checkbox" disabled className="rounded" /> {opt}
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.fieldType === "checkbox") {
    return (
      <div className="flex items-center gap-2">
        <input type="checkbox" disabled className="rounded" />
        <span className="text-sm text-foreground">{field.label}</span>
        {field.required && <span className="text-destructive text-xs font-bold">*</span>}
      </div>
    );
  }

  const inputType =
    field.fieldType === "email" ? "email"
    : field.fieldType === "phone" ? "tel"
    : field.fieldType === "date" ? "date"
    : field.fieldType === "number" ? "number"
    : "text";

  return <div>{label}<input disabled type={inputType} placeholder={placeholder} className={inputClass} /></div>;
}
