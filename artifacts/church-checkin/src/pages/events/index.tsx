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
  ArrowRight,
  Trash2,
  Pencil,
  CheckSquare,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

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

function statusBadge(status: string) {
  if (status === "active") return <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>;
  if (status === "upcoming") return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Upcoming</Badge>;
  if (status === "completed") return <Badge variant="secondary">Completed</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function eventTypeLabel(type: string) {
  return EVENT_TYPES.find((t) => t.value === type)?.label ?? type;
}

// ─── Create Event Wizard ────────────────────────────────────────────────────

interface WizardState {
  // Step 1: event details
  name: string;
  description: string;
  eventType: string;
  startDate: string;
  endDate: string;
  status: string;
  // Step 2: form setup
  formTitle: string;
  formDescription: string;
  addDefaultQuestions: boolean;
}

const WIZARD_DEFAULTS: WizardState = {
  name: "",
  description: "",
  eventType: "general",
  startDate: "",
  endDate: "",
  status: "upcoming",
  formTitle: "",
  formDescription: "",
  addDefaultQuestions: true,
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

  const handleStep1Next = () => {
    if (!state.name.trim()) {
      toast({ title: "Event name is required", variant: "destructive" });
      return;
    }
    // Pre-fill form title based on event name
    if (!state.formTitle) {
      setState((prev) => ({ ...prev, formTitle: `${state.name} Registration` }));
    }
    setStep(2);
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
          startDate: state.startDate || undefined,
          endDate: state.endDate || undefined,
          status: state.status,
          formTitle: state.formTitle,
          formDescription: state.formDescription || undefined,
          addDefaultQuestions: state.addDefaultQuestions,
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif text-xl">
            {step === 1 ? (
              <><Calendar className="w-5 h-5 text-primary" /> New Event — Details</>
            ) : (
              <><CheckSquare className="w-5 h-5 text-primary" /> New Event — Registration Form</>
            )}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Step 1 of 2 — Fill in the event details."
              : "Step 2 of 2 — Set up the registration form for this event."}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex gap-2 pt-1">
          {[1, 2].map((n) => (
            <div
              key={n}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                n <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {step === 1 ? (
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
              <Label>Event Type <span className="text-destructive">*</span></Label>
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={state.startDate}
                  onChange={(e) => update("startDate", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={state.endDate}
                  onChange={(e) => update("endDate", e.target.value)}
                />
              </div>
            </div>
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
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/50 border border-border p-4 text-sm text-muted-foreground">
              A registration form will be created and linked to this event. Families will use this form to sign up their children.
            </div>
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
                placeholder="What families will see at the top of the form..."
                rows={2}
                value={state.formDescription}
                onChange={(e) => update("formDescription", e.target.value)}
              />
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background">
              <Switch
                id="default-questions"
                checked={state.addDefaultQuestions}
                onCheckedChange={(v) => update("addDefaultQuestions", v)}
              />
              <div>
                <Label htmlFor="default-questions" className="cursor-pointer font-medium">
                  Include standard questions
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Adds child name, date of birth, guardian contact, allergies, and special needs fields automatically.
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleStep1Next} data-testid="button-wizard-next">
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
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
  event: { id: number; name: string; description?: string | null; eventType: string; startDate?: string | null; endDate?: string | null; status: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function EditEventDialog({ event, open, onOpenChange }: EditEventDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: event.name,
    description: event.description ?? "",
    eventType: event.eventType,
    startDate: event.startDate ?? "",
    endDate: event.endDate ?? "",
    status: event.status,
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
      <DialogContent aria-describedby={undefined}>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>End Date</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} />
            </div>
          </div>
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

// ─── Events Page ─────────────────────────────────────────────────────────────

export default function EventsPage() {
  const { data: events, isLoading } = useListEvents();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<ChurchEvent | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

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

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto w-full space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Events</h1>
          <p className="text-muted-foreground mt-1">
            Manage church events — each linked to its own registration form.
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)} data-testid="button-create-event">
          <Plus className="w-4 h-4 mr-2" /> New Event
        </Button>
      </div>

      {/* Events list */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse h-36" />
          ))}
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
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <Card key={event.id} className="overflow-hidden hover-elevate transition-all border-card-border" data-testid={`event-card-${event.id}`}>
              <CardContent className="p-0">
                <div className="flex items-stretch">
                  {/* Color accent bar by type */}
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
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {eventTypeLabel(event.eventType)}
                        {(event.startDate || event.endDate) && (
                          <span className="ml-3">
                            {event.startDate && format(new Date(event.startDate + "T00:00:00"), "MMM d, yyyy")}
                            {event.startDate && event.endDate && " – "}
                            {event.endDate && format(new Date(event.endDate + "T00:00:00"), "MMM d, yyyy")}
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
                        {event.formTitle && (
                          <span className="truncate">Form: {event.formTitle}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => setEditEvent(event)}
                        data-testid={`button-edit-event-${event.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteId(event.id)}
                        data-testid={`button-delete-event-${event.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/events/${event.id}`}>
                          View <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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
