import { Link, useParams } from "wouter";
import { useState } from "react";
import {
  useGetEvent,
  useListRegistrations,
  useListEventCheckins,
  useCheckoutChild,
  useDeleteCheckin,
  useUndoCheckout,
  getGetEventQueryKey,
  getListRegistrationsQueryKey,
  getListEventCheckinsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Calendar,
  Users,
  CheckSquare,
  ClipboardList,
  ExternalLink,
  Copy,
  LogIn,
  LogOut,
  Loader2,
  Undo2,
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
  const queryClient = useQueryClient();
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const invalidateCheckins = () =>
    queryClient.invalidateQueries({ queryKey: getListEventCheckinsQueryKey(eventId) });

  const { data: event, isLoading } = useGetEvent(eventId, {
    query: { enabled: !!eventId, queryKey: getGetEventQueryKey(eventId) },
  });
  const regFormId = event?.formId ?? 0;
  const { data: registrations, isLoading: regsLoading } = useListRegistrations(regFormId, {
    query: { enabled: !!event?.formId, queryKey: getListRegistrationsQueryKey(regFormId) },
  });
  const { data: checkins, isLoading: checkinsLoading } = useListEventCheckins(eventId, {
    query: { enabled: !!eventId, queryKey: getListEventCheckinsQueryKey(eventId) },
  });

  const checkoutChild = useCheckoutChild({
    mutation: {
      onSuccess: () => { invalidateCheckins(); toast({ title: "Child checked out" }); setLoadingId(null); },
      onError: () => { toast({ title: "Check-out failed", variant: "destructive" }); setLoadingId(null); },
    },
  });
  const deleteCheckin = useDeleteCheckin({
    mutation: {
      onSuccess: () => { invalidateCheckins(); toast({ title: "Check-in removed" }); setLoadingId(null); },
      onError: () => { toast({ title: "Could not undo check-in", variant: "destructive" }); setLoadingId(null); },
    },
  });
  const undoCheckout = useUndoCheckout({
    mutation: {
      onSuccess: () => { invalidateCheckins(); toast({ title: "Check-out reversed — child is checked in again" }); setLoadingId(null); },
      onError: () => { toast({ title: "Could not undo check-out", variant: "destructive" }); setLoadingId(null); },
    },
  });

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
        <Button asChild variant="link" className="mt-2"><Link href="/events">Back to Events</Link></Button>
      </div>
    );
  }

  const registrationUrl = event.formEmbedSlug
    ? `${window.location.origin}/register/${event.formEmbedSlug}`
    : null;

  const checkedIn = checkins?.filter((c) => !c.checkoutAt) ?? [];
  const checkedOut = checkins?.filter((c) => !!c.checkoutAt) ?? [];

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
          <p className="text-muted-foreground mt-1">{EVENT_TYPES[event.eventType] ?? event.eventType}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <LogIn className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <p className="text-2xl font-bold">{checkedIn.length}</p>
              <p className="text-sm text-muted-foreground">Checked In</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <LogOut className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <p className="text-2xl font-bold">{checkedOut.length}</p>
              <p className="text-sm text-muted-foreground">Checked Out</p>
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
                <p className="text-base font-semibold">{format(new Date(event.startDate + "T00:00:00"), "MMM d")}</p>
                <p className="text-sm text-muted-foreground">Starts</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Tabs */}
        <div className="md:col-span-2">
          <Tabs defaultValue="registrations">
            <TabsList className="w-full grid grid-cols-3 mb-4">
              <TabsTrigger value="registrations" className="gap-1.5">
                <ClipboardList className="w-4 h-4" />
                Registrations
                <Badge variant="secondary" className="text-xs ml-1">{registrations?.length ?? 0}</Badge>
              </TabsTrigger>
              <TabsTrigger value="checked-in" className="gap-1.5">
                <LogIn className="w-4 h-4" />
                Checked In
                <Badge variant="secondary" className="text-xs ml-1">{checkedIn.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="checked-out" className="gap-1.5">
                <LogOut className="w-4 h-4" />
                Checked Out
                <Badge variant="secondary" className="text-xs ml-1">{checkedOut.length}</Badge>
              </TabsTrigger>
            </TabsList>

            {/* ── Registrations ── */}
            <TabsContent value="registrations">
              <Card>
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
                        <div key={reg.id} className="px-5 py-3 flex items-center justify-between gap-4">
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
            </TabsContent>

            {/* ── Checked In ── */}
            <TabsContent value="checked-in">
              <Card>
                <CardContent className="p-0">
                  {checkinsLoading ? (
                    <div className="p-8 text-center text-muted-foreground">Loading...</div>
                  ) : !checkedIn.length ? (
                    <div className="p-10 text-center text-muted-foreground">
                      <LogIn className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p>No one is checked in yet.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {checkedIn.map((c) => (
                        <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-4">
                          <div>
                            <p className="font-medium">{c.childFirstName} {c.childLastName}</p>
                            <p className="text-sm text-muted-foreground">{c.guardianName}{c.room ? ` · ${c.room}` : ""}</p>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="text-right">
                              <p className="font-mono font-bold text-sm text-green-700 bg-green-50 px-2 py-0.5 rounded">{c.labelCode}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(c.checkinAt), "h:mm a")}</p>
                            </div>
                            <div className="flex flex-col gap-1 items-end">
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-muted-foreground hover:text-destructive hover:border-destructive gap-1"
                                disabled={loadingId === c.id}
                                onClick={() => { setLoadingId(c.id); checkoutChild.mutate({ checkinId: c.id }); }}
                              >
                                {loadingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                                Check Out
                              </Button>
                              <button
                                type="button"
                                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                                onClick={() => { setLoadingId(c.id); deleteCheckin.mutate({ checkinId: c.id }); }}
                              >
                                <Undo2 className="w-3 h-3" /> Undo check-in
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Checked Out ── */}
            <TabsContent value="checked-out">
              <Card>
                <CardContent className="p-0">
                  {checkinsLoading ? (
                    <div className="p-8 text-center text-muted-foreground">Loading...</div>
                  ) : !checkedOut.length ? (
                    <div className="p-10 text-center text-muted-foreground">
                      <LogOut className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p>No check-outs recorded yet.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {checkedOut.map((c) => (
                        <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-4">
                          <div>
                            <p className="font-medium">{c.childFirstName} {c.childLastName}</p>
                            <p className="text-sm text-muted-foreground">{c.guardianName}{c.room ? ` · ${c.room}` : ""}</p>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="text-right">
                              <p className="font-mono text-xs text-muted-foreground">{c.labelCode}</p>
                              <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                                <p>In: {format(new Date(c.checkinAt), "h:mm a")}</p>
                                {c.checkoutAt && (
                                  <p className="text-amber-700 font-medium">Out: {format(new Date(c.checkoutAt), "h:mm a")}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1 items-end">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 text-muted-foreground hover:text-primary hover:border-primary"
                                disabled={loadingId === c.id}
                                onClick={() => { setLoadingId(c.id); undoCheckout.mutate({ checkinId: c.id }); }}
                              >
                                {loadingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
                                Undo Checkout
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
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
