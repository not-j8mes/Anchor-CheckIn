import { useState } from "react";
import { useParams } from "wouter";
import {
  useGetOrganization,
  useSubmitRegistration,
  getGetFormBySlugQueryKey,
  getFormBySlug,
  type FormField,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Plus, Trash2, User, Users } from "lucide-react";
import { SYSTEM_FIELDS_BY_KEY } from "@/lib/systemFields";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true when this form field should go in the "Parent / Guardian" section
 * rather than the per-child section.
 */
function isGuardianField(field: FormField): boolean {
  if (field.fieldKind !== "system" || !field.systemKey) return false;
  const def = SYSTEM_FIELDS_BY_KEY.get(field.systemKey);
  return def?.category === "guardian" || def?.category === "emergency_safety";
}

// ─── Field renderer ───────────────────────────────────────────────────────────

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string;
  onChange: (v: string) => void;
}) {
  const { fieldType, placeholder, options, required, label } = field;

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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PublicRegistrationForm() {
  const params = useParams<{ embedSlug: string }>();
  const slug = params.embedSlug;

  const { data: org } = useGetOrganization();

  const { data: form, isLoading: formLoading } = useQuery({
    queryKey: getGetFormBySlugQueryKey(slug),
    queryFn: () => getFormBySlug(slug),
    enabled: !!slug,
    retry: false,
  });

  // Guardian/family answers — keyed by formField.id (same values shared across all children)
  const [guardianAnswers, setGuardianAnswers] = useState<Record<number, string>>({});

  // Per-child answers — one Record<fieldId, string> per child
  const [childrenAnswers, setChildrenAnswers] = useState<Record<number, string>[]>([{}]);

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitRegistration = useSubmitRegistration();

  if (formLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!form || !form.isActive) {
    return (
      <div className="flex-1 min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold font-serif mb-2">Form Unavailable</h1>
        <p className="text-muted-foreground">
          This registration form is currently closed or does not exist.
        </p>
      </div>
    );
  }

  // ── Prefer formFields (new system); fall back to empty if none configured ──
  const formFields: FormField[] = form.formFields ?? [];
  const isChildCheckin = !form.registrationType || form.registrationType === "child_checkin";

  const guardianFields = formFields.filter(isGuardianField);
  const childFields = formFields.filter((f) => !isGuardianField(f));

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleGuardianChange = (fieldId: number, value: string) => {
    setGuardianAnswers((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleChildChange = (childIndex: number, fieldId: number, value: string) => {
    setChildrenAnswers((prev) => {
      const next = [...prev];
      next[childIndex] = { ...next[childIndex], [fieldId]: value };
      return next;
    });
  };

  const addChild = () => setChildrenAnswers((prev) => [...prev, {}]);
  const removeChild = (index: number) =>
    setChildrenAnswers((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      for (const childAnswerMap of childrenAnswers) {
        // Build fields array: guardian answers (shared) + child answers (per-child)
        const fields: { fieldId: number; value: string }[] = [];

        for (const gf of guardianFields) {
          fields.push({ fieldId: gf.id, value: guardianAnswers[gf.id] ?? "" });
        }
        for (const cf of childFields) {
          fields.push({ fieldId: cf.id, value: childAnswerMap[cf.id] ?? "" });
        }

        await submitRegistration.mutateAsync({ formId: form.id, data: { fields } });
      }
      setIsSubmitted(true);
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setGuardianAnswers({});
    setChildrenAnswers([{}]);
    setSubmitError(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 min-h-screen bg-muted/20 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Org header */}
        <div className="text-center space-y-3 mb-8">
          {org?.logoUrl ? (
            <img src={org.logoUrl} alt={org.name} className="h-20 mx-auto object-contain" />
          ) : (
            <div className="w-20 h-20 mx-auto bg-primary text-primary-foreground rounded-full flex items-center justify-center font-serif text-3xl font-bold">
              {org?.name?.charAt(0) ?? "C"}
            </div>
          )}
          <h1 className="text-3xl font-serif font-bold text-foreground">{org?.name}</h1>
          {form.description && (
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">{form.description}</p>
          )}
        </div>

        {isSubmitted ? (
          <Card className="shadow-xl overflow-hidden text-center py-14">
            <CardContent className="flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-serif font-bold">Registration Complete!</h2>
              <p className="text-muted-foreground text-lg max-w-md">
                {childrenAnswers.length > 1
                  ? `Thank you! ${childrenAnswers.length} ${isChildCheckin ? "children" : "people"} have been registered successfully.`
                  : "Thank you for registering. We look forward to seeing you!"}
              </p>
              <Button
                size="lg"
                variant="outline"
                className="mt-4 gap-2 h-12 text-base"
                onClick={handleReset}
              >
                <Plus className="w-4 h-4" />
                {isChildCheckin ? "Register Another Child" : "Register Another Person"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-6"
            data-testid="registration-form"
          >
            {/* Form title */}
            <div className="text-center pb-2">
              <h2 className="text-2xl font-serif font-bold text-foreground">{form.title}</h2>
            </div>

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
                        onChange={(v) => handleGuardianChange(field.id, v)}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Per-child sections */}
            {childrenAnswers.map((childAnswerMap, idx) => (
              <Card
                key={idx}
                className="shadow-sm overflow-hidden"
                data-testid={`child-section-${idx}`}
              >
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
                      onClick={() => removeChild(idx)}
                      data-testid={`remove-child-${idx}`}
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
                          onChange={(v) => handleChildChange(idx, field.id, v)}
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

            {/* Add another child */}
            <Button
              type="button"
              variant="outline"
              className="w-full border-dashed h-12 text-base font-medium"
              onClick={addChild}
              data-testid="button-add-child"
            >
              <Plus className="w-4 h-4 mr-2" />
              {isChildCheckin ? "Add Another Child" : "Add Another Person"}
            </Button>

            {submitError && (
              <p className="text-center text-destructive text-sm">{submitError}</p>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full h-14 text-lg font-bold"
              disabled={isSubmitting}
              data-testid="button-submit-registration"
            >
              {isSubmitting
                ? "Submitting..."
                : childrenAnswers.length > 1
                  ? `Register ${childrenAnswers.length} ${isChildCheckin ? "Children" : "People"}`
                  : "Complete Registration"}
            </Button>

            <p className="text-center text-xs text-muted-foreground pb-4">
              Fields marked with <span className="text-destructive">*</span> are required.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
