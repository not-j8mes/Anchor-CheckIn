import { useState } from "react";
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
import { CheckCircle2, Plus } from "lucide-react";
import {
  RegistrationFormBody,
  getFieldSection,
} from "@/components/registration/RegistrationFormBody";
import { DEFAULT_APP_LOGO } from "@/lib/branding";

export default function PublicRegistrationForm() {
  const params = useParams<{ embedSlug: string }>();
  const slug = params.embedSlug;

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

  const submitRegistration = useSubmitRegistration();

  const eventId = form?.eventId ?? 0;
  const { data: rooms = [] } = useListRooms(eventId, {
    query: {
      enabled: !!eventId,
      queryKey: getListRoomsQueryKey(eventId),
    },
  });

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

  const formFields: FormField[] = form.formFields ?? [];
  const org = (form as typeof form & { organization?: { name?: string; logoUrl?: string | null } | null }).organization;
  const isChildCheckin = !form.registrationType || form.registrationType === "child_checkin";
  const roomAssignmentFieldId = formFields.find((f) => f.systemKey === "room_assignment")?.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSubmitError(null);
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
  };

  return (
    <div className="flex-1 min-h-screen bg-muted/20 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Org header */}
        <div className="text-center space-y-3 mb-8">
          {org?.logoUrl ? (
            <img src={org.logoUrl} alt={org.name} className="h-20 mx-auto object-contain" />
          ) : (
            <img src={DEFAULT_APP_LOGO} alt="Anchor Check-In logo" className="h-20 w-20 mx-auto object-contain" />
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
            <div className="text-center pb-2">
              <h2 className="text-2xl font-serif font-bold text-foreground">{form.title}</h2>
            </div>

            <RegistrationFormBody
              formFields={formFields}
              rooms={rooms}
              isChildCheckin={isChildCheckin}
              allowAdditionalPeople={form.allowAdditionalPeople}
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
            />

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
