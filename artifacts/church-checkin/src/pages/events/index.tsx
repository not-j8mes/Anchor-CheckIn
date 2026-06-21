import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  useListEvents,
  useUpdateEvent,
  useListEventCategories,
  useCreateEventCategory,
  useGetOrganization,
  getListEventsQueryKey,
  getGetEventQueryKey,
  getListEventCategoriesQueryKey,
  type Event as ChurchEvent,
  type EventCategory,
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
  DialogDescription,
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
  Plus,
  Calendar,
  CalendarRange,
  Users,
  ArrowRight,
  Pencil,
  ChevronRight,
  ChevronLeft,
  Search,
  FileText,
  Settings,
  Check,
  Repeat,
  LogIn,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { APP_NAME, DEFAULT_APP_LOGO } from "@/lib/branding";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { TrimmedLogo } from "@/components/branding/TrimmedLogo";
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

const DEFAULT_ORGANIZATION_NAME = "Anchor Events";

function categoryLabel(type: string, categories: EventCategory[]) {
  return categories.find((c) => c.slug === type)?.name ?? type;
}

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

function registrationTypeStripe(_type?: string | null) {
  return "event-card-accent";
}


// ─── Edit Event Dialog ──────────────────────────────────────────────────────

type EditScheduleType = "one_time" | "multi_day" | "repeating";

const EDIT_DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const EDIT_DAY_ABBR = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function editComputeSessionCount(startDate: string, endDate: string, dayOfWeek: number): number {
  if (!startDate || !endDate || dayOfWeek < 0) return 0;
  let count = 0;
  const end = new Date(endDate + "T00:00:00");
  const cur = new Date(startDate + "T00:00:00");
  while (cur.getDay() !== dayOfWeek) cur.setDate(cur.getDate() + 1);
  while (cur <= end) { count++; cur.setDate(cur.getDate() + 7); }
  return count;
}

function editFormatDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function inferScheduleType(event: {
  scheduleType?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  repeatDayOfWeek?: number | null;
}): EditScheduleType {
  if (event.scheduleType === "repeating" || event.repeatDayOfWeek != null) return "repeating";
  if (event.scheduleType === "multi_day" || (event.endDate && event.startDate && event.endDate !== event.startDate)) return "multi_day";
  return "one_time";
}

