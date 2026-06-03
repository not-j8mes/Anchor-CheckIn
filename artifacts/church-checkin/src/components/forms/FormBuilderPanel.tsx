import { useState, useEffect } from "react";
import {
  useGetForm,
  useUpdateForm,
  useListFormFields,
  useCreateFormField,
  useUpdateFormField,
  useDeleteFormField,
  useReorderFormFields,
  getGetFormQueryKey,
  getListFormFieldsQueryKey,
  type FormField,
  type FormFieldInput,
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
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  SYSTEM_FIELDS,
  SYSTEM_FIELD_CATEGORIES,
  getSystemField,
  type SystemFieldCategory,
  type SystemFieldDef,
} from "@/lib/systemFields";

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

const CATEGORY_ORDER: SystemFieldCategory[] = ["participant", "guardian", "emergency_safety"];

// ─── Types ──────────────────────────────────────────────────────────────────────

type ModalMode = "none" | "system-picker" | "field-editor";

interface FormBuilderPanelProps {
  formId: number;
}

// ─── Sub-component: FieldCard ───────────────────────────────────────────────────

interface FieldCardProps {
  field: FormField;
  index: number;
  total: number;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (dir: "up" | "down") => void;
}

function FieldCard({ field, index, total, onEdit, onDelete, onMove }: FieldCardProps) {
  const isSystem = field.fieldKind === FormFieldFieldKind.system;
  const sysDef = isSystem && field.systemKey ? getSystemField(field.systemKey) : undefined;

  const subtitle = isSystem
    ? [
        "System Field",
        sysDef ? SYSTEM_FIELD_CATEGORIES[sysDef.category] : "System",
        field.required ? "Required" : "Optional",
      ].join(" · ")
    : [
        "Custom Question",
        FIELD_TYPE_LABELS[field.fieldType] ?? field.fieldType,
        field.required ? "Required" : "Optional",
      ].join(" · ");

  return (
    <Card className="hover-elevate transition-all border-card-border overflow-hidden">
      <div className="flex items-stretch">
        {/* Reorder column */}
        <div className="p-3 flex flex-col gap-1 text-muted-foreground border-r border-border bg-muted/10 justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onMove("up")}
            disabled={index === 0}
          >
            <ArrowUp className="w-3 h-3" />
          </Button>
          <GripVertical className="w-4 h-4 mx-auto opacity-40" />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onMove("down")}
            disabled={index === total - 1}
          >
            <ArrowDown className="w-3 h-3" />
          </Button>
        </div>

        {/* Content */}
        <CardContent className="p-4 flex-1 flex justify-between items-center gap-4">
          <div className="flex items-start gap-3 min-w-0">
            {/* Icon badge */}
            <div
              className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center ${
                isSystem
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {isSystem ? (
                <Sparkles className="w-3.5 h-3.5" />
              ) : (
                <MessageSquare className="w-3.5 h-3.5" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-foreground truncate">{field.label}</span>
                {field.required && (
                  <span className="text-xs text-destructive font-semibold">*</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={onEdit}>
              Edit
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

export function FormBuilderPanel({ formId }: FormBuilderPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Data ──────────────────────────────────────────────────────────────────────
  const { data: form, isLoading: formLoading } = useGetForm(formId, {
    query: { queryKey: getGetFormQueryKey(formId) },
  });
  const { data: fields, isLoading: fieldsLoading } = useListFormFields(formId, {
    query: { queryKey: getListFormFieldsQueryKey(formId) },
  });

  // ── Form settings state ───────────────────────────────────────────────────────
  const [formSettings, setFormSettings] = useState({
    title: "",
    description: "",
    isActive: true,
    isPublic: true,
  });

  useEffect(() => {
    if (form) {
      setFormSettings({
        title: form.title,
        description: form.description ?? "",
        isActive: form.isActive,
        isPublic: form.isPublic,
      });
    }
  }, [form]);

  // ── Modal state ───────────────────────────────────────────────────────────────
  const [modalMode, setModalMode] = useState<ModalMode>("none");
  const [editingField, setEditingField] = useState<Partial<FormField> | null>(null);
  const [systemSearch, setSystemSearch] = useState("");

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
      onSuccess: () => {
        setModalMode("none");
        invalidateFields();
      },
      onError: () => {
        toast({ title: "Failed to add field", variant: "destructive" });
      },
    },
  });

  const updateFormField = useUpdateFormField({
    mutation: {
      onSuccess: () => {
        toast({ title: "Field updated" });
        setModalMode("none");
        invalidateFields();
      },
      onError: () => {
        toast({ title: "Failed to update field", variant: "destructive" });
      },
    },
  });

  const deleteFormField = useDeleteFormField({
    mutation: {
      onSuccess: () => {
        toast({ title: "Field removed" });
        invalidateFields();
      },
    },
  });

  const reorderFormFields = useReorderFormFields({
    mutation: { onSuccess: invalidateFields },
  });

  // ── Derived data ──────────────────────────────────────────────────────────────

  /** System keys already present in this form */
  const addedSystemKeys = new Set<string>(
    fields
      ?.filter((f) => f.fieldKind === FormFieldFieldKind.system && f.systemKey)
      .map((f) => f.systemKey!) ?? []
  );

  /** System field definitions filtered by search query */
  const filteredSystemFields = SYSTEM_FIELDS.filter((def) => {
    const q = systemSearch.toLowerCase();
    return (
      !q ||
      def.label.toLowerCase().includes(q) ||
      def.key.toLowerCase().includes(q) ||
      SYSTEM_FIELD_CATEGORIES[def.category].toLowerCase().includes(q)
    );
  });

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
      },
    });
  };

  const handleSaveField = () => {
    if (!editingField?.label?.trim()) {
      toast({ title: "Label is required", variant: "destructive" });
      return;
    }
    const data: FormFieldInput = {
      label: editingField.label.trim(),
      fieldType: editingField.fieldType as FormFieldInput["fieldType"] ?? "text",
      required: !!editingField.required,
      sortOrder: editingField.sortOrder ?? (fields?.length ?? 0),
      placeholder: editingField.placeholder ?? "",
      options: editingField.options ?? "",
      fieldKind: editingField.fieldKind as FormFieldInput["fieldKind"],
      systemKey: editingField.systemKey ?? undefined,
    };
    if (editingField.id) {
      updateFormField.mutate({ formId, fieldId: editingField.id, data });
    } else {
      createFormField.mutate({ formId, data: { ...data, fieldKind: "custom" } });
    }
  };

  const handleDeleteField = (field: FormField) => {
    if (!confirm(`Remove "${field.label}" from this form?`)) return;
    deleteFormField.mutate({ formId, fieldId: field.id });
  };

  const handleMoveField = (index: number, direction: "up" | "down") => {
    if (!fields) return;
    const reordered = [...fields];
    if (direction === "up" && index > 0) {
      [reordered[index], reordered[index - 1]] = [reordered[index - 1], reordered[index]];
    } else if (direction === "down" && index < reordered.length - 1) {
      [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
    } else {
      return;
    }
    reorderFormFields.mutate({ formId, data: { fieldIds: reordered.map((f) => f.id) } });
  };

  const openCustomEditor = () => {
    setEditingField({ fieldKind: "custom", fieldType: "text", required: false });
    setModalMode("field-editor");
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

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* ── Left: field list ──────────────────────────────────────────────────── */}
      <div className="md:col-span-2 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center gap-2 flex-wrap">
          <h2 className="text-lg font-serif font-bold">Form Fields</h2>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                setSystemSearch("");
                setModalMode("system-picker");
              }}
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              Add System Field
            </Button>
            <Button size="sm" variant="outline" onClick={openCustomEditor}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add Custom Question
            </Button>
          </div>
        </div>

        {/* Field list */}
        <div className="space-y-3">
          {!fields || fields.length === 0 ? (
            <Card className="border-dashed bg-transparent">
              <CardContent className="p-8 text-center space-y-3">
                <p className="text-muted-foreground text-sm">
                  No fields yet. Add system fields for common child &amp; guardian info, or
                  create custom questions.
                </p>
                <div className="flex justify-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSystemSearch("");
                      setModalMode("system-picker");
                    }}
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Add System Field
                  </Button>
                  <Button size="sm" variant="outline" onClick={openCustomEditor}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Add Custom Question
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            fields.map((field, index) => (
              <FieldCard
                key={field.id}
                field={field}
                index={index}
                total={fields.length}
                onEdit={() => openFieldEditor(field)}
                onDelete={() => handleDeleteField(field)}
                onMove={(dir) => handleMoveField(index, dir)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right: form settings sidebar ──────────────────────────────────────── */}
      <div>
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
              <Label htmlFor="fb-desc">Description</Label>
              <Textarea
                id="fb-desc"
                rows={2}
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
      </div>

      {/* ── System Field Picker dialog ────────────────────────────────────────── */}
      <Dialog
        open={modalMode === "system-picker"}
        onOpenChange={(open) => !open && setModalMode("none")}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Add System Field
            </DialogTitle>
            <DialogDescription>
              System fields map to structured columns in the database. The key is
              permanent — you can freely rename the label.
            </DialogDescription>
          </DialogHeader>

          {/* Search */}
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

          {/* Grouped field list */}
          <div className="max-h-[380px] overflow-y-auto -mx-6 px-6 space-y-5 pb-1">
            {CATEGORY_ORDER.map((category) => {
              const defsInCategory = filteredSystemFields.filter(
                (d) => d.category === category
              );
              if (defsInCategory.length === 0) return null;
              return (
                <div key={category}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {SYSTEM_FIELD_CATEGORIES[category]}
                  </p>
                  <div className="space-y-1">
                    {defsInCategory.map((def) => {
                      const alreadyAdded = addedSystemKeys.has(def.key);
                      return (
                        <button
                          key={def.key}
                          type="button"
                          disabled={alreadyAdded || createFormField.isPending}
                          onClick={() => !alreadyAdded && handleAddSystemField(def)}
                          className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left transition-colors text-sm group
                            ${
                              alreadyAdded
                                ? "opacity-50 cursor-not-allowed bg-transparent"
                                : "hover:bg-muted/70 cursor-pointer"
                            }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Sparkles className="w-3.5 h-3.5 flex-shrink-0 text-primary/70" />
                            <div className="min-w-0">
                              <span className="font-medium text-foreground">{def.label}</span>
                              <span className="ml-2 text-xs text-muted-foreground">
                                {FIELD_TYPE_LABELS[def.fieldType] ?? def.fieldType}
                              </span>
                            </div>
                          </div>
                          {alreadyAdded ? (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                              Already added
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0">
                              + Add
                            </span>
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
                No fields match "{systemSearch}"
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalMode("none")}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Field editor dialog (custom + edit) ───────────────────────────────── */}
      <Dialog
        open={modalMode === "field-editor"}
        onOpenChange={(open) => !open && setModalMode("none")}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingField?.id
                ? isEditingSystemField
                  ? "Edit System Field"
                  : "Edit Custom Question"
                : "Add Custom Question"}
            </DialogTitle>
            <DialogDescription>
              {isEditingSystemField
                ? "You can rename the label and change required/placeholder. Field type is fixed by the system."
                : "Configure the custom question for this form."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* System field type badge (read-only indicator) */}
            {isEditingSystemField && editingField?.systemKey && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary/5 border border-primary/20">
                <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <div className="text-xs">
                  <span className="font-medium text-primary">System field</span>
                  <span className="text-muted-foreground ml-1.5">
                    key: <code className="font-mono">{editingField.systemKey}</code>
                  </span>
                </div>
              </div>
            )}

            {/* Label */}
            <div className="space-y-1.5">
              <Label>Field Label</Label>
              <Input
                value={editingField?.label ?? ""}
                onChange={(e) =>
                  setEditingField((p) => ({ ...p, label: e.target.value }))
                }
                placeholder="e.g. T-Shirt Size"
              />
            </div>

            {/* Field type + Required */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Field Type</Label>
                {isEditingSystemField ? (
                  <div className="h-9 px-3 py-2 rounded-md border border-input bg-muted/40 text-sm text-muted-foreground flex items-center">
                    {FIELD_TYPE_LABELS[editingField?.fieldType ?? "text"] ??
                      editingField?.fieldType}
                  </div>
                ) : (
                  <Select
                    value={editingField?.fieldType ?? "text"}
                    onValueChange={(v) =>
                      setEditingField((p) => ({
                        ...p,
                        fieldType: v as FormField["fieldType"],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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

              <div className="flex items-center gap-2 pt-7">
                <Switch
                  id="fe-required"
                  checked={editingField?.required ?? false}
                  onCheckedChange={(c) =>
                    setEditingField((p) => ({ ...p, required: c }))
                  }
                />
                <Label htmlFor="fe-required">Required</Label>
              </div>
            </div>

            {/* Options — shown for select/multiselect, locked for system fields */}
            {(editingField?.fieldType === "select" ||
              editingField?.fieldType === "multiselect") && (
              <div className="space-y-1.5 animate-in fade-in zoom-in duration-200">
                <Label>Options (comma-separated)</Label>
                <Input
                  value={editingField?.options ?? ""}
                  onChange={(e) =>
                    setEditingField((p) => ({ ...p, options: e.target.value }))
                  }
                  placeholder="Option A, Option B, Option C"
                  disabled={isEditingSystemField}
                />
                {isEditingSystemField && (
                  <p className="text-xs text-muted-foreground">
                    Options are fixed for system fields.
                  </p>
                )}
              </div>
            )}

            {/* Placeholder — hide for checkbox, select, multiselect */}
            {!["checkbox", "select", "multiselect"].includes(
              editingField?.fieldType ?? "text"
            ) && (
              <div className="space-y-1.5">
                <Label>Placeholder (optional)</Label>
                <Input
                  value={editingField?.placeholder ?? ""}
                  onChange={(e) =>
                    setEditingField((p) => ({ ...p, placeholder: e.target.value }))
                  }
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalMode("none")}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveField}
              disabled={createFormField.isPending || updateFormField.isPending}
            >
              {editingField?.id ? "Save Changes" : "Add Question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
