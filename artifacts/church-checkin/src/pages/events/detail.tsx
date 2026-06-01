import { Link, useParams } from "wouter";
import {
  useGetEvent,
  useListRegistrations,
  getGetEventQueryKey,
  getListRegistrationsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Calendar,
  Users,
  CheckSquare,
  ClipboardList,
  ExternalLink,
  Copy,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const EVENT_TYPES: Record<string, string> = {
  vbs: "Vacation Bible School (VBS)",
  awana: "AWANA",
  sunday_school: "Sunday School",
  youth_group: "Youth Group",
  camp: "Camp",
  special_event: "Special Event",
  general: "General / Other",
};

function statusBadge(status: string) {
  if (status === "active") return <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>;
  if (status === "upcoming") return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Upcoming</Badge>;
  if (status === "completed") return <Badge variant="secondary">Completed</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export default function EventDetail() {
  const params = useParams<{ id: string }>();
  const eventId = parseInt(params.id || "0", 10);
  const { toast } = useToast();

  const { data: event, isLoading } = useGetEvent(eventId, {
    query: { enabled: !!eventId, queryKey: getGetEventQueryKey(eventId) },
  });
  const regFormId = event?.formId ?? 0;
  const { data: registrations, isLoading: regsLoading } = useListRegistrations(
    regFormId,
    { query: { enabled: !!event?.formId, queryKey: getListRegistrationsQueryKey(regFormId) } }
  );

  const copyEmbedCode = () => {
    if (!event?.formEmbedSlug) return;
    const url = `${window.location.origin}/register/${event.formEmbedSlug}`;
    const code = `<iframe src="${url}" width="100%" height="800" frameborder="0" style="border:none;"></iframe>`;
    navigator.clipboard.writeText(code);
    toast({ title: "Embed code copied!" });
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-10 max-w-5xl mx-auto w-full">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-48 bg-muted/50 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-10 text-center">
        <p className="text-muted-foreground">Event not found.</p>
        <Button asChild variant="link" className="mt-2">
          <Link href="/events">Back to Events</Link>
        </Button>
      </div>
    );
  }

  const registrationUrl = event.formEmbedSlug
    ? `${window.location.origin}/register/${event.formEmbedSlug}`
    : null;

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto w-full space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/events"><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-serif font-bold truncate">{event.name}</h1>
            {statusBadge(event.status)}
          </div>
          <p className="text-muted-foreground mt-1">
            {EVENT_TYPES[event.eventType] ?? event.eventType}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{event.registrationCount}</p>
              <p className="text-sm text-muted-foreground">Registered</p>
            </div>
          </CardContent>
        </Card>
        {event.startDate && (
          <Card>
            <CardContent className="p-5 flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-base font-semibold">
                  {format(new Date(event.startDate + "T00:00:00"), "MMM d, yyyy")}
                </p>
                <p className="text-sm text-muted-foreground">Start Date</p>
              </div>
            </CardContent>
          </Card>
        )}
        {event.endDate && (
          <Card>
            <CardContent className="p-5 flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-base font-semibold">
                  {format(new Date(event.endDate + "T00:00:00"), "MMM d, yyyy")}
                </p>
                <p className="text-sm text-muted-foreground">End Date</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Registrations table */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" /> Registrations
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {regsLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading...</div>
              ) : !registrations?.length ? (
                <div className="p-10 text-center text-muted-foreground">
                  <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No registrations yet.</p>
                  {registrationUrl && (
                    <p className="text-sm mt-1">
                      Share the{" "}
                      <a href={registrationUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                        registration form
                      </a>{" "}
                      to get started.
                    </p>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {registrations.map((reg) => (
                    <div key={reg.id} className="px-5 py-3 flex items-center justify-between gap-4" data-testid={`reg-row-${reg.id}`}>
                      <div>
                        <p className="font-medium">{reg.childFirstName} {reg.childLastName}</p>
                        <p className="text-sm text-muted-foreground">{reg.guardianName} · {reg.guardianPhone}</p>
                      </div>
                      <div className="text-right text-sm text-muted-foreground flex-shrink-0">
                        {reg.room && <p className="font-medium text-foreground">{reg.room}</p>}
                        {format(new Date(reg.createdAt), "MMM d")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar info */}
        <div className="space-y-4">
          {/* Registration form links */}
          {event.formId && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Registration Form</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm font-medium">{event.formTitle}</p>
                {registrationUrl && (
                  <>
                    <a
                      href={registrationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Open public form
                    </a>
                    <Button variant="outline" size="sm" className="w-full" onClick={copyEmbedCode}>
                      <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy embed code
                    </Button>
                  </>
                )}
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href={`/forms/${event.formId}/builder`}>
                    <CheckSquare className="w-3.5 h-3.5 mr-1.5" /> Edit form questions
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Description */}
          {event.description && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">About this Event</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{event.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Check-in link */}
          <Button asChild className="w-full">
            <Link href="/checkin">
              <CheckSquare className="w-4 h-4 mr-2" /> Go to Check-In Kiosk
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
