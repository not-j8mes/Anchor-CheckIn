import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useListEvents,
  useCreateEvent,
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
  DialogDescription,
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
  User,
  Baby,
  ArrowRight,
  Trash2,
  Pencil,
  CheckSquare,
  ChevronRight,
  ChevronLeft,
  Check,
  List,
  CalendarDays,
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

const STATUS_OPTIONS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

const REGISTRATION_TYPES = [
  {
    value: "child_checkin",
    label: "Child Check-In",
    Icon: Baby,
    description: "For kids programs where parents register children and staff check children in and out securely.",
    features: ["Child profiles", "Guardian and pickup info", "Check-in / check-out"],
    defaultCheckin: true,
  },
  {
    value: "family_group",
    label: "Family or Group",
    Icon: Users,
    description: "For events where one person registers multiple people, such as a family, couple, team, or group.",
    features: ["Primary contact", "Add additional people", "Grouped registration"],
    defaultCheckin: false,
  },
  {
    value: "individual",
    label: "Individual",
    Icon: User,
    description: "For events where each person signs up for themselves.",
    features: ["Simple signup", "One person per registration", "Optional attendance tracking"],
    defaultCheckin: false,
  },
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
  if (type === "individual") return <Badge className="bg-slate-100 text-slate-700 border-slate-200">Individual</Badge>;
  return null;
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

// ─── Create Event Wizard ────────────────────────────────────────────────────

interface WizardState {
  // Step 1: registration type
  registrationType: string;
  // Step 2: event details
  name: string;
  description: string;
  eventType: string;
  isMultiDay: boolean;
  startDate: string;
  endDate: string;
  status: string;
  // Step 3: form setup
  formTitle: string;
  formDescription: string;
  addDefaultQuestions: boolean;
  // Step 3: check-in / attendance settings
  trackAttendance: boolean;
  requireCheckout: boolean;
  printLabels: boolean;
  labelType: string;
}

const WIZARD_DEFAULTS: WizardState = {
  registrationType: "",
  name: "",
  description: "",
  eventType: "general",
  isMultiDay: false,
  startDate: "",
  endDate: "",
  status: "upcoming",
  formTitle: "",
  formDescription: "",
  addDefaultQuestions: true,
  trackAttendance: false,
  requireCheckout: false,
  printLabels: false,
  labelType: "simple_name",
};

interface CreateEventWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

function CreateEventWizard({ open, onOpenChange, onCreated }: CreateEventWizardProps) {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(WIZARD_DEFAULTS);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const createEvent = useCreateEvent();

  const update = (key: keyof WizardState, value: string | boolean) =>
    setState((prev) => ({ ...prev, [key]: value }));

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => { setStep(1); setState(WIZARD_DEFAULTS); }, 300);
  };

  const handleSelectType = (typeValue: string) => {
    const isChild = typeValue === "child_checkin";
    setState((prev) => ({
      ...prev,
      registrationType: typeValue,
      trackAttendance: isChild,
      requireCheckout: isChild,
      printLabels: isChild,
      labelType: isChild ? "child_security" : "simple_name",
    }));
    setStep(2);
  };

  const handleStep2Next = () => {
    if (!state.name.trim()) {
      toast({ title: "Event name is required", variant: "destructive" });
      return;
    }
    if (!state.formTitle) {
      setState((prev) => ({ ...prev, formTitle: `${state.name} Registration` }));
    }
    setStep(3);
  };

  const handleCreate = () => {
    if (!state.formTitle.trim()) {
      toast({ title: "Form title is required", variant: "destructive" });
      return;
    }
    createEvent.mutate(
      {
        data: {
          name: state.name,
          description: state.description || undefined,
          eventType: state.eventType,
          registrationType: state.registrationType || undefined,
          startDate: state.startDate || undefined,
          endDate: state.endDate || undefined,
          status: state.status,
          formTitle: state.formTitle,
          formDescription: state.formDescription || undefined,
          addDefaultQuestions: state.addDefaultQuestions,
          trackAttendance: state.trackAttendance,
          requireCheckout: state.requireCheckout,
          printLabels: state.printLabels,
          labelType: state.labelType,
        },
      },
      {
        onSuccess: (data) => {
          toast({ title: `"${state.name}" event created!` });
          handleClose();
          onCreated();
          navigate(`/events/${data.id}?tab=form`);
        },
        onError: () => {
          toast({ title: "Failed to create event", variant: "destructive" });
        },
      }
    );
  };

  const stepTitles: Record<number, React.ReactNode> = {
    1: <><Calendar className="w-5 h-5 text-primary" /> What kind of registration do you need?</>,
    2: <><Calendar className="w-5 h-5 text-primary" /> Event Details</>,
    3: <><CheckSquare className="w-5 h-5 text-primary" /> Registration Setup</>,
  };

  const stepDescriptions: Record<number, string> = {
    1: "Choose the setup that best matches this event. You can customize the form after it is created.",
    2: "Step 2 of 3 — Fill in the event details.",
    3: "Step 3 of 3 — Set up the registration form for this event.",
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={step === 1 ? "max-w-2xl" : "max-w-lg"} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif text-xl">
            {stepTitles[step]}
          </DialogTitle>
          <DialogDescription>{stepDescriptions[step]}</DialogDescription>
        </DialogHeader>

        {/* Step indicator — only steps 2 and 3 show the bar */}
        {step > 1 && (
          <div className="flex gap-2 pt-1">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  n <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        )}

        {/* ── Step 1: Registration Type Picker ── */}
        {step === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-2">
            {REGISTRATION_TYPES.map(({ value, label, Icon, description, features }) => (
              <button
                key={value}
                type="button"
                data-testid={`reg-type-${value}`}
                onClick={() => handleSelectType(value)}
                className="group text-left rounded-xl border-2 border-border bg-background p-4 hover:border-primary hover:bg-primary/5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <p className="font-semibold text-foreground text-sm mb-1">{label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">{description}</p>
                <ul className="space-y-1">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Check className="w-3 h-3 text-primary flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
        )}

        {/* ── Step 2: Event Details ── */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Event Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. VBS Summer 2025"
                value={state.name}
                onChange={(e) => update("name", e.target.value)}
                data-testid="input-event-name"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Event Category</Label>
              <Select value={state.eventType} onValueChange={(v) => update("eventType", v)}>
                <SelectTrigger data-testid="select-event-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                placeholder="Optional description..."
                rows={2}
                value={state.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
              <div>
                <p className="text-sm font-medium">Multi-day event</p>
                <p className="text-xs text-muted-foreground">Spans more than one day</p>
              </div>
              <Switch
                checked={state.isMultiDay}
                onCheckedChange={(v) => {
                  update("isMultiDay", v);
                  if (!v) update("endDate", "");
                }}
              />
            </div>
            {state.isMultiDay ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={state.startDate}
                    onChange={(e) => {
                      update("startDate", e.target.value);
                      if (state.endDate && e.target.value > state.endDate) update("endDate", "");
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={state.endDate}
                    min={state.startDate || undefined}
                    onChange={(e) => update("endDate", e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={state.startDate}
                  onChange={(e) => update("startDate", e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={state.status} onValueChange={(v) => update("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* ── Step 3: Registration Setup ── */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Form Title <span className="text-destructive">*</span></Label>
              <Input
                value={state.formTitle}
                onChange={(e) => update("formTitle", e.target.value)}
                data-testid="input-form-title"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Form Description</Label>
              <Textarea
                placeholder="What registrants will see at the top of the form..."
                rows={2}
                value={state.formDescription}
                onChange={(e) => update("formDescription", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Form fields</Label>
              <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background">
                <Switch
                  id="default-questions"
                  checked={state.addDefaultQuestions}
                  onCheckedChange={(v) => update("addDefaultQuestions", v)}
                />
                <div>
                  <Label htmlFor="default-questions" className="cursor-pointer font-medium text-sm">
                    Start from template
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {state.registrationType === "child_checkin"
                      ? "Includes child name, DOB, guardian, emergency contact, allergies, and more."
                      : state.registrationType === "family_group"
                      ? "Includes primary contact and fields for adding family members."
                      : "Includes name, contact info, and basic attendee fields."}
                    {" "}Turn off to start with a blank form.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Attendance &amp; Check-In</Label>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background">
                  <Switch
                    id="track-attendance"
                    checked={state.trackAttendance}
                    onCheckedChange={(v) => {
                      update("trackAttendance", v);
                      if (!v) { update("requireCheckout", false); update("printLabels", false); }
                    }}
                  />
                  <div>
                    <Label htmlFor="track-attendance" className="cursor-pointer font-medium text-sm">
                      Track attendance with check-ins
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Staff can check attendees in at the kiosk. Shows Checked In tab and count.
                    </p>
                  </div>
                </div>

                {state.trackAttendance && state.registrationType === "child_checkin" && (
                  <div className="ml-4 flex items-start gap-3 p-3 rounded-lg border border-border bg-background">
                    <Switch
                      id="require-checkout"
                      checked={state.requireCheckout}
                      onCheckedChange={(v) => update("requireCheckout", v)}
                    />
                    <div>
                      <Label htmlFor="require-checkout" className="cursor-pointer font-medium text-sm">
                        Require check-out
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Staff must check children out. Enables pickup security codes.
                      </p>
                    </div>
                  </div>
                )}

                {state.trackAttendance && (
                  <div className="ml-4 flex items-start gap-3 p-3 rounded-lg border border-border bg-background">
                    <Switch
                      id="print-labels"
                      checked={state.printLabels}
                      onCheckedChange={(v) => update("printLabels", v)}
                    />
                    <div className="flex-1">
                      <Label htmlFor="print-labels" className="cursor-pointer font-medium text-sm">
                        Print name labels at check-in
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Print a label when each attendee checks in.
                      </p>
                      {state.printLabels && (
                        <div className="mt-2">
                          <Select
                            value={state.labelType}
                            onValueChange={(v) => update("labelType", v)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="simple_name">Simple name label</SelectItem>
                              <SelectItem value="child_security" disabled={state.registrationType !== "child_checkin"}>
                                Child security label {state.registrationType !== "child_checkin" ? "(kids events only)" : ""}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 1 && (
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
          )}
          {step === 2 && (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={handleStep2Next} data-testid="button-wizard-next">
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </>
          )}
          {step === 3 && (
            <>
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button
                onClick={handleCreate}
                disabled={createEvent.isPending}
                data-testid="button-wizard-create"
              >
                {createEvent.isPending ? "Creating..." : "Create Event"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
    status: string;
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

  // Safe defaults for check-in settings (null = derive from registrationType)
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
    status: event.status,
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
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── Check-In Settings ── */}
          <div className="space-y-2 pt-1 border-t border-border">
            <Label className="text-sm font-medium">Attendance &amp; Check-In</Label>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-1.5">
                <div>
                  <span className="text-sm font-medium">Track attendance with check-ins</span>
                  <p className="text-xs text-muted-foreground">Show Checked In tab and kiosk button</p>
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

// ─── Event card (shared between list view and other places) ──────────────────

function EventCard({ event, onEdit, onDelete }: {
  event: ChurchEvent;
  onEdit: (e: ChurchEvent) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <Card className="overflow-hidden hover-elevate transition-all border-card-border" data-testid={`event-card-${event.id}`}>
      <CardContent className="p-0">
        <div className="flex items-stretch">
          <div className={`w-1.5 flex-shrink-0 ${
            event.eventType === "vbs" ? "bg-yellow-400" :
            event.eventType === "awana" ? "bg-blue-500" :
            event.eventType === "sunday_school" ? "bg-purple-500" :
            event.eventType === "youth_group" ? "bg-green-500" :
            event.eventType === "camp" ? "bg-orange-500" :
            "bg-primary"
          }`} />
          <div className="flex-1 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-serif font-bold truncate">{event.name}</h3>
                {statusBadge(event.status)}
                {registrationTypeBadge(event.registrationType)}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {eventTypeLabel(event.eventType)}
                {(event.startDate || event.endDate) && (
                  <span className="ml-3">
                    {event.startDate && format(new Date(event.startDate + "T00:00:00"), "MMM d, yyyy")}
                    {event.startDate && event.endDate && event.startDate !== event.endDate && " – "}
                    {event.endDate && event.startDate !== event.endDate && format(new Date(event.endDate + "T00:00:00"), "MMM d, yyyy")}
                  </span>
                )}
              </p>
              {event.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{event.description}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {event.registrationCount} registered
                </span>
                {event.formTitle && <span className="truncate">Form: {event.formTitle}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground"
                onClick={() => onEdit(event)} data-testid={`button-edit-event-${event.id}`}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(event.id)} data-testid={`button-delete-event-${event.id}`}>
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/events/${event.id}`}>View <ArrowRight className="w-3.5 h-3.5 ml-1" /></Link>
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

  // Index events by every date they cover (start through end)
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
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="icon" onClick={() => setMonth((m) => subMonths(m, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="font-serif font-bold text-xl">{format(month, "MMMM yyyy")}</h2>
        <Button variant="outline" size="icon" onClick={() => setMonth((m) => addMonths(m, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
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

// ─── Events Page ─────────────────────────────────────────────────────────────

function isPast(event: ChurchEvent): boolean {
  if (event.status === "completed") return true;
  const refDate = event.endDate || event.startDate;
  if (!refDate) return false;
  const d = new Date(refDate + "T00:00:00");
  d.setHours(23, 59, 59, 999);
  return d < new Date();
}

export default function EventsPage() {
  const { data: events, isLoading } = useListEvents();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<ChurchEvent | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [showPast, setShowPast] = useState(false);

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

  // Sort by startDate ascending; undated events go last
  const sorted = [...(events ?? [])].sort((a, b) => {
    const aT = a.startDate ? new Date(a.startDate + "T00:00:00").getTime() : Infinity;
    const bT = b.startDate ? new Date(b.startDate + "T00:00:00").getTime() : Infinity;
    return aT - bT;
  });

  const pastCount = sorted.filter(isPast).length;
  const visible = viewMode === "list"
    ? sorted.filter((e) => showPast || !isPast(e))
    : sorted;

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto w-full space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Events</h1>
          <p className="text-muted-foreground mt-1">
            Manage church events — each linked to its own registration form.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* View toggle */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
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
              <List className="w-4 h-4" />
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
              <CalendarDays className="w-4 h-4" />
              <span className="hidden sm:inline">Calendar</span>
            </button>
          </div>
          <Button onClick={() => setWizardOpen(true)} data-testid="button-create-event">
            <Plus className="w-4 h-4 mr-2" /> New Event
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Card key={i} className="animate-pulse h-36" />)}
        </div>
      ) : !events?.length ? (
        <Card className="border-dashed">
          <CardContent className="py-20 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Calendar className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-serif font-bold">No events yet</h3>
              <p className="text-muted-foreground mt-1 max-w-sm">
                Create your first event — a registration form will be set up automatically.
              </p>
            </div>
            <Button onClick={() => setWizardOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Create First Event
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === "calendar" ? (
        <CalendarView events={sorted} />
      ) : (
        /* ── List view ── */
        <div className="space-y-4">
          {/* Past-events toggle */}
          {pastCount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {showPast
                  ? `Showing all ${sorted.length} events`
                  : `${sorted.length - pastCount} upcoming event${sorted.length - pastCount !== 1 ? "s" : ""}`}
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
                <p>No upcoming events.</p>
                <button
                  type="button"
                  onClick={() => setShowPast(true)}
                  className="text-primary hover:underline text-sm mt-1"
                >
                  Show past events
                </button>
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

      {/* Wizard */}
      <CreateEventWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCreated={() => queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() })}
      />

      {/* Edit dialog */}
      {editEvent && (
        <EditEventDialog
          event={editEvent}
          open={!!editEvent}
          onOpenChange={(o) => { if (!o) setEditEvent(null); }}
        />
      )}

      {/* Delete confirmation */}
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
