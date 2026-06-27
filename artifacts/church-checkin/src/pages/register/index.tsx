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
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Plus } from "lucide-react";
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
  const hideOrgLogo = form?.hideOrgLogo ?? false;
  const hideOrgName = form?.hideOrgName ?? false;
  const isChildCheckin = !form?.registrationType || form.registrationType === "child_checkin";
  const roomAssignmentFieldId = formFields.find((f) => f.systemKey === "room_assignment")?.id;
  const hasSecondaryGuardianFields = formFields.some(isSecondaryGuardianField);
  const allowSecondGuardian = form?.allowSecondGuardian ?? hasSecondaryGuardianFields;
  const showSectionStepper = !!form && isChildCheckin && !!form.showSectionsOneAtATime;
  const sectionMeta: Record<FieldSection, { title: string; shortTitle: string }> = {
    guardian_info: { title: "Parent / Guardian", shortTitle: "Parent / Guardian" },
    child_info: {
      title: isChildCheckin ? "Child Information" : "Attendee Information",
      shortTitle: isChildCheckin ? "Child Info" : "Attendee Info",
    },
    emergency_contact: { title: "Emergency Contact", shortTitle: "Emergency Contact" },
    additional_questions: { title: "Additional Questions", shortTitle: "Additional Questions" },
    waivers: { title: "Waivers", shortTitle: "Waivers" },
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

  const getChildParticipantName = (childAnswerMap: Record<number, string>) => {
    const firstNameField = formFields.find((field) =>
      field.systemKey === "child_first_name" || field.systemKey === "participant_first_name",
    );
    const lastNameField = formFields.find((field) =>
      field.systemKey === "child_last_name" || field.systemKey === "participant_last_name",
    );
    const firstName = firstNameField ? childAnswerMap[firstNameField.id]?.trim() : "";
    const lastName = lastNameField ? childAnswerMap[lastNameField.id]?.trim() : "";
    return [firstName, lastName].filter(Boolean).join(" ");
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
      const confirmationParticipantNames = childrenAnswers
        .map(getChildParticipantName)
        .filter(Boolean);

      for (const [index, childAnswerMap] of childrenAnswers.entries()) {
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
          data: {
            fields,
            ...(selectedRoom ? { room: selectedRoom } : {}),
            suppressConfirmationEmail: index < childrenAnswers.length - 1,
            ...(index === childrenAnswers.length - 1 && confirmationParticipantNames.length > 0
              ? { confirmationParticipantNames }
              : {}),
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
    setGuardianAnswers({});
    setChildrenAnswers([{}]);
    setEmergencyAnswers({});
    setAdditionalAnswers({});
    setSubmitError(null);
    setActiveSectionIndex(0);
  };

  return (
    <div className="flex-1 min-h-screen overflow-x-hidden bg-[#fbfaf7] px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto w-full max-w-3xl min-w-0 space-y-6">
        {/* Org header */}
        <div className="text-center">
          {!hideOrgLogo && (
            org?.logoUrl ? (
              <img src={org.logoUrl} alt={org.name} className="mx-auto h-16 object-contain sm:h-20" />
            ) : (
              <img src={DEFAULT_APP_LOGO} alt="Anchor Events logo" className="mx-auto h-16 w-16 object-contain sm:h-20 sm:w-20" />
            )
          )}
          {!hideOrgName && org?.name && (
            <h1 className="mx-auto mt-3 max-w-[calc(100vw-2rem)] break-words text-2xl font-serif font-bold text-foreground sm:text-3xl">{org.name}</h1>
          )}
          {form.description && (
            <p className="mx-auto mt-2 max-w-[calc(100vw-2rem)] break-words text-sm leading-6 text-muted-foreground sm:max-w-xl sm:text-base">{form.description}</p>
          )}
        </div>

        {isSubmitted ? (
          <Card className="overflow-hidden rounded-2xl border-card-border bg-white py-14 text-center shadow-[0_24px_70px_rgba(15,23,42,0.10)]">
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
                className="mt-4 h-12 gap-2 rounded-lg border-border bg-white px-6 text-base shadow-sm"
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
            className="min-w-0 space-y-5"
            data-testid="registration-form"
          >
            <div className="text-center">
              <h2 className="mx-auto max-w-[calc(100vw-2rem)] break-words text-xl font-serif font-bold text-foreground sm:text-2xl">{form.title}</h2>
            </div>

            {showSectionStepper && stepSections.length > 1 && (
              <div className="min-w-0 overflow-x-auto rounded-2xl border border-card-border bg-white px-3 py-4 shadow-[0_12px_36px_rgba(15,23,42,0.07)] sm:px-5">
                <div className="grid min-w-[520px] items-start sm:min-w-0" style={{ gridTemplateColumns: `repeat(${stepSections.length}, minmax(0, 1fr))` }}>
                  {stepSections.map((section, index) => {
                    const isComplete = index < activeSectionIndex;
                    const isCurrent = index === activeSectionIndex;
                    return (
                      <div key={section} className="relative flex min-w-0 flex-col items-center gap-2 text-center">
                        {index > 0 && (
                          <span
                            className={`absolute left-0 top-4 h-px w-1/2 -translate-x-1/2 ${
                              index <= activeSectionIndex ? "bg-primary" : "bg-border"
                            }`}
                          />
                        )}
                        {index < stepSections.length - 1 && (
                          <span
                            className={`absolute right-0 top-4 h-px w-1/2 translate-x-1/2 ${
                              index < activeSectionIndex ? "bg-primary" : "bg-border"
                            }`}
                          />
                        )}
                        <span
                          className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                            isComplete
                              ? "border-muted bg-muted text-muted-foreground"
                              : isCurrent
                                ? "border-primary bg-primary text-primary-foreground shadow-[0_8px_20px_rgba(245,158,11,0.30)]"
                                : "border-border bg-muted/50 text-muted-foreground"
                          }`}
                        >
                          {isComplete ? <Check className="h-4 w-4" /> : index + 1}
                        </span>
                        <span
                          className={`line-clamp-2 px-0.5 text-[10px] font-semibold leading-tight sm:text-xs ${
                            isCurrent ? "text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {sectionMeta[section].shortTitle}
                        </span>
                      </div>
                    );
                  })}
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
              <div className="grid min-w-0 gap-3 rounded-2xl border border-card-border bg-white p-3 shadow-[0_12px_36px_rgba(15,23,42,0.06)] sm:grid-cols-2">
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-lg border-border bg-white font-semibold shadow-sm"
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
                    className="h-12 rounded-lg bg-primary font-bold text-primary-foreground shadow-[0_12px_24px_rgba(245,158,11,0.28)] hover:bg-primary/90"
                    disabled={isSubmitting}
                    data-testid="button-submit-registration"
                  >
                    {isSubmitting ? "Submitting..." : "Complete Registration"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="lg"
                    className="h-12 rounded-lg bg-primary font-bold text-primary-foreground shadow-[0_12px_24px_rgba(245,158,11,0.28)] hover:bg-primary/90"
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
                className="h-14 w-full rounded-lg bg-primary text-lg font-bold text-primary-foreground shadow-[0_12px_24px_rgba(245,158,11,0.28)] hover:bg-primary/90"
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
