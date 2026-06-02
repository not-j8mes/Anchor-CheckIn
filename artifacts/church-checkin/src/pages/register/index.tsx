import { useState } from "react";
import { useParams } from "wouter";
import {
  useGetOrganization,
  useSubmitRegistration,
  getGetFormBySlugQueryKey,
  getFormBySlug,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Plus, Trash2, User, Users } from "lucide-react";

type ChildData = Record<number, string>;

function QuestionField({
  q,
  value,
  onChange,
}: {
  q: { id: number; label: string; type: string; required: boolean; placeholder?: string | null; options?: string | null };
  value: string;
  onChange: (v: string) => void;
}) {
  if (q.type === "textarea") {
    return (
      <Textarea
        required={q.required}
        placeholder={q.placeholder || ""}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="resize-y"
        rows={3}
      />
    );
  }
  if (q.type === "select" && q.options) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={q.placeholder || "Select an option"} />
        </SelectTrigger>
        <SelectContent>
          {q.options.split(",").map((opt) => (
            <SelectItem key={opt.trim()} value={opt.trim()}>
              {opt.trim()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (q.type === "checkbox") {
    return (
      <div className="flex items-center space-x-2 mt-2">
        <Checkbox
          id={`q-${q.id}`}
          checked={value === "true"}
          onCheckedChange={(c) => onChange(c ? "true" : "")}
        />
        <Label htmlFor={`q-${q.id}`} className="text-sm font-normal text-muted-foreground cursor-pointer">
          {q.placeholder || "Yes, I agree"}
        </Label>
      </div>
    );
  }
  return (
    <Input
      type={
        q.type === "date" ? "date" :
        q.type === "email" ? "email" :
        q.type === "number" ? "number" :
        q.type === "phone" ? "tel" :
        "text"
      }
      required={q.required}
      placeholder={q.placeholder || ""}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 text-base"
    />
  );
}

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

  // Parent/guardian answers — keyed by questionId
  const [parentData, setParentData] = useState<ChildData>({});

  // Each child has its own answer map
  const [children, setChildren] = useState<ChildData[]>([{}]);

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
        <p className="text-muted-foreground">This registration form is currently closed or does not exist.</p>
      </div>
    );
  }

  // Split questions: child-specific vs parent/family
  const childQuestions = form.questions.filter((q) => q.isChildField);
  const parentQuestions = form.questions.filter((q) => !q.isChildField);

  const handleParentChange = (qId: number, value: string) => {
    setParentData((prev) => ({ ...prev, [qId]: value }));
  };

  const handleChildChange = (childIndex: number, qId: number, value: string) => {
    setChildren((prev) => {
      const next = [...prev];
      next[childIndex] = { ...next[childIndex], [qId]: value };
      return next;
    });
  };

  const addChild = () => setChildren((prev) => [...prev, {}]);

  const removeChild = (index: number) => {
    setChildren((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSubmitError(null);
    setIsSubmitting(true);

    const findParentValue = (key: string) => {
      const q = parentQuestions.find((q) => q.fieldKey === key);
      return q ? parentData[q.id] ?? "" : "";
    };

    try {
      for (const childAnswers of children) {
        const findChildValue = (key: string) => {
          const q = childQuestions.find((q) => q.fieldKey === key);
          return q ? childAnswers[q.id] ?? "" : "";
        };

        const answers = [
          ...parentQuestions.map((q) => ({ questionId: q.id, value: parentData[q.id] ?? "" })),
          ...childQuestions.map((q) => ({ questionId: q.id, value: childAnswers[q.id] ?? "" })),
        ];

        await submitRegistration.mutateAsync({
          formId: form.id,
          data: {
            childFirstName: findChildValue("childFirstName"),
            childLastName: findChildValue("childLastName"),
            childDateOfBirth: findChildValue("childDateOfBirth") || undefined,
            guardianName: findParentValue("guardianName"),
            guardianPhone: findParentValue("guardianPhone"),
            guardianEmail: findParentValue("guardianEmail") || undefined,
            allergies: findChildValue("allergies") || findParentValue("allergies") || undefined,
            specialNeeds: findChildValue("specialNeeds") || findParentValue("specialNeeds") || undefined,
            answers,
          },
        });
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
    setParentData({});
    setChildren([{}]);
    setSubmitError(null);
  };

  return (
    <div className="flex-1 min-h-screen bg-muted/20 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Organization Header */}
        <div className="text-center space-y-3 mb-8">
          {org?.logoUrl ? (
            <img src={org.logoUrl} alt={org.name} className="h-20 mx-auto object-contain" />
          ) : (
            <div className="w-20 h-20 mx-auto bg-primary text-primary-foreground rounded-full flex items-center justify-center font-serif text-3xl font-bold">
              {org?.name?.charAt(0) || "C"}
            </div>
          )}
          <h1 className="text-3xl font-serif font-bold text-foreground">{org?.name}</h1>
          {org?.headerText && (
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">{org.headerText}</p>
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
                {children.length > 1
                  ? `Thank you! ${children.length} children have been registered successfully.`
                  : "Thank you for registering. We look forward to seeing you!"}
              </p>
              <Button
                size="lg"
                variant="outline"
                className="mt-4 gap-2 h-12 text-base"
                onClick={handleReset}
              >
                <Plus className="w-4 h-4" />
                Register Another Child
              </Button>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6" data-testid="registration-form">

            {/* Form Title */}
            <div className="text-center pb-2">
              <h2 className="text-2xl font-serif font-bold text-foreground">{form.title}</h2>
              {form.description && (
                <p className="text-muted-foreground mt-2">{form.description}</p>
              )}
            </div>

            {/* Parent / Guardian Information */}
            {parentQuestions.length > 0 && (
              <Card className="shadow-sm overflow-hidden">
                <div className="bg-primary px-6 py-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-primary-foreground" />
                  <h3 className="text-lg font-semibold text-primary-foreground">Parent / Guardian Information</h3>
                </div>
                <CardContent className="p-6 space-y-5">
                  {parentQuestions.map((q) => (
                    <div key={q.id} className="space-y-1.5">
                      <Label className="text-sm font-medium flex items-center gap-1">
                        {q.label}
                        {q.required && <span className="text-destructive">*</span>}
                      </Label>
                      <QuestionField
                        q={q}
                        value={parentData[q.id] ?? ""}
                        onChange={(v) => handleParentChange(q.id, v)}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Children Sections */}
            {children.map((childAnswers, idx) => (
              <Card key={idx} className="shadow-sm overflow-hidden" data-testid={`child-section-${idx}`}>
                <div className="bg-secondary px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-secondary-foreground" />
                    <h3 className="text-lg font-semibold text-secondary-foreground">
                      {children.length > 1 ? `Child ${idx + 1}` : "Child Information"}
                    </h3>
                  </div>
                  {children.length > 1 && (
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
                  {childQuestions.length > 0 ? (
                    childQuestions.map((q) => (
                      <div key={q.id} className="space-y-1.5">
                        <Label className="text-sm font-medium flex items-center gap-1">
                          {q.label}
                          {q.required && <span className="text-destructive">*</span>}
                        </Label>
                        <QuestionField
                          q={q}
                          value={childAnswers[q.id] ?? ""}
                          onChange={(v) => handleChildChange(idx, q.id, v)}
                        />
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No child-specific questions configured.</p>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Add Another Child */}
            <Button
              type="button"
              variant="outline"
              className="w-full border-dashed h-12 text-base font-medium"
              onClick={addChild}
              data-testid="button-add-child"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Another Child
            </Button>

            {/* Submit Error */}
            {submitError && (
              <p className="text-center text-destructive text-sm">{submitError}</p>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              className="w-full h-14 text-lg font-bold"
              disabled={isSubmitting}
              data-testid="button-submit-registration"
            >
              {isSubmitting
                ? "Submitting..."
                : children.length > 1
                ? `Register ${children.length} Children`
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