interface EditEventDialogProps {
  event: {
    id: number;
    name: string;
    description?: string | null;
    eventType: string;
    registrationType?: string | null;
    scheduleType?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    repeatFrequency?: string | null;
    repeatDayOfWeek?: number | null;
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
  const { data: categories = [] } = useListEventCategories();
  const [createCatOpen, setCreateCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const createCategory = useCreateEventCategory({
    mutation: {
      onSuccess: (cat) => {
        queryClient.invalidateQueries({ queryKey: getListEventCategoriesQueryKey() });
        setForm((p) => ({ ...p, eventType: cat.slug }));
        setCreateCatOpen(false);
        setNewCatName("");
        toast({ title: `Category "${cat.name}" created` });
      },
      onError: () => toast({ title: "Failed to create category", variant: "destructive" }),
    },
  });

  const isChildCheckin = !event.registrationType || event.registrationType === "child_checkin";
  const [form, setForm] = useState({
    name: event.name,
    description: event.description ?? "",
    eventType: event.eventType,
    scheduleType: inferScheduleType(event),
    startDate: event.startDate ?? "",
    endDate: event.endDate ?? "",
    startTime: event.startTime ?? "",
    endTime: event.endTime ?? "",
    repeatFrequency: (event.repeatFrequency ?? "weekly") as "weekly",
    repeatDayOfWeek: event.repeatDayOfWeek ?? -1,
    trackAttendance: event.trackAttendance ?? isChildCheckin,
    requireCheckout: event.requireCheckout ?? isChildCheckin,
    printLabels: event.printLabels ?? isChildCheckin,
    labelType: event.labelType ?? (isChildCheckin ? "child_security" : "simple_name"),
  });
  const upd = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((p) => ({ ...p, [k]: v }));

  // Sync form when the event data updates (e.g. React Query refetch resolves after stale-cache initial render)
  useEffect(() => {
    setForm({
      name: event.name,
      description: event.description ?? "",
      eventType: event.eventType,
      scheduleType: inferScheduleType(event),
      startDate: event.startDate ?? "",
      endDate: event.endDate ?? "",
      startTime: event.startTime ?? "",
      endTime: event.endTime ?? "",
      repeatFrequency: (event.repeatFrequency ?? "weekly") as "weekly",
      repeatDayOfWeek: event.repeatDayOfWeek ?? -1,
      trackAttendance: event.trackAttendance ?? isChildCheckin,
      requireCheckout: event.requireCheckout ?? isChildCheckin,
      printLabels: event.printLabels ?? isChildCheckin,
      labelType: event.labelType ?? (isChildCheckin ? "child_security" : "simple_name"),
    });
  // Only re-sync if the event id or scheduleType changes — not on every keystroke
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id, event.scheduleType, event.repeatDayOfWeek]);

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
            <Label>Event Category</Label>
            <Select value={form.eventType} onValueChange={(v) => setForm((p) => ({ ...p, eventType: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.slug} value={cat.slug}>{cat.name}</SelectItem>
                ))}
                <div className="border-t border-border mt-1 pt-1">
                  <button
                    type="button"
                    className="w-full flex items-center gap-1.5 text-sm px-2 py-1.5 text-primary hover:bg-accent rounded-sm"
                    onMouseDown={(e) => { e.preventDefault(); setCreateCatOpen(true); }}
                  >
                    <Plus className="w-3.5 h-3.5" /> Create new category
                  </button>
                </div>
              </SelectContent>
            </Select>
          </div>

          <Dialog open={createCatOpen} onOpenChange={setCreateCatOpen}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>New Event Category</DialogTitle>
                <DialogDescription>
                  Give your category a name. It will be available for all events.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5 py-2">
                <Label>Category Name</Label>
                <Input
                  autoFocus
                  placeholder="e.g. Vacation Bible School"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newCatName.trim()) {
                      createCategory.mutate({ data: { name: newCatName.trim() } });
                    }
                  }}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateCatOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => createCategory.mutate({ data: { name: newCatName.trim() } })}
                  disabled={!newCatName.trim() || createCategory.isPending}
                >
                  {createCategory.isPending ? "Creating…" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </div>

          {/* Schedule type picker */}
          <div className="space-y-2">
            <Label>Event Schedule</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "one_time" as EditScheduleType, label: "One-time", Icon: Calendar },
                { value: "multi_day" as EditScheduleType, label: "Multi-day", Icon: CalendarRange },
                { value: "repeating" as EditScheduleType, label: "Repeating", Icon: Repeat },
              ] as const).map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    upd("scheduleType", value);
                    if (value === "one_time") upd("endDate", "");
                  }}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    form.scheduleType === value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-primary/50 hover:bg-muted/40 text-muted-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                  {form.scheduleType === value && <Check className="w-3 h-3 absolute" style={{ display: "none" }} />}
                </button>
              ))}
            </div>
          </div>

          {/* One-time */}
          {form.scheduleType === "one_time" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Date</Label>
                <Input type="date" value={form.startDate} onChange={(e) => upd("startDate", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Start Time <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input type="time" value={form.startTime} onChange={(e) => upd("startTime", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>End Time <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input type="time" value={form.endTime} onChange={(e) => upd("endTime", e.target.value)} />
              </div>
            </div>
          )}

          {/* Multi-day */}
          {form.scheduleType === "multi_day" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input type="date" value={form.startDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm((p) => ({ ...p, startDate: val, endDate: p.endDate && val > p.endDate ? "" : p.endDate }));
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <Input type="date" value={form.endDate} min={form.startDate || undefined}
                  onChange={(e) => upd("endDate", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Start Time <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input type="time" value={form.startTime} onChange={(e) => upd("startTime", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>End Time <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input type="time" value={form.endTime} onChange={(e) => upd("endTime", e.target.value)} />
              </div>
            </div>
          )}

          {/* Repeating */}
          {form.scheduleType === "repeating" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Program Start</Label>
                  <Input type="date" value={form.startDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm((p) => ({ ...p, startDate: val, endDate: p.endDate && val > p.endDate ? "" : p.endDate }));
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Program End</Label>
                  <Input type="date" value={form.endDate} min={form.startDate || undefined}
                    onChange={(e) => upd("endDate", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Start Time <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input type="time" value={form.startTime} onChange={(e) => upd("startTime", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>End Time <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input type="time" value={form.endTime} onChange={(e) => upd("endTime", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Repeat On</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {EDIT_DAY_ABBR.map((abbr, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => upd("repeatDayOfWeek", idx)}
                      className={`w-9 h-9 rounded-lg text-xs font-semibold border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        form.repeatDayOfWeek === idx
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary/50 hover:bg-muted/40"
                      }`}
                    >
                      {abbr}
                    </button>
                  ))}
                </div>
              </div>
              {form.startDate && form.endDate && form.repeatDayOfWeek >= 0 && (() => {
                const count = editComputeSessionCount(form.startDate, form.endDate, form.repeatDayOfWeek);
                const dayName = EDIT_DAY_NAMES[form.repeatDayOfWeek];
                return (
                  <p className="text-xs text-muted-foreground px-1">
                    {count} {dayName} session{count !== 1 ? "s" : ""} from {editFormatDate(form.startDate)} to {editFormatDate(form.endDate)}
                  </p>
                );
              })()}
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
                      <SelectItem value="simple_name_tag">Simple Name Tag</SelectItem>
                      <SelectItem value="simple_name">Simple Child Label</SelectItem>
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
            onClick={() => updateEvent.mutate({
              eventId: event.id,
              data: {
                ...form,
                endDate: form.scheduleType === "one_time" ? undefined : (form.endDate || undefined),
                startTime: form.startTime || undefined,
                endTime: form.endTime || undefined,
                repeatFrequency: form.scheduleType === "repeating" ? form.repeatFrequency : undefined,
                repeatDayOfWeek: form.scheduleType === "repeating" && form.repeatDayOfWeek >= 0 ? form.repeatDayOfWeek : undefined,
              },
            })}
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

function EventCard({ event, onEdit, categories }: {
  event: ChurchEvent;
  onEdit: (e: ChurchEvent) => void;
  categories: EventCategory[];
}) {
  const [, navigate] = useLocation();
  const openEvent = () => navigate(`/events/${event.id}`);
  const trackAttendance = event.trackAttendance ?? (event.registrationType === "child_checkin" || !event.registrationType);
  const checkinBadge = trackAttendance
    ? <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px]">Check-In On</Badge>
    : <Badge variant="outline" className="text-[10px] text-muted-foreground">No Check-In</Badge>;

  const formBadge = event.formId
    ? <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px]">Form Ready</Badge>
    : <Badge variant="outline" className="text-[10px] text-muted-foreground">No Form</Badge>;
  return (
    <Card
      className="overflow-hidden hover:shadow-md hover:bg-amber-50/20 transition-all border cursor-pointer"
      data-testid={`event-card-${event.id}`}
      role="button"
      tabIndex={0}
      aria-label={`Open ${event.name}`}
      onClick={openEvent}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEvent(); } }}
    >
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
                  {categoryLabel(event.eventType, categories)}
                  {event.scheduleType === "repeating" && event.repeatDayOfWeek != null ? (
                    <span className="ml-3 inline-flex items-center gap-1">
                      <Repeat className="w-3 h-3 inline-block" />
                      Every {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][event.repeatDayOfWeek]}
                      {event.nextSessionDate && (
                        <> · Next: {format(new Date(event.nextSessionDate + "T00:00:00"), "MMM d")}</>
                      )}
                    </span>
                  ) : event.startDate ? (
                    <span className="ml-3">
                      {format(new Date(event.startDate + "T00:00:00"), "MMM d, yyyy")}
                      {event.endDate && event.startDate !== event.endDate && (
                        <> – {format(new Date(event.endDate + "T00:00:00"), "MMM d, yyyy")}</>
                      )}
                    </span>
                  ) : null}
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground h-8 w-8"
                  data-testid={`button-edit-event-${event.id}`}
                  onClick={(e) => { e.stopPropagation(); onEdit(event); }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-2">
              <Button
                asChild
                size="sm"
                className="gap-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <Link href={`/events/${event.id}`}>
                  Open Event <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </Button>
              {trackAttendance && (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  aria-label={`Open ${event.name} Check-In Desk`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link href={`/events/${event.id}/checkin`}>
                    <LogIn className="w-3.5 h-3.5" /> Check-In Desk
                  </Link>
                </Button>
              )}
              {event.formId && (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link href={`/events/${event.id}/form`}>
                    <FileText className="w-3.5 h-3.5" /> Registration Form
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Calendar view ────────────────────────────────────────────────────────────

function CalendarView({ events, categories }: { events: ChurchEvent[]; categories: EventCategory[] }) {
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

    let dates: Date[];
    if (event.scheduleType === "repeating" && event.repeatDayOfWeek != null) {
      // Only show on days that match the repeat day of week
      dates = [];
      const cur = new Date(start);
      while (cur.getDay() !== event.repeatDayOfWeek) cur.setDate(cur.getDate() + 1);
      while (cur <= end) {
        dates.push(new Date(cur));
        cur.setDate(cur.getDate() + 7);
      }
    } else if (event.scheduleType === "one_time") {
      dates = [start];
    } else {
      dates = eachDayOfInterval({ start, end });
    }

    for (const d of dates) {
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
                    <div className="text-xs px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 transition-opacity font-medium bg-primary/10 text-primary">
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
  const { data: categories = [] } = useListEventCategories();
  const { data: org } = useGetOrganization();
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();

  const [editEvent, setEditEvent] = useState<ChurchEvent | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [showPast, setShowPast] = useState(false);
  const [search, setSearch] = useState("");

  const sorted = [...(events ?? [])].sort((a, b) => {
    const aT = a.startDate ? new Date(a.startDate + "T00:00:00").getTime() : Infinity;
    const bT = b.startDate ? new Date(b.startDate + "T00:00:00").getTime() : Infinity;
    return aT - bT;
  });

  const filtered = search.trim()
    ? sorted.filter((e) =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        categoryLabel(e.eventType, categories).toLowerCase().includes(search.toLowerCase())
      )
    : sorted;

  const pastCount = filtered.filter(isPast).length;
  const visible = viewMode === "list"
    ? filtered.filter((e) => showPast || !isPast(e))
    : filtered;
  const hasCustomOrganizationName = Boolean(
    org?.name
    && org.name !== DEFAULT_ORGANIZATION_NAME
    && org.name !== "Anchor Events - Check In and Registration"
  );
  const navLogo = org?.logoUrl || DEFAULT_APP_LOGO;
  const navName = hasCustomOrganizationName ? org!.name : APP_NAME;

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-foreground min-w-0 shrink">
            <div className="h-8 w-12 shrink-0 sm:w-16">
              <TrimmedLogo src={navLogo} alt={`${navName} logo`} className="h-full w-full object-contain" />
            </div>
            <span className="max-w-32 truncate font-serif text-sm font-bold sm:max-w-64 sm:text-base">{navName}</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {user?.isSuperAdmin && (
              <Button asChild variant="ghost" size="sm" className="px-2 sm:px-3">
                <Link href="/admin">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="sr-only sm:not-sr-only sm:ml-1.5">Platform Admin</span>
                </Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm" className="px-2 sm:px-3">
              <Link href="/settings">
                <Settings className="w-4 h-4" />
                <span className="sr-only sm:not-sr-only sm:ml-1.5">Org Settings</span>
              </Link>
            </Button>
            {user && (
              <span className="hidden sm:block text-sm text-muted-foreground border-l border-border pl-2 sm:pl-3">
                {user.firstName} {user.lastName}
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="px-2 sm:px-3"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
              <span className="sr-only sm:not-sr-only sm:ml-1.5">Logout</span>
            </Button>
            <Button asChild size="sm" className="px-2 sm:px-3" data-testid="button-create-event">
              <Link href="/events/new">
                <Plus className="w-4 h-4" />
                <span className="ml-1 sm:ml-1.5"><span className="sm:hidden">New</span><span className="hidden sm:inline">New Event</span></span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 pb-6 sm:pt-6 sm:pb-10 space-y-6 sm:space-y-8">
        {/* Hero header */}
        <div className="text-center space-y-1.5 sm:space-y-2">
          <h1 className="text-2xl sm:text-4xl font-serif font-bold text-foreground">Select an Event</h1>
          <p className="text-muted-foreground text-sm sm:text-lg max-w-md mx-auto">
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
            <CardContent className="py-12 sm:py-24 flex flex-col items-center text-center gap-4 sm:gap-5">
              <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="w-7 h-7 sm:w-10 sm:h-10 text-primary" />
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-serif font-bold">No events yet</h3>
                <p className="text-muted-foreground mt-1.5 sm:mt-2 text-sm sm:text-base max-w-sm">
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
          <CalendarView events={filtered} categories={categories} />
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
                <CardContent className="py-10 flex flex-col items-center text-center gap-3">
                  {search ? (
                    <>
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        <Search className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">No events match "{search}"</p>
                        <p className="text-sm text-muted-foreground mt-1">Try a different name or category.</p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => setSearch("")}>
                        Clear Search
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">No upcoming events</p>
                        <p className="text-sm text-muted-foreground mt-1">Create the next event or review past events.</p>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <Button asChild size="sm">
                          <Link href="/events/new">
                            <Plus className="w-3.5 h-3.5" /> New Event
                          </Link>
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => setShowPast(true)}>
                          Show Past Events
                        </Button>
                      </div>
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
                  categories={categories}
                />
              ))
            )}
          </div>
        )}

        <footer className="flex items-center justify-center gap-2 pt-4 text-xs text-muted-foreground">
          <img src={DEFAULT_APP_LOGO} alt="" className="h-4 w-4 object-contain" aria-hidden="true" />
          <span>Powered by <span className="font-semibold text-foreground/70">{APP_NAME}</span></span>
        </footer>
      </div>

      {editEvent && (
        <EditEventDialog
          key={editEvent.id}
          event={editEvent}
          open={!!editEvent}
          onOpenChange={(o) => { if (!o) setEditEvent(null); }}
        />
      )}

    </div>
  );
}
