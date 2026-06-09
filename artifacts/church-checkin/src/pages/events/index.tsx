import { useState } from "react";
import { Link } from "wouter";
import {
  useListEvents,
  useDeleteEvent,
  useUpdateEvent,
  getListEventsQueryKey,
  getGetEventQueryKey,
  type Event as ChurchEvent,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Calendar,
  Users,
  ArrowRight,
  Trash2,
  Pencil,
  ChevronRight,
  ChevronLeft,
  Search,
  Church,
  FileText,
  Settings,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
} from "date-fns";

const EVENT_TYPES = [
  { value: "vbs", label: "Vacation Bible School (VBS)" },
  { value: "awana", label: "AWANA" },
  { value: "sunday_school", label: "Sunday School" },
  { value: "youth_group", label: "Youth Group" },
  { value: "camp", label: "Camp" },
  { value: "special_event", label: "Special Event" },
  { value: "general", label: "General / Other" },
];

function statusBadge(status: string) {
  if (status === "active") return <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>;
  if (status === "upcoming") return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Upcoming</Badge>;
  if (status === "completed") return <Badge variant="secondary">Completed</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function registrationTypeBadge(type?: string | null) {
  if (!type) return null;
  if (type === "child_checkin") return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Child Check-In</Badge>;
  if (type === "family_group") return <Badge className="bg-teal-100 text-teal-800 border-teal-200">Family / Group</Badge>;
  if (type === "individual") return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Individual</Badge>;
  return null;
}

function registrationTypeStripe(type?: string | null) {
  if (!type || type === "child_checkin") return "bg-purple-500";
  if (type === "family_group") return "bg-teal-500";
  if (type === "individual") return "bg-blue-500";
  return "bg-primary";
}

function eventTypeLabel(type: string) {
  return EVENT_TYPES.find((t) => t.value === type)?.label ?? type;
}

function eventChipClass(type: string) {
  if (type === "vbs") return "bg-yellow-100 text-yellow-800";
  if (type === "awana") return "bg-blue-100 text-blue-800";
  if (type === "sunday_school") return "bg-purple-100 text-purple-800";
  if (type === "youth_group") return "bg-green-100 text-green-800";
  if (type === "camp") return "bg-orange-100 text-orange-800";
  return "bg-primary/10 text-primary";
}

// ─── Edit Event Dialog ──────────────────────────────────────────────────────

interface EditEventDialogProps {
  event: {
    id: number;
    name: string;
    description?: string | null;
    eventType: string;
    registrationType?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    trackAttendance?: boolean | null;
    requireCheckout?: boolean | null;
    printLabels?: boolean | null;
    labelType?: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function EditEventDialog({ event, open, onOpenChange }: EditEventDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isChildCheckin = !event.registrationType || event.registrationType === "child_checkin";
  const [isMultiDay, setIsMultiDay] = useState(
    !!(event.startDate && event.endDate && event.startDate !== event.endDate)
  );
  const [form, setForm] = useState({
    name: event.name,
    description: event.description ?? "",
    eventType: event.eventType,
    startDate: event.startDate ?? "",
    endDate: event.endDate ?? "",
    trackAttendance: event.trackAttendance ?? isChildCheckin,
    requireCheckout: event.requireCheckout ?? isChildCheckin,
    printLabels: event.printLabels ?? isChildCheckin,
    labelType: event.labelType ?? (isChildCheckin ? "child_security" : "simple_name"),
  });

  const updateEvent = useUpdateEvent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetEventQueryKey(event.id) });
        toast({ title: "Event updated" });
        onOpenChange(false);
      },
      onError: () => toast({ title: "Failed to update event", variant: "destructive" }),
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Event</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Event Name</Label>
            <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Event Type</Label>
            <Select value={form.eventType} onValueChange={(v) => setForm((p) => ({ ...p, eventType: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="flex items-center justify-between py-1.5">
            <div>
              <span className="text-sm font-medium">Multi-day event</span>
              <p className="text-xs text-muted-foreground">Spans more than one day</p>
            </div>
            <Switch
              checked={isMultiDay}
              onCheckedChange={(v) => {
                setIsMultiDay(v);
                if (!v) setForm((p) => ({ ...p, endDate: "" }));
              }}
            />
          </div>
          {isMultiDay ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm((p) => ({ ...p, startDate: val, endDate: p.endDate && val > p.endDate ? "" : p.endDate }));
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  min={form.startDate || undefined}
                  onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} />
            </div>
          )}
          <div className="space-y-2 pt-1 border-t border-border">
            <Label className="text-sm font-medium">Attendance &amp; Check-In</Label>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-1.5">
                <div>
                  <span className="text-sm font-medium">Track attendance with check-ins</span>
                  <p className="text-xs text-muted-foreground">Show Check-In Desk and kiosk button</p>
                </div>
                <Switch
                  checked={form.trackAttendance}
                  onCheckedChange={(v) => setForm((p) => ({
                    ...p,
                    trackAttendance: v,
                    requireCheckout: v ? p.requireCheckout : false,
                    printLabels: v ? p.printLabels : false,
                  }))}
                />
              </div>

              {form.trackAttendance && isChildCheckin && (
                <div className="ml-3 flex items-center justify-between py-1.5">
                  <div>
                    <span className="text-sm font-medium">Require check-out</span>
                    <p className="text-xs text-muted-foreground">Track departures and security codes</p>
                  </div>
                  <Switch
                    checked={form.requireCheckout}
                    onCheckedChange={(v) => setForm((p) => ({ ...p, requireCheckout: v }))}
                  />
                </div>
              )}

              {form.trackAttendance && (
                <div className="ml-3 flex items-center justify-between py-1.5">
                  <div>
                    <span className="text-sm font-medium">Print name labels at check-in</span>
                    <p className="text-xs text-muted-foreground">Print a label per attendee</p>
                  </div>
                  <Switch
                    checked={form.printLabels}
                    onCheckedChange={(v) => setForm((p) => ({ ...p, printLabels: v }))}
                  />
                </div>
              )}

              {form.trackAttendance && form.printLabels && (
                <div className="ml-3 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Label type</Label>
                  <Select
                    value={form.labelType}
                    onValueChange={(v) => setForm((p) => ({ ...p, labelType: v }))}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simple_name">Simple name label</SelectItem>
                      <SelectItem value="child_security" disabled={!isChildCheckin}>
                        Child security label {!isChildCheckin ? "(kids events only)" : ""}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => updateEvent.mutate({ eventId: event.id, data: form })}
            disabled={updateEvent.isPending}
          >
            {updateEvent.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Event card ──────────────────────────────────────────────────────────────

function EventCard({ event, onEdit, onDelete }: {
  event: ChurchEvent;
  onEdit: (e: ChurchEvent) => void;
  onDelete: (id: number) => void;
}) {
  const trackAttendance = event.trackAttendance ?? (event.registrationType === "child_checkin" || !event.registrationType);
  const checkinBadge = trackAttendance
    ? <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px]">Check-In On</Badge>
    : <Badge variant="outline" className="text-[10px] text-muted-foreground">No Check-In</Badge>;

  const formBadge = event.formId
    ? <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px]">Form Ready</Badge>
    : <Badge variant="outline" className="text-[10px] text-muted-foreground">No Form</Badge>;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-all border" data-testid={`event-card-${event.id}`}>
      <CardContent className="p-0">
        <div className="flex items-stretch">
          <div className={`w-1.5 flex-shrink-0 ${registrationTypeStripe(event.registrationType)}`} />
          <div className="flex-1 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="text-lg font-serif font-bold truncate">{event.name}</h3>
                  {statusBadge(event.status)}
                  {registrationTypeBadge(event.registrationType)}
                </div>
                <p className="text-sm text-muted-foreground">
                  {eventTypeLabel(event.eventType)}
                  {event.startDate && (
                    <span className="ml-3">
                      {format(new Date(event.startDate + "T00:00:00"), "MMM d, yyyy")}
                      {event.endDate && event.startDate !== event.endDate && (
                        <> – {format(new Date(event.endDate + "T00:00:00"), "MMM d, yyyy")}</>
                      )}
                    </span>
                  )}
                </p>
                {event.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{event.description}</p>
                )}
                <div className="flex items-center flex-wrap gap-3 mt-2.5">
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Users className="w-3.5 h-3.5" />
                    <span className="font-medium text-foreground">{event.registrationCount}</span> registered
                  </span>
                  {checkinBadge}
                  {formBadge}
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-8 w-8"
                  onClick={() => onEdit(event)} data-testid={`button-edit-event-${event.id}`}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive h-8 w-8"
                  onClick={() => onDelete(event.id)} data-testid={`button-delete-event-${event.id}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-border">
              <Button asChild size="sm" className="w-full sm:w-auto">
                <Link href={`/events/${event.id}`}>
                  Open Event <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Calendar view ────────────────────────────────────────────────────────────

function CalendarView({ events }: { events: ChurchEvent[] }) {
  const [month, setMonth] = useState(() => new Date());

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 0 }),
  });

  const eventsByDate = new Map<string, ChurchEvent[]>();
  for (const event of events) {
    if (!event.startDate) continue;
    const start = new Date(event.startDate + "T00:00:00");
    const end = event.endDate ? new Date(event.endDate + "T00:00:00") : start;
    const span = eachDayOfInterval({ start, end });
    for (const d of span) {
      const key = format(d, "yyyy-MM-dd");
      const bucket = eventsByDate.get(key) ?? [];
      if (!bucket.find((e) => e.id === event.id)) bucket.push(event);
      eventsByDate.set(key, bucket);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="icon" onClick={() => setMonth((m) => subMonths(m, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="font-serif font-bold text-xl">{format(month, "MMMM yyyy")}</h2>
        <Button variant="outline" size="icon" onClick={() => setMonth((m) => addMonths(m, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 border-l border-t border-border rounded-lg overflow-hidden">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDate.get(key) ?? [];
          const inMonth = isSameMonth(day, month);
          const today = isToday(day);

          return (
            <div
              key={key}
              className={`border-r border-b border-border min-h-[88px] p-1.5 ${
                !inMonth ? "bg-muted/40" : "bg-card"
              }`}
            >
              <div className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                today
                  ? "bg-primary text-primary-foreground"
                  : inMonth
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}>
                {format(day, "d")}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((event) => (
                  <Link key={event.id} href={`/events/${event.id}`}>
                    <div className={`text-xs px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 transition-opacity font-medium ${eventChipClass(event.eventType)}`}>
                      {event.name}
                    </div>
                  </Link>
                ))}
                {dayEvents.length > 3 && (
                  <p className="text-xs text-muted-foreground px-1">+{dayEvents.length - 3} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isPast(event: ChurchEvent): boolean {
  if (event.status === "completed") return true;
  const refDate = event.endDate || event.startDate;
  if (!refDate) return false;
  const d = new Date(refDate + "T00:00:00");
  d.setHours(23, 59, 59, 999);
  return d < new Date();
}

// ─── Event Selection Screen ───────────────────────────────────────────────────

export default function EventSelectionScreen() {
  const { data: events, isLoading } = useListEvents();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editEvent, setEditEvent] = useState<ChurchEvent | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [showPast, setShowPast] = useState(false);
  const [search, setSearch] = useState("");

  const deleteEvent = useDeleteEvent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
        toast({ title: "Event deleted" });
        setDeleteId(null);
      },
      onError: () => toast({ title: "Failed to delete event", variant: "destructive" }),
    },
  });

  const sorted = [...(events ?? [])].sort((a, b) => {
    const aT = a.startDate ? new Date(a.startDate + "T00:00:00").getTime() : -Infinity;
    const bT = b.startDate ? new Date(b.startDate + "T00:00:00").getTime() : -Infinity;
    return bT - aT;
  });

  const filtered = search.trim()
    ? sorted.filter((e) =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        eventTypeLabel(e.eventType).toLowerCase().includes(search.toLowerCase())
      )
    : sorted;

  const pastCount = filtered.filter(isPast).length;
  const visible = viewMode === "list"
    ? filtered.filter((e) => showPast || !isPast(e))
    : filtered;

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-foreground">
            <Church className="w-5 h-5 text-primary" />
            <span className="font-serif font-bold text-base">Church Check-In</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/settings">
                <Settings className="w-4 h-4 mr-1.5" /> Settings
              </Link>
            </Button>
            <Button asChild size="sm" data-testid="button-create-event">
              <Link href="/events/new">
                <Plus className="w-4 h-4 mr-1.5" /> New Event
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {/* Hero header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-serif font-bold text-foreground">Select an Event</h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Choose an event to manage registrations, forms, check-in, and reports.
          </p>
        </div>

        {/* Search + view controls */}
        {(events?.length ?? 0) > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search events…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {/* View toggle */}
            <div className="flex items-center border border-border rounded-lg overflow-hidden shrink-0">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`px-3 py-2 flex items-center gap-1.5 text-sm transition-colors ${
                  viewMode === "list"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground"
                }`}
                aria-label="List view"
              >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">List</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("calendar")}
                className={`px-3 py-2 flex items-center gap-1.5 text-sm transition-colors ${
                  viewMode === "calendar"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground"
                }`}
                aria-label="Calendar view"
              >
                <Calendar className="w-4 h-4" />
                <span className="hidden sm:inline">Calendar</span>
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <Card key={i} className="animate-pulse h-40" />)}
          </div>
        ) : !events?.length ? (
          <Card className="border-dashed">
            <CardContent className="py-24 flex flex-col items-center text-center gap-5">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="w-10 h-10 text-primary" />
              </div>
              <div>
                <h3 className="text-2xl font-serif font-bold">No events yet</h3>
                <p className="text-muted-foreground mt-2 max-w-sm">
                  Create your first event — a registration form will be set up automatically.
                </p>
              </div>
              <Button asChild size="lg">
                <Link href="/events/new">
                  <Plus className="w-4 h-4 mr-2" /> Create First Event
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : viewMode === "calendar" ? (
          <CalendarView events={filtered} />
        ) : (
          <div className="space-y-4">
            {/* Past-events toggle */}
            {pastCount > 0 && !search && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {showPast
                    ? `Showing all ${filtered.length} events`
                    : `${filtered.length - pastCount} upcoming event${filtered.length - pastCount !== 1 ? "s" : ""}`}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPast((v) => !v)}
                  className="text-primary hover:underline text-sm font-medium"
                >
                  {showPast ? "Hide past events" : `Show ${pastCount} past event${pastCount !== 1 ? "s" : ""}`}
                </button>
              </div>
            )}

            {visible.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-10 text-center text-muted-foreground">
                  {search ? (
                    <p>No events match "<strong>{search}</strong>"</p>
                  ) : (
                    <>
                      <p>No upcoming events.</p>
                      <button
                        type="button"
                        onClick={() => setShowPast(true)}
                        className="text-primary hover:underline text-sm mt-1"
                      >
                        Show past events
                      </button>
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              visible.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onEdit={setEditEvent}
                  onDelete={setDeleteId}
                />
              ))
            )}
          </div>
        )}
      </div>

      {editEvent && (
        <EditEventDialog
          event={editEvent}
          open={!!editEvent}
          onOpenChange={(o) => { if (!o) setEditEvent(null); }}
        />
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the event. The linked registration form and its registrations will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteEvent.mutate({ eventId: deleteId })}
            >
              Delete Event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
