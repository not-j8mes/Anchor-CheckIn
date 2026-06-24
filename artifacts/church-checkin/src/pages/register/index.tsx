import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import {
  useSubmitRegistration,
  useListRooms,
  getGetFormBySlugQueryKey,
  getListRoomsQueryKey,
  getFormBySlug,
  type FormField,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, CheckCircle2, Plus } from "lucide-react";
import {
  type FieldSection,
  RegistrationFormBody,
  getFieldSection,
  isSecondaryGuardianField,
} from "@/components/registration/RegistrationFormBody";
import { DEFAULT_APP_LOGO } from "@/lib/branding";

export default function PublicRegistrationForm() {
  const params = useParams<{ embedSlug: string }>();
  const slug = params.embedSlug;
  const formRef = useRef<HTMLFormElement>(null);

  const { data: form, isLoading: formLoading } = useQuery({
    queryKey: getGetFormBySlugQueryKey(slug),
    queryFn: () => getFormBySlug(slug),
    enabled: !!slug,
    retry: false,
  });

  const [guardianAnswers, setGuardianAnswers] = useState<Record<number, string>>({});
  const [childrenAnswers, setChildrenAnswers] = useState<Record<number, string>[]>([{}]);
  const [emergencyAnswers, setEmergencyAnswers] = useState<Record<number, string>>({});
  const [additionalAnswers, setAdditionalAnswers] = useState<Record<number, string>>({});

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);

  const submitRegistration = useSubmitRegistration();

  const eventId = form?.eventId ?? 0;
  const { data: rooms = [] } = useListRooms(eventId, {
    query: {
      enabled: !!eventId,
      queryKey: getListRoomsQueryKey(eventId),
    },
  });

  const formFields: FormField[] = form?.formFields ?? [];
  const org = (form as typeof form & { organization?: { name?: string; logoUrl?: string | null } | null } | undefined)?.organization;
  const isChildCheckin = !form?.registrationType || form.registrationType === "child_checkin";
  const roomAssignmentFieldId = formFields.find((f) => f.systemKey === "room_assignment")?.id;
  const hasSecondaryGuardianFields = formFields.some(isSecondaryGuardianField);
  const allowSecondGuardian = form?.allowSecondGuardian ?? hasSecondaryGuardianFields;
  const showSectionStepper = !!form && isChildCheckin && !!form.showSectionsOneAtATime;
  const sectionMeta: Record<FieldSection, { title: string }> = {
    guardian_info: { title: "Parent / Guardian" },
    child_info: { title: isChildCheckin ? "Child Information" : "Attendee Information" },
    emergency_contact: { title: "Emergency Contact" },
    additional_questions: { title: "Additional Questions" },
    waivers: { title: "Waivers" },
  };
  const stepSections = ([
    "guardian_info",
    "child_info",
    "emergency_contact",
    "additional_questions",
    "waivers",
  ] as FieldSection[]).filter((section) =>
    formFields.some((field) => getFieldSection(field) === section),
  );
  const activeSection = stepSections[activeSectionIndex] ?? stepSections[0];
  const isLastSection = activeSectionIndex >= stepSections.length - 1;

  useEffect(() => {
    setActiveSectionIndex((index) => Math.min(index, Math.max(stepSections.length - 1, 0)));
  }, [stepSections.length]);

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

  const fieldHasValue = (field: FormField, value: string | undefined) => {
    if (!field.required && field.fieldType !== "waiver") return true;
    if (field.fieldType === "checkbox" || field.fieldType === "waiver") return value === "true";
    return !!value?.trim();
  };

  const shouldRequireField = (field: FormField) => {
    if (!isSecondaryGuardianField(field)) return true;
    if (!allowSecondGuardian) return false;
    return formFields
      .filter(isSecondaryGuardianField)
      .some((secondaryField) => !!guardianAnswers[secondaryField.id]?.trim());
  };

  const getFirstMissingSection = (): FieldSection | null => {
    for (const section of stepSections) {
      const fieldsInSection = formFields.filter((field) => getFieldSection(field) === section);
      if (section === "guardian_info") {
        if (
          fieldsInSection.some((field) =>
            shouldRequireField(field) && !fieldHasValue(field, guardianAnswers[field.id]),
          )
        ) return section;
      } else if (section === "child_info") {
        if (
          childrenAnswers.some((childAnswerMap) =>
            fieldsInSection.some((field) => !fieldHasValue(field, childAnswerMap[field.id])),
          )
        ) return section;
      } else if (section === "emergency_contact") {
        if (fieldsInSection.some((field) => !fieldHasValue(field, emergencyAnswers[field.id]))) return section;
      } else {
        if (fieldsInSection.some((field) => !fieldHasValue(field, additionalAnswers[field.id]))) return section;
      }
    }
    return null;
  };

  const handleNextSection = () => {
    if (!formRef.current?.reportValidity()) return;
    setSubmitError(null);
    setActiveSectionIndex((index) => Math.min(index + 1, stepSections.length - 1));
  };

  const handlePreviousSection = () => {
    setSubmitError(null);
    setActiveSectionIndex((index) => Math.max(index - 1, 0));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSubmitError(null);

    if (showSectionStepper) {
      const missingSection = getFirstMissingSection();
      if (missingSection) {
        const sectionIndex = stepSections.indexOf(missingSection);
        if (sectionIndex >= 0) setActiveSectionIndex(sectionIndex);
        setSubmitError("Please complete the required fields before submitting.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      for (const childAnswerMap of childrenAnswers) {
        const fields: { fieldId: number; value: string }[] = [];

        for (const f of formFields.filter((f) => getFieldSection(f) === "guardian_info")) {
          fields.push({ fieldId: f.id, value: guardianAnswers[f.id] ?? "" });
        }
        for (const f of formFields.filter((f) => getFieldSection(f) === "child_info")) {
          fields.push({ fieldId: f.id, value: childAnswerMap[f.id] ?? "" });
        }
        for (const f of formFields.filter((f) => getFieldSection(f) === "emergency_contact")) {
          fields.push({ fieldId: f.id, value: emergencyAnswers[f.id] ?? "" });
        }
        for (const f of formFields.filter((f) => ["additional_questions", "waivers"].includes(getFieldSection(f)))) {
          fields.push({ fieldId: f.id, value: additionalAnswers[f.id] ?? "" });
        }

        const selectedRoom = roomAssignmentFieldId
          ? (childAnswerMap[roomAssignmentFieldId] ?? "")
          : "";

        await submitRegistration.mutateAsync({
          formId: form.id,
          data: { fields, ...(selectedRoom ? { room: selectedRoom } : {}) },
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
    setGuardianAnswers({});
    setChildrenAnswers([{}]);
    setEmergencyAnswers({});
    setAdditionalAnswers({});
    setSubmitError(null);
    setActiveSectionIndex(0);
  };

  return (
    <div className="flex-1 min-h-screen bg-muted/20 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Org header */}
        <div className="text-center space-y-3 mb-8">
          {org?.logoUrl ? (
            <img src={org.logoUrl} alt={org.name} className="h-20 mx-auto object-contain" />
          ) : (
            <img src={DEFAULT_APP_LOGO} alt="Anchor Events logo" className="h-20 w-20 mx-auto object-contain" />
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
            ref={formRef}
            onSubmit={handleSubmit}
            className="space-y-6"
            data-testid="registration-form"
          >
            <div className="text-center pb-2">
              <h2 className="text-2xl font-serif font-bold text-foreground">{form.title}</h2>
            </div>

            {showSectionStepper && stepSections.length > 1 && (
              <div className="rounded-lg border bg-background px-4 py-3 shadow-sm">
                <div className="mb-3 flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">
                    {sectionMeta[activeSection].title}
                  </span>
                  <span className="text-muted-foreground">
                    Step {activeSectionIndex + 1} of {stepSections.length}
                  </span>
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${stepSections.length}, minmax(0, 1fr))` }}>
                  {stepSections.map((section, index) => (
                    <div
                      key={section}
                      className={`h-2 rounded-full transition-colors ${
                        index <= activeSectionIndex ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            <RegistrationFormBody
              formFields={formFields}
              rooms={rooms}
              isChildCheckin={isChildCheckin}
              allowAdditionalPeople={form.allowAdditionalPeople}
              allowSecondGuardian={allowSecondGuardian}
              guardianAnswers={guardianAnswers}
              childrenAnswers={childrenAnswers}
              emergencyAnswers={emergencyAnswers}
              additionalAnswers={additionalAnswers}
              onGuardianChange={(fieldId, value) =>
                setGuardianAnswers((prev) => ({ ...prev, [fieldId]: value }))
              }
              onChildChange={(childIndex, fieldId, value) =>
                setChildrenAnswers((prev) => {
                  const next = [...prev];
                  next[childIndex] = { ...next[childIndex], [fieldId]: value };
                  return next;
                })
              }
              onEmergencyChange={(fieldId, value) =>
                setEmergencyAnswers((prev) => ({ ...prev, [fieldId]: value }))
              }
              onAdditionalChange={(fieldId, value) =>
                setAdditionalAnswers((prev) => ({ ...prev, [fieldId]: value }))
              }
              onAddChild={() => setChildrenAnswers((prev) => [...prev, {}])}
              onRemoveChild={(index) =>
                setChildrenAnswers((prev) => prev.filter((_, i) => i !== index))
              }
              visibleSections={showSectionStepper && activeSection ? [activeSection] : undefined}
            />

            {submitError && (
              <p className="text-center text-destructive text-sm">{submitError}</p>
            )}

            {showSectionStepper && stepSections.length > 1 ? (
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  className="h-12 flex-1"
                  onClick={handlePreviousSection}
                  disabled={activeSectionIndex === 0 || isSubmitting}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                {isLastSection ? (
                  <Button
                    type="submit"
                    size="lg"
                    className="h-12 flex-1 font-bold"
                    disabled={isSubmitting}
                    data-testid="button-submit-registration"
                  >
                    {isSubmitting ? "Submitting..." : "Complete Registration"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="lg"
                    className="h-12 flex-1 font-bold"
                    onClick={handleNextSection}
                  >
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
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
            )}

            <p className="text-center text-xs text-muted-foreground pb-4">
              Fields marked with <span className="text-destructive">*</span> are required.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
