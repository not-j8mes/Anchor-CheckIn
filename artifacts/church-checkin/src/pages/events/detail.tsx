import { Link, useParams, useLocation } from "wouter";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  useGetEvent,
  useUpdateEvent,
  useUpdateForm,
  useSubmitRegistration,
  useListRegistrations,
  useListEventCheckins,
  useListEventSessions,
  useListFormFields,
  useCheckoutChild,
  useDeleteCheckin,
  useUndoCheckout,
  useCreateCheckin,
  useGetRegistration,
  useListChildren,
  useUpdateRegistration,
  useDeleteRegistration,
  useListRooms,
  useCreateRoom,
  useUpdateRoom,
  useDeleteRoom,
  useCreateFormField,
  useUpdateRegistrationRoom,
  useUpdateRegistrationCustomAnswers,
  useUpdateRegistrationFamily,
  useUpdateCheckin,
  useDeleteEvent,
  useListEventCategories,
  useCreateEventCategory,
  useBulkCheckout,
  useBatchCheckin,
  getFormBySlug,
  getGetFormBySlugQueryKey,
  getGetEventQueryKey,
  getListEventsQueryKey,
  getGetFormQueryKey,
  getListFormFieldsQueryKey,
  getListRegistrationsQueryKey,
  getListEventCheckinsQueryKey,
  getListEventSessionsQueryKey,
  getListChildrenQueryKey,
  getListRoomsQueryKey,
  getListEventCategoriesQueryKey,
  type Child,
  type Room,
  type LabelData,
  type EventCheckin,
  type EventSession,
  type Registration,
  type EventWithForm,
  type FormField,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowLeft,
  Calendar,
  Users,
  Check,
  CheckSquare,
  ClipboardList,
  ExternalLink,
  Copy,
  LogIn,
  LogOut,
  Loader2,
  Undo2,
  FileEdit,
  Download,
  BarChart2,
  DoorOpen,
  Plus,
  Pencil,
  Trash2,
  Search,
  Baby,
  AlertTriangle,
  ShieldCheck,
  Phone,
  Mail,
  MapPin,
  Info,
  Printer,
  StickyNote,
  Settings,
  Tag,
  ChevronRight,
  User,
  Repeat,
  MoreHorizontal,
  PowerOff,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LabelPrintDialog } from "@/components/checkin/LabelPrintDialog";
import { printLabels as printLabelDirectly } from "@/lib/label-renderer";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { FormBuilderPanel } from "@/components/forms/FormBuilderPanel";
import {
  RegistrationFormBody,
  getFieldSection,
} from "@/components/registration/RegistrationFormBody";
import { cn } from "@/lib/utils";


const BULK_CHECKOUT_REASON_LABELS: Record<string, string> = {
  end_of_event: "End of event",
  forgot_individual: "Forgot to check out individually",
  emergency_closure: "Emergency closure",
  other: "Other",
};

const BULK_CHECKOUT_REASONS = Object.entries(BULK_CHECKOUT_REASON_LABELS).map(
  ([value, label]) => ({ value, label }),
);

function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLocalDateDayOfWeek(dateKey: string): number {
  return new Date(dateKey + "T00:00:00").getDay();
}

function statusBadge(status: string) {
  if (status === "active") return <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>;
  if (status === "upcoming") return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Upcoming</Badge>;
  if (status === "completed") return <Badge variant="secondary">Completed</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

// ─── Rooms tab ─────────────────────────────────────────────────────────────────

function EventRoomFormDialog({ room, eventId, open, onOpenChange }: { room?: Room; eventId: number; open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!room;
  const [name, setName] = useState(room?.name ?? "");
  const [description, setDescription] = useState(room?.description ?? "");
  const [capacity, setCapacity] = useState(room?.capacity != null ? String(room.capacity) : "");

  const inv = () => queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey(eventId) });
  const createRoom = useCreateRoom({ mutation: { onSuccess: () => { inv(); toast({ title: "Room created" }); onOpenChange(false); }, onError: () => toast({ title: "Failed to create room", variant: "destructive" }) } });
  const updateRoom = useUpdateRoom({ mutation: { onSuccess: () => { inv(); toast({ title: "Room updated" }); onOpenChange(false); }, onError: () => toast({ title: "Failed to update room", variant: "destructive" }) } });
  const isPending = createRoom.isPending || updateRoom.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const cap = capacity ? parseInt(capacity, 10) : undefined;
    if (isEdit) updateRoom.mutate({ eventId, roomId: room!.id, data: { name: name.trim(), description: description.trim() || undefined, capacity: cap } });
    else createRoom.mutate({ eventId, data: { name: name.trim(), description: description.trim() || undefined, capacity: cap } });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isPending) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{isEdit ? "Edit Room" : "Add Room"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Room Name <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nursery, K–2nd Grade" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Age range, grade, etc." />
          </div>
          <div className="space-y-1.5">
            <Label>Capacity <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="Max children" />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || isPending}>
              {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {isEdit ? "Save Changes" : "Add Room"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RoomsTabContent({ eventId, formId, roomAssignmentMode }: { eventId: number; formId?: number | null; roomAssignmentMode?: string | null }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: rooms, isLoading } = useListRooms(eventId, {
    query: { enabled: !!eventId, queryKey: getListRoomsQueryKey(eventId) },
  });
  const { data: formFields = [] } = useListFormFields(formId ?? 0, {
    query: { enabled: !!formId, queryKey: getListFormFieldsQueryKey(formId ?? 0) },
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const deleteRoom = useDeleteRoom({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey(eventId) }); toast({ title: "Room deleted" }); setDeletingId(null); },
      onError: () => { toast({ title: "Failed to delete room", variant: "destructive" }); setDeletingId(null); },
    },
  });

  const createFormField = useCreateFormField({
    mutation: {
      onSuccess: () => {
        if (formId) queryClient.invalidateQueries({ queryKey: getListFormFieldsQueryKey(formId) });
        toast({ title: "Room / Group field added to the registration form" });
      },
      onError: () => { toast({ title: "Failed to add field", variant: "destructive" }); },
    },
  });

  const hasRoomAssignmentField = formFields.some((f) => f.systemKey === "room_assignment");
  const activeRooms = rooms?.filter((r) => r.isActive) ?? [];
  const inactiveRooms = rooms?.filter((r) => !r.isActive) ?? [];

  const handleAddRoomField = () => {
    if (!formId) return;
    createFormField.mutate({
      formId,
      data: {
        fieldKind: "system",
        systemKey: "room_assignment",
        label: "Room / Group",
        fieldType: "select",
        required: true,
        sortOrder: formFields.length,
        placeholder: "Select a room or group",
        options: "",
        sectionKey: "child_info",
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{rooms?.length ?? 0} room{rooms?.length === 1 ? "" : "s"}</p>
        <Button size="sm" className="gap-1.5" onClick={() => { setEditingRoom(undefined); setDialogOpen(true); }}>
          <Plus className="w-3.5 h-3.5" /> Add Room
        </Button>
      </div>

      {/* Only suggest adding Room/Group to form if assignment mode is "registrant chooses" */}
      {formId && roomAssignmentMode === "registrant_chooses" && (rooms?.length ?? 0) > 0 && !hasRoomAssignmentField && (
        <div className="flex items-start gap-3 p-3.5 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 text-sm">
          <DoorOpen className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-blue-900 dark:text-blue-300">Room selection is not on the registration form yet.</p>
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
              Add the Room / Group field if registrants should choose a room when signing up.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-blue-300 text-blue-800 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950 flex-shrink-0"
            onClick={handleAddRoomField}
            disabled={createFormField.isPending}
          >
            {createFormField.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add to form"}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : !rooms?.length ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <DoorOpen className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p>No rooms yet. Add rooms like Nursery or K–2nd Grade to organize check-ins.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {[...activeRooms, ...inactiveRooms].map((room) => (
            <Card key={room.id} className={!room.isActive ? "opacity-60" : undefined}>
              <CardContent className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <DoorOpen className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{room.name}</p>
                      {!room.isActive && <Badge variant="secondary" className="text-[10px] py-0">Inactive</Badge>}
                    </div>
                    {room.description && <p className="text-xs text-muted-foreground">{room.description}</p>}
                    <div className="flex items-center gap-3 mt-0.5">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" /> {room.participantCount ?? 0} registered
                      </p>
                      {room.capacity != null && (
                        <p className="text-xs text-muted-foreground">· max {room.capacity}</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => { setEditingRoom(room); setDialogOpen(true); }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={deletingId === room.id}
                    onClick={() => { setDeletingId(room.id); deleteRoom.mutate({ eventId, roomId: room.id }); }}
                  >
                    {deletingId === room.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EventRoomFormDialog
        key={editingRoom?.id ?? "new"}
        room={editingRoom}
        eventId={eventId}
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditingRoom(undefined); }}
      />
    </div>
  );
}

// ─── Children tab ──────────────────────────────────────────────────────────────

function EventEditChildDialog({ child, open, onOpenChange }: { child: Child; open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { id: eventIdStr } = useParams<{ id: string }>();
  const _editChildEventId = parseInt(eventIdStr || "0", 10);
  const { data: rooms } = useListRooms(_editChildEventId, {
    query: { enabled: !!_editChildEventId, queryKey: getListRoomsQueryKey(_editChildEventId) },
  });

  const guardianParts = (child.guardianName ?? "").trim().split(/\s+/);
  const [form, setForm] = useState({
    childFirstName: child.firstName,
    childLastName: child.lastName,
    childDateOfBirth: child.dateOfBirth ?? "",
    guardianFirstName: guardianParts[0] ?? "",
    guardianLastName: guardianParts.slice(1).join(" "),
    guardianPhone: child.guardianPhone ?? "",
    guardianEmail: child.guardianEmail ?? "",
    allergies: child.allergies ?? "",
    medicalNotes: child.medicalNotes ?? "",
    specialNeeds: child.specialNeeds ?? "",
    room: child.room ?? "",
  });

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((p) => ({ ...p, [field]: e.target.value }));

  const updateRegistration = useUpdateRegistration({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListChildrenQueryKey() });
        toast({ title: "Record updated" });
        onOpenChange(false);
      },
      onError: () => toast({ title: "Failed to save changes", variant: "destructive" }),
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateRegistration.mutate({
      registrationId: child.registrationId ?? child.id,
      data: {
        childFirstName: form.childFirstName.trim() || undefined,
        childLastName: form.childLastName.trim() || undefined,
        childDateOfBirth: form.childDateOfBirth || undefined,
        guardianFirstName: form.guardianFirstName.trim() || undefined,
        guardianLastName: form.guardianLastName.trim() || undefined,
        guardianPhone: form.guardianPhone.trim() || undefined,
        guardianEmail: form.guardianEmail.trim() || undefined,
        allergies: form.allergies.trim(),
        medicalNotes: form.medicalNotes.trim(),
        specialNeeds: form.specialNeeds.trim(),
        room: form.room || undefined,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!updateRegistration.isPending) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-serif">Edit — {child.firstName} {child.lastName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Child</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>First Name</Label><Input value={form.childFirstName} onChange={set("childFirstName")} /></div>
              <div className="space-y-1.5"><Label>Last Name</Label><Input value={form.childLastName} onChange={set("childLastName")} /></div>
            </div>
            <div className="space-y-1.5"><Label>Date of Birth</Label><Input type="date" value={form.childDateOfBirth} onChange={set("childDateOfBirth")} /></div>
            <div className="space-y-1.5"><Label>Allergies</Label><Textarea value={form.allergies} onChange={set("allergies")} placeholder="e.g. peanuts, latex" rows={2} /></div>
            <div className="space-y-1.5"><Label>Medical Notes</Label><Textarea value={form.medicalNotes} onChange={set("medicalNotes")} placeholder="Any diagnoses, medications, or medical considerations…" rows={2} /></div>
            <div className="space-y-1.5"><Label>Special Needs / Accommodations</Label><Textarea value={form.specialNeeds} onChange={set("specialNeeds")} placeholder="Describe any special needs or accommodations required…" rows={2} /></div>
            <div className="space-y-1.5">
              <Label>Room</Label>
              {rooms && rooms.length > 0 ? (
                <Select value={form.room || "__none__"} onValueChange={(v) => setForm((p) => ({ ...p, room: v === "__none__" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {rooms.map((r) => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={form.room} onChange={set("room")} placeholder="Room name" />
              )}
            </div>
          </div>
          <div className="space-y-3 pt-1 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Guardian</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>First Name</Label><Input value={form.guardianFirstName} onChange={set("guardianFirstName")} /></div>
              <div className="space-y-1.5"><Label>Last Name</Label><Input value={form.guardianLastName} onChange={set("guardianLastName")} /></div>
            </div>
            <div className="space-y-1.5"><Label>Phone</Label><Input type="tel" value={form.guardianPhone} onChange={set("guardianPhone")} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.guardianEmail} onChange={set("guardianEmail")} /></div>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={updateRegistration.isPending} className="gap-2">
              {updateRegistration.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Manual Registration Dialog ───────────────────────────────────────────────

function ManualRegistrationDialog({
  formId,
  embedSlug,
  isChildCheckin,
  eventId,
  open,
  onOpenChange,
}: {
  formId: number | null | undefined;
  embedSlug: string | null | undefined;
  isChildCheckin: boolean;
  eventId: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: form, isLoading: fieldsLoading } = useQuery({
    queryKey: getGetFormBySlugQueryKey(embedSlug ?? ""),
    queryFn: () => getFormBySlug(embedSlug!),
    enabled: open && !!embedSlug,
  });
  const formFields: FormField[] = form?.formFields ?? [];

  const { data: rooms = [] } = useListRooms(eventId, {
    query: { enabled: open && !!eventId, queryKey: getListRoomsQueryKey(eventId) },
  });

  const [guardianAnswers, setGuardianAnswers] = useState<Record<number, string>>({});
  const [childrenAnswers, setChildrenAnswers] = useState<Record<number, string>[]>([{}]);
  const [emergencyAnswers, setEmergencyAnswers] = useState<Record<number, string>>({});
  const [additionalAnswers, setAdditionalAnswers] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitReg = useSubmitRegistration();

  const resetForm = () => {
    setGuardianAnswers({});
    setChildrenAnswers([{}]);
    setEmergencyAnswers({});
    setAdditionalAnswers({});
  };

  const roomAssignmentFieldId = formFields.find((f) => f.systemKey === "room_assignment")?.id;

  const resolvedFormId = form?.id ?? formId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedFormId) return;
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
        for (const f of formFields.filter((f) => getFieldSection(f) === "additional_questions")) {
          fields.push({ fieldId: f.id, value: additionalAnswers[f.id] ?? "" });
        }
        const selectedRoom = roomAssignmentFieldId
          ? (childAnswerMap[roomAssignmentFieldId] ?? "")
          : "";
        await submitReg.mutateAsync({
          formId: resolvedFormId,
          data: { fields, ...(selectedRoom ? { room: selectedRoom } : {}) },
        });
      }
      queryClient.invalidateQueries({ queryKey: getListRegistrationsQueryKey(resolvedFormId) });
      queryClient.invalidateQueries({ queryKey: getListEventCheckinsQueryKey(eventId) });
      queryClient.invalidateQueries({ queryKey: getListChildrenQueryKey({ eventId }) });
      const count = childrenAnswers.length;
      toast({
        title: isChildCheckin
          ? count > 1 ? `${count} children added successfully.` : "Child added successfully."
          : count > 1 ? `${count} registrants added successfully.` : "Registrant added successfully.",
      });
      onOpenChange(false);
      resetForm();
    } catch {
      toast({ title: "Failed to add registration", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => { if (!isSubmitting) { onOpenChange(v); if (!v) resetForm(); } }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-serif">
            Add {isChildCheckin ? "Child" : "Registrant"}
          </DialogTitle>
        </DialogHeader>

        {!embedSlug ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No registration form is linked to this event.
          </p>
        ) : fieldsLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 pt-1">
            <RegistrationFormBody
              formFields={formFields}
              rooms={rooms}
              isChildCheckin={isChildCheckin}
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
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => { onOpenChange(false); resetForm(); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSubmitting
                  ? "Saving…"
                  : childrenAnswers.length > 1
                    ? `Add ${childrenAnswers.length} ${isChildCheckin ? "Children" : "Registrants"}`
                    : `Add ${isChildCheckin ? "Child" : "Registrant"}`}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Registration detail sheet ────────────────────────────────────────────────

function RegistrationDetailSheet({
  reg,
  open,
  onOpenChange,
  isChildCheckin,
  formId,
  eventId,
}: {
  reg: Registration;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isChildCheckin: boolean;
  formId?: number | null;
  eventId: number;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [assigningRoom, setAssigningRoom] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const { data: rooms } = useListRooms(eventId, {
    query: { enabled: open && !!eventId, queryKey: getListRoomsQueryKey(eventId) },
  });

  const deleteRegistration = useDeleteRegistration({
    mutation: {
      onSuccess: () => {
        if (formId) queryClient.invalidateQueries({ queryKey: getListRegistrationsQueryKey(formId) });
        queryClient.invalidateQueries({ queryKey: getListChildrenQueryKey({ eventId }) });
        toast({ title: "Registration deleted" });
        setDeleteOpen(false);
        onOpenChange(false);
      },
      onError: (err) => toast({ title: "Failed to delete registration", description: err instanceof Error ? err.message : String(err), variant: "destructive" }),
    },
  });

  const updateRoom = useUpdateRegistrationRoom({
    mutation: {
      onSuccess: (updated) => {
        if (formId) queryClient.invalidateQueries({ queryKey: getListRegistrationsQueryKey(formId) });
        queryClient.invalidateQueries({ queryKey: [`/api/registrations/${reg.id}`] });
        toast({ title: updated.room ? `Room set to ${updated.room}` : "Room cleared" });
        setAssigningRoom(false);
      },
      onError: () => { toast({ title: "Failed to assign room", variant: "destructive" }); setAssigningRoom(false); },
    },
  });

  const { data: regDetail } = useGetRegistration(reg.id, {
    query: { enabled: open, queryKey: [`/api/registrations/${reg.id}`] },
  });

  const handleEditClose = (v: boolean) => {
    setEditOpen(v);
    if (!v && formId) {
      queryClient.invalidateQueries({ queryKey: getListRegistrationsQueryKey(formId) });
    }
  };

  const age = reg.childDateOfBirth
    ? (() => {
        const birth = new Date(reg.childDateOfBirth);
        const today = new Date();
        let years = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) years--;
        if (years === 0) {
          const months = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
          return `${Math.max(0, months)} mo`;
        }
        return `${years} yr`;
      })()
    : null;


  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col p-0 gap-0">
          <SheetTitle className="sr-only">{reg.childFirstName} {reg.childLastName}</SheetTitle>

          {/* Header */}
          <div className="flex items-start gap-3 px-5 pt-5 pb-4 pr-14 border-b shrink-0">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-serif font-bold text-primary text-lg shrink-0">
              {reg.childFirstName[0]}{reg.childLastName[0]}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold font-serif truncate">
                {reg.childFirstName} {reg.childLastName}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Registered {format(new Date(reg.createdAt), "MMM d, yyyy")}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {reg.room && (
                  <Badge variant="outline" className="text-xs">{reg.room}</Badge>
                )}
                {reg.allergies && (
                  <Badge className="text-xs bg-red-100 text-red-800 border-none hover:bg-red-100 gap-1">
                    <AlertTriangle className="w-3 h-3" /> Allergy
                  </Badge>
                )}
                {reg.specialNeeds && (
                  <Badge className="text-xs bg-amber-100 text-amber-800 border-none hover:bg-amber-100 gap-1">
                    <Info className="w-3 h-3" /> Special Needs
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
            {/* Child / participant info */}
            <section className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {isChildCheckin ? "Child Information" : "Participant Information"}
              </p>
              {age && (
                <div className="flex justify-between text-sm py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Date of Birth</span>
                  <span>{format(new Date(reg.childDateOfBirth! + "T00:00:00"), "MMM d, yyyy")} · {age}</span>
                </div>
              )}
              {isChildCheckin && rooms && rooms.length > 0 && (
                <div className="flex justify-between items-center text-sm py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Room / Group</span>
                  <Select
                    value={reg.room ?? "__none__"}
                    disabled={assigningRoom || updateRoom.isPending}
                    onValueChange={(v) => {
                      setAssigningRoom(true);
                      updateRoom.mutate({ registrationId: reg.id, data: { room: v === "__none__" ? null : v } });
                    }}
                  >
                    <SelectTrigger className="h-7 w-auto min-w-28 text-xs border-dashed">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Unassigned</SelectItem>
                      {rooms.filter((r) => r.isActive).map((r) => (
                        <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {(!isChildCheckin || !rooms?.length) && reg.room && (
                <div className="flex justify-between text-sm py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Room / Group</span>
                  <span>{reg.room}</span>
                </div>
              )}
              {reg.allergies && (
                <div className="space-y-1 py-1">
                  <p className="text-xs text-muted-foreground">Allergies</p>
                  <p className="text-sm bg-red-50 text-red-900 rounded-md px-3 py-2">{reg.allergies}</p>
                </div>
              )}
              {reg.specialNeeds && (
                <div className="space-y-1 py-1">
                  <p className="text-xs text-muted-foreground">Special Needs / Accommodations</p>
                  <p className="text-sm bg-amber-50 text-amber-900 rounded-md px-3 py-2">{reg.specialNeeds}</p>
                </div>
              )}
              {!age && !reg.room && !reg.allergies && !reg.specialNeeds && (
                <p className="text-sm text-muted-foreground">No additional details on record.</p>
              )}
            </section>

            {/* Guardian / contact */}
            {(reg.guardianName || reg.guardianPhone || reg.guardianEmail) && (
              <section className="space-y-2.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {isChildCheckin ? "Parent / Guardian" : "Contact"}
                </p>
                {reg.guardianName && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <User className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span>{reg.guardianName}</span>
                  </div>
                )}
                {reg.guardianPhone && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                    <a href={`tel:${reg.guardianPhone}`} className="hover:underline">{reg.guardianPhone}</a>
                  </div>
                )}
                {reg.guardianEmail && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                    <a href={`mailto:${reg.guardianEmail}`} className="hover:underline truncate">{reg.guardianEmail}</a>
                  </div>
                )}
              </section>
            )}

            {/* Custom answers */}
            {(regDetail?.customAnswers?.length ?? 0) > 0 && (
              <section className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Additional Information</p>
                {regDetail!.customAnswers.map((a) => (
                  <div key={a.id} className="py-1.5 border-b border-border/50 last:border-0">
                    <p className="text-xs text-muted-foreground">{a.fieldLabel}</p>
                    <p className="text-sm mt-0.5">{a.value}</p>
                  </div>
                ))}
              </section>
            )}
          </div>

          {/* Footer */}
          <div className="border-t p-4 shrink-0 flex gap-2">
            <Button variant="outline" className="flex-1 gap-2" onClick={() => setEditOpen(true)}>
              <Pencil className="w-4 h-4" /> Edit
            </Button>
            <Button
              variant="outline"
              className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
              onClick={() => { setDeleteConfirm(""); setDeleteOpen(true); }}
            >
              <Trash2 className="w-4 h-4" /> Delete
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <RegistrationEditDialog
        key={reg.id}
        reg={reg}
        open={editOpen}
        onOpenChange={handleEditClose}
        onSaved={() => {}}
        isChildCheckin={isChildCheckin}
      />

      <Dialog open={deleteOpen} onOpenChange={(v) => { if (!deleteRegistration.isPending) setDeleteOpen(v); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" /> Delete Registration
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <p className="text-sm text-muted-foreground">
              This will permanently delete the registration for{" "}
              <span className="font-semibold text-foreground">{reg.childFirstName} {reg.childLastName}</span>.
              This action cannot be undone.
            </p>
            <div className="space-y-1.5">
              <Label className="text-sm">Type <span className="font-mono font-bold">DELETE</span> to confirm</Label>
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteRegistration.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirm !== "DELETE" || deleteRegistration.isPending}
              onClick={() => deleteRegistration.mutate({ registrationId: reg.id })}
              className="gap-2"
            >
              {deleteRegistration.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Delete Registration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Registrations list ────────────────────────────────────────────────────────

type RegistrationsViewMode = "individuals" | "families";
type RegistrationsSort = "date" | "name" | "family" | "room";

interface RegistrationFamilyGroup {
  key: string;
  familyName: string;
  guardianName: string;
  guardianPhone: string;
  children: Registration[];
}

function getRegistrationFamilyLastName(reg: Registration): string {
  const source = reg.guardianName || reg.childLastName || "Family";
  return source.trim().split(/\s+/).slice(-1)[0] || "Family";
}

function getRegistrationFamilyKey(reg: Registration): string {
  if (reg.registrationGroupId != null) return `group-${reg.registrationGroupId}`;

  const guardianId = (reg as Registration & { guardianId?: number | null }).guardianId;
  if (guardianId != null) return `guardian-id-${guardianId}`;

  const guardianName = (reg.guardianName ?? "").trim().toLowerCase();
  const guardianPhone = (reg.guardianPhone ?? "").replace(/\D/g, "");
  if (guardianName || guardianPhone) return `guardian-${guardianName}-${guardianPhone}`;

  return `registration-${reg.id}`;
}

function groupRegistrationsByFamily(registrations: Registration[]): RegistrationFamilyGroup[] {
  const grouped = new Map<string, Registration[]>();

  for (const reg of registrations) {
    const key = getRegistrationFamilyKey(reg);
    const items = grouped.get(key) ?? [];
    items.push(reg);
    grouped.set(key, items);
  }

  return Array.from(grouped.entries()).map(([key, children]) => {
    const first = children[0]!;
    const familyLastName = getRegistrationFamilyLastName(first);

    return {
      key,
      familyName: `${familyLastName} Family`,
      guardianName: first.guardianName || "Unknown Guardian",
      guardianPhone: first.guardianPhone || "",
      children,
    };
  });
}

function splitRegistrationName(name: string | null | undefined): { firstName: string; lastName: string } {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

interface RegistrationFamilyDetailsDialogProps {
  family: RegistrationFamilyGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditChild: (reg: Registration) => void;
  onViewChild: (reg: Registration) => void;
  onSaved: () => void;
}

function RegistrationFamilyDetailsDialog({
  family,
  open,
  onOpenChange,
  onEditChild,
  onViewChild,
  onSaved,
}: RegistrationFamilyDetailsDialogProps) {
  const { toast } = useToast();
  const updateFamily = useUpdateRegistrationFamily();
  const first = family?.children[0] ?? null;
  const primaryName = splitRegistrationName(first?.guardianName);
  const [form, setForm] = useState({
    guardianFirstName: primaryName.firstName,
    guardianLastName: primaryName.lastName,
    guardianPhone: first?.guardianPhone ?? "",
    guardianEmail: first?.guardianEmail ?? "",
    secondaryGuardianFirstName: first?.secondaryGuardianFirstName ?? "",
    secondaryGuardianLastName: first?.secondaryGuardianLastName ?? "",
    secondaryGuardianPhone: first?.secondaryGuardianPhone ?? "",
    secondaryGuardianEmail: first?.secondaryGuardianEmail ?? "",
    secondaryGuardianRelationship: first?.secondaryGuardianRelationship ?? "",
    emergencyContactName: first?.emergencyContactName ?? "",
    emergencyContactPhone: first?.emergencyContactPhone ?? "",
    emergencyContactRelationship: first?.emergencyContactRelationship ?? "",
  });
  const saving = updateFamily.isPending;

  useEffect(() => {
    if (!open || !first) return;
    const nextPrimaryName = splitRegistrationName(first.guardianName);
    setForm({
      guardianFirstName: nextPrimaryName.firstName,
      guardianLastName: nextPrimaryName.lastName,
      guardianPhone: first.guardianPhone ?? "",
      guardianEmail: first.guardianEmail ?? "",
      secondaryGuardianFirstName: first.secondaryGuardianFirstName ?? "",
      secondaryGuardianLastName: first.secondaryGuardianLastName ?? "",
      secondaryGuardianPhone: first.secondaryGuardianPhone ?? "",
      secondaryGuardianEmail: first.secondaryGuardianEmail ?? "",
      secondaryGuardianRelationship: first.secondaryGuardianRelationship ?? "",
      emergencyContactName: first.emergencyContactName ?? "",
      emergencyContactPhone: first.emergencyContactPhone ?? "",
      emergencyContactRelationship: first.emergencyContactRelationship ?? "",
    });
  }, [open, first]);

  if (!family || !first) return null;

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSave = async () => {
    try {
      await updateFamily.mutateAsync({
        data: {
          registrationIds: family.children.map((child) => child.id),
          guardianFirstName: form.guardianFirstName.trim(),
          guardianLastName: form.guardianLastName.trim(),
          guardianPhone: form.guardianPhone.trim(),
          guardianEmail: form.guardianEmail.trim(),
          secondaryGuardianFirstName: form.secondaryGuardianFirstName.trim(),
          secondaryGuardianLastName: form.secondaryGuardianLastName.trim(),
          secondaryGuardianPhone: form.secondaryGuardianPhone.trim(),
          secondaryGuardianEmail: form.secondaryGuardianEmail.trim(),
          secondaryGuardianRelationship: form.secondaryGuardianRelationship.trim(),
          emergencyContactName: form.emergencyContactName.trim(),
          emergencyContactPhone: form.emergencyContactPhone.trim(),
          emergencyContactRelationship: form.emergencyContactRelationship.trim(),
        },
      });
      toast({ title: "Family details saved" });
      onSaved();
      onOpenChange(false);
    } catch {
      toast({ title: "Failed to save family details", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!saving) onOpenChange(nextOpen); }}>
      <DialogContent className="sm:max-w-3xl flex max-h-[90vh] flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="text-xl font-serif">View Family — {family.familyName}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Primary Parent/Guardian</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>First Name</Label><Input value={form.guardianFirstName} onChange={set("guardianFirstName")} /></div>
              <div className="space-y-1.5"><Label>Last Name</Label><Input value={form.guardianLastName} onChange={set("guardianLastName")} /></div>
              <div className="space-y-1.5"><Label>Phone</Label><Input type="tel" value={form.guardianPhone} onChange={set("guardianPhone")} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.guardianEmail} onChange={set("guardianEmail")} /></div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Secondary Parent/Guardian</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>First Name</Label><Input value={form.secondaryGuardianFirstName} onChange={set("secondaryGuardianFirstName")} /></div>
              <div className="space-y-1.5"><Label>Last Name</Label><Input value={form.secondaryGuardianLastName} onChange={set("secondaryGuardianLastName")} /></div>
              <div className="space-y-1.5"><Label>Phone</Label><Input type="tel" value={form.secondaryGuardianPhone} onChange={set("secondaryGuardianPhone")} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.secondaryGuardianEmail} onChange={set("secondaryGuardianEmail")} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label>Relationship</Label><Input value={form.secondaryGuardianRelationship} onChange={set("secondaryGuardianRelationship")} placeholder="Optional" /></div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Emergency Contact</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Name</Label><Input value={form.emergencyContactName} onChange={set("emergencyContactName")} /></div>
              <div className="space-y-1.5"><Label>Phone</Label><Input type="tel" value={form.emergencyContactPhone} onChange={set("emergencyContactPhone")} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label>Relationship</Label><Input value={form.emergencyContactRelationship} onChange={set("emergencyContactRelationship")} /></div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Children</h3>
            <div className="space-y-2">
              {family.children.map((reg) => (
                <Card key={reg.id} className="group cursor-pointer transition-all hover:bg-muted/40 hover:shadow-sm" onClick={() => onViewChild(reg)}>
                  <CardContent className="px-4 py-3.5 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-serif font-bold text-sm flex-shrink-0 mt-0.5">
                      {reg.childFirstName[0]}{reg.childLastName[0]}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-semibold text-base leading-tight">{reg.childFirstName} {reg.childLastName}</span>
                        {reg.room && <Badge className="text-[10px] h-5 bg-[#FFF9EF] text-[#A85B00] border-[#E5BE57] hover:bg-[#FFF9EF] rounded-full font-semibold">{reg.room}</Badge>}
                        {reg.allergies && <Badge className="text-[10px] h-5 bg-red-100 text-red-800 border-red-200 hover:bg-red-100 rounded-full">Allergy</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">Registered {format(new Date(reg.createdAt), "MMM d")}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                      aria-label={`Edit ${reg.childFirstName} ${reg.childLastName}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditChild(reg);
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </div>

        <DialogFooter className="border-t px-6 py-4 gap-2">
          <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={saving} onClick={handleSave} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Family Details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChildrenTabContent({
  eventId,
  formId,
  embedSlug,
  isChildCheckin = true,
  onExportCsv,
  isExporting = false,
}: {
  eventId: number;
  formId?: number | null;
  embedSlug?: string | null;
  isChildCheckin?: boolean;
  onExportCsv?: () => void;
  isExporting?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [roomFilter, setRoomFilter] = useState("all");
  const [alertsOnly, setAlertsOnly] = useState(false);
  const [sort, setSort] = useState<RegistrationsSort>("date");
  const [viewMode, setViewMode] = useState<RegistrationsViewMode>("individuals");
  const [selectedReg, setSelectedReg] = useState<Registration | null>(null);
  const [editingReg, setEditingReg] = useState<Registration | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<RegistrationFamilyGroup | null>(null);
  const [addRegOpen, setAddRegOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: registrations = [], isLoading } = useListRegistrations(formId ?? 0, {
    query: { enabled: !!formId, queryKey: getListRegistrationsQueryKey(formId ?? 0) },
  });

  const rooms = useMemo(() => {
    const set = new Set(registrations.map((r) => r.room).filter((r): r is string => !!r));
    return Array.from(set).sort();
  }, [registrations]);

  const alertCount = useMemo(
    () => registrations.filter((r) => r.allergies || r.specialNeeds).length,
    [registrations]
  );

  const filtered = useMemo(() => {
    let result = registrations;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          `${r.childFirstName} ${r.childLastName}`.toLowerCase().includes(q) ||
          (r.guardianName ?? "").toLowerCase().includes(q) ||
          (r.guardianPhone ?? "").toLowerCase().includes(q) ||
          (r.secondaryGuardianFirstName ?? "").toLowerCase().includes(q) ||
          (r.secondaryGuardianLastName ?? "").toLowerCase().includes(q) ||
          (r.secondaryGuardianPhone ?? "").toLowerCase().includes(q) ||
          (r.secondaryGuardianEmail ?? "").toLowerCase().includes(q) ||
          (r.secondaryGuardianRelationship ?? "").toLowerCase().includes(q) ||
          (r.room ?? "").toLowerCase().includes(q) ||
          (r.allergies ?? "").toLowerCase().includes(q) ||
          (r.specialNeeds ?? "").toLowerCase().includes(q) ||
          (r.medicalNotes ?? "").toLowerCase().includes(q)
      );
    }
    if (roomFilter !== "all") result = result.filter((r) => r.room === roomFilter);
    if (alertsOnly) result = result.filter((r) => r.allergies || r.specialNeeds);
    result = [...result].sort((a, b) => {
      if (sort === "name") {
        return `${a.childLastName} ${a.childFirstName}`.localeCompare(`${b.childLastName} ${b.childFirstName}`);
      }
      if (sort === "family") {
        return `${getRegistrationFamilyLastName(a)} ${a.guardianName ?? ""} ${a.childLastName} ${a.childFirstName}`
          .localeCompare(`${getRegistrationFamilyLastName(b)} ${b.guardianName ?? ""} ${b.childLastName} ${b.childFirstName}`);
      }
      if (sort === "room") {
        return `${a.room ?? ""} ${a.childLastName} ${a.childFirstName}`
          .localeCompare(`${b.room ?? ""} ${b.childLastName} ${b.childFirstName}`);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return result;
  }, [registrations, search, roomFilter, alertsOnly, sort]);

  const familyGroups = useMemo(() => {
    const groups = groupRegistrationsByFamily(filtered).map((group) => ({
      ...group,
      children: [...group.children].sort((a, b) => {
        if (sort === "room") {
          return `${a.room ?? ""} ${a.childLastName} ${a.childFirstName}`
            .localeCompare(`${b.room ?? ""} ${b.childLastName} ${b.childFirstName}`);
        }
        if (sort === "date") {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return `${a.childLastName} ${a.childFirstName}`.localeCompare(`${b.childLastName} ${b.childFirstName}`);
      }),
    }));

    return groups.sort((a, b) => {
      if (sort === "date") {
        const newestA = Math.max(...a.children.map((child) => new Date(child.createdAt).getTime()));
        const newestB = Math.max(...b.children.map((child) => new Date(child.createdAt).getTime()));
        return newestB - newestA;
      }
      if (sort === "room") {
        const roomA = a.children[0]?.room ?? "";
        const roomB = b.children[0]?.room ?? "";
        return `${roomA} ${a.familyName}`.localeCompare(`${roomB} ${b.familyName}`);
      }
      return `${getRegistrationFamilyLastName(a.children[0]!)} ${a.guardianName}`
        .localeCompare(`${getRegistrationFamilyLastName(b.children[0]!)} ${b.guardianName}`);
    });
  }, [filtered, sort]);

  const handleViewModeChange = (mode: RegistrationsViewMode) => {
    setViewMode(mode);
    setSort(mode === "families" ? "family" : "date");
  };
  const visibleRegistrantLabel = isChildCheckin
    ? filtered.length === 1 ? "child" : "children"
    : filtered.length === 1 ? "registrant" : "registrants";

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold">Registrations</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Search and manage everyone registered for this event.
          </p>
        </div>
        {onExportCsv && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={onExportCsv}
              disabled={isExporting}
              className="text-muted-foreground hover:text-foreground gap-1.5"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
          </div>
        )}
      </div>

      {/* Search + Add */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-11 h-12 text-base"
            placeholder={isChildCheckin ? "Search by name, guardian, phone, or room…" : "Search by name or contact…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button className="shrink-0 gap-2 h-12 px-5 text-base font-semibold" onClick={() => setAddRegOpen(true)}>
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">{isChildCheckin ? "Add Child" : "Add Registrant"}</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex h-9 rounded-md border border-border bg-background p-0.5">
          {(["individuals", "families"] as RegistrationsViewMode[]).map((mode) => {
            const active = viewMode === mode;
            return (
              <button
                key={mode}
                type="button"
                className={cn(
                  "h-8 rounded-[5px] px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => handleViewModeChange(mode)}
              >
                {mode === "individuals" ? "Individuals" : "Families"}
              </button>
            );
          })}
        </div>
        {rooms.length > 0 && (
          <Select value={roomFilter} onValueChange={setRoomFilter}>
            <SelectTrigger className="h-9 text-sm w-auto min-w-[120px]">
              <SelectValue placeholder="All rooms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All rooms</SelectItem>
              {rooms.map((room) => (
                <SelectItem key={room} value={room}>{room}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {alertCount > 0 && (
          <button
            type="button"
            onClick={() => setAlertsOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-sm font-medium border transition-colors ${
              alertsOnly
                ? "bg-red-50 text-red-700 border-red-200"
                : "bg-background text-muted-foreground border-border hover:border-red-200 hover:text-red-700"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Alerts only
            <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${alertsOnly ? "bg-red-100" : "bg-muted"}`}>
              {alertCount}
            </span>
          </button>
        )}
        <Select value={sort} onValueChange={(v) => setSort(v as RegistrationsSort)}>
          <SelectTrigger className="h-9 text-sm w-auto min-w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Newest first</SelectItem>
            <SelectItem value="name">Child name</SelectItem>
            <SelectItem value="family">Family name</SelectItem>
            <SelectItem value="room">Room / group</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground ml-auto">
          {viewMode === "families"
            ? `${familyGroups.length} ${familyGroups.length === 1 ? "family" : "families"} · ${filtered.length} ${visibleRegistrantLabel}`
            : filtered.length !== registrations.length
              ? `${filtered.length} of ${registrations.length} `
              : `${registrations.length} `}
          {viewMode === "individuals" && (
            registrations.length === 1
              ? isChildCheckin ? "child" : "registrant"
              : isChildCheckin ? "children" : "registrants"
          )}
        </p>
      </div>

      {/* Registration cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : !registrations.length ? (
        <Card>
          <CardContent className="py-14 text-center text-muted-foreground">
            {isChildCheckin
              ? <Baby className="w-10 h-10 mx-auto mb-3 opacity-30" />
              : <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />}
            <p className="font-medium">No registrations yet</p>
            <p className="text-sm mt-1">
              Use "{isChildCheckin ? "Add Child" : "Add Registrant"}" above to add the first one.
            </p>
          </CardContent>
        </Card>
      ) : !filtered.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-sm">No registrations match the current filters.</p>
          </CardContent>
        </Card>
      ) : viewMode === "families" ? (
        <div className="space-y-3">
          {familyGroups.map((family) => (
            <div
              key={family.key}
              className="overflow-hidden rounded-xl border-2 border-slate-300 shadow-sm dark:border-slate-600"
            >
              <div className="border-b border-blue-100 bg-blue-50 px-4 py-3 dark:border-blue-900/40 dark:bg-blue-950/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Users className="w-4 h-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                      <span className="font-semibold text-base">{family.familyName}</span>
                      <Badge variant="secondary" className="text-xs">
                        {family.children.length} {family.children.length === 1 ? (isChildCheckin ? "child" : "registrant") : (isChildCheckin ? "children" : "registrants")}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {isChildCheckin ? "Guardian" : "Contact"}: {family.guardianName}
                      {family.guardianPhone && <> · {family.guardianPhone}</>}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0 gap-1.5 text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFamily(family);
                    }}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                    <span className="hidden sm:inline">View Family</span>
                  </Button>
                </div>
              </div>

              <div className="space-y-2 bg-muted/20 p-3">
                {family.children.map((reg) => {
                  const hasAlert = !!(reg.allergies || reg.specialNeeds || reg.medicalNotes);

                  return (
                    <Card
                      key={reg.id}
                      className="cursor-pointer transition-all hover:bg-muted/40 hover:shadow-sm group"
                      onClick={() => setSelectedReg(reg)}
                    >
                      <CardContent className="px-4 py-3.5 flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-serif font-bold text-sm flex-shrink-0 mt-0.5">
                          {reg.childFirstName[0]}{reg.childLastName[0]}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="font-semibold text-base leading-tight">{reg.childFirstName} {reg.childLastName}</span>
                            {reg.room && (
                              <Badge className="text-[10px] h-5 bg-[#FFF9EF] text-[#A85B00] border-[#E5BE57] hover:bg-[#FFF9EF] rounded-full font-semibold">{reg.room}</Badge>
                            )}
                            {reg.allergies && (
                              <Badge className="text-[10px] h-5 bg-red-100 text-red-800 border-red-200 hover:bg-red-100 rounded-full">Allergy</Badge>
                            )}
                            {reg.specialNeeds && (
                              <Badge className="text-[10px] h-5 bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 rounded-full">Medical</Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <span>Registered {format(new Date(reg.createdAt), "MMM d")}</span>
                            {hasAlert && (
                              <span className="inline-flex items-center gap-1 text-red-700">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Alert
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0 pt-2">
                          <Pencil className="w-3.5 h-3.5" />
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((reg) => {
            const registrantName = `${reg.childFirstName} ${reg.childLastName}`.trim();
            const contactParts = isChildCheckin
              ? [
                  reg.guardianName || "—",
                  reg.guardianPhone,
                ]
              : [
                  reg.guardianName && reg.guardianName !== registrantName ? reg.guardianName : null,
                  reg.guardianPhone,
                  reg.guardianEmail,
                ];
            const contactText = contactParts.filter(Boolean).join(" · ") || "—";

            return (
            <Card
              key={reg.id}
              className="cursor-pointer transition-all hover:bg-muted/40 hover:shadow-sm group"
              onClick={() => setSelectedReg(reg)}
            >
              <CardContent className="px-4 py-4 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-serif font-bold text-sm flex-shrink-0 mt-0.5">
                  {reg.childFirstName[0]}{reg.childLastName[0]}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="font-semibold text-base leading-tight">{reg.childFirstName} {reg.childLastName}</span>
                    {reg.room && (
                      <Badge className="text-[10px] h-5 bg-[#FFF9EF] text-[#A85B00] border-[#E5BE57] hover:bg-[#FFF9EF] rounded-full font-semibold">{reg.room}</Badge>
                    )}
                    {reg.allergies && (
                      <Badge className="text-[10px] h-5 bg-red-100 text-red-800 border-red-200 hover:bg-red-100 rounded-full">Allergy</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
                    <span>
                      <span className="font-medium text-foreground/80">
                        {isChildCheckin ? "Parent/Guardian:" : "Contact:"}
                      </span>{" "}
                      {contactText}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(reg.createdAt), "MMM d")}
                  </span>
                  <div className="flex items-center gap-1 text-muted-foreground group-hover:text-foreground transition-colors">
                    <span className="text-xs hidden sm:block opacity-0 group-hover:opacity-60 transition-opacity">View</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      {selectedReg && (
        <RegistrationDetailSheet
          reg={selectedReg}
          open={!!selectedReg}
          onOpenChange={(v) => { if (!v) setSelectedReg(null); }}
          isChildCheckin={isChildCheckin}
          formId={formId}
          eventId={eventId}
        />
      )}

      <RegistrationFamilyDetailsDialog
        family={selectedFamily}
        open={!!selectedFamily}
        onOpenChange={(v) => { if (!v) setSelectedFamily(null); }}
        onEditChild={(reg) => {
          setSelectedFamily(null);
          setEditingReg(reg);
        }}
        onViewChild={(reg) => {
          setSelectedFamily(null);
          setSelectedReg(reg);
        }}
        onSaved={() => {
          if (formId) queryClient.invalidateQueries({ queryKey: getListRegistrationsQueryKey(formId) });
          queryClient.invalidateQueries({ queryKey: getListChildrenQueryKey() });
        }}
      />

      {editingReg && (
        <RegistrationEditDialog
          reg={editingReg}
          open={!!editingReg}
          onOpenChange={(v) => { if (!v) setEditingReg(null); }}
          isChildCheckin={isChildCheckin}
          onSaved={() => {
            if (formId) queryClient.invalidateQueries({ queryKey: getListRegistrationsQueryKey(formId) });
            queryClient.invalidateQueries({ queryKey: getListChildrenQueryKey() });
            setEditingReg(null);
          }}
        />
      )}

      <ManualRegistrationDialog
        formId={formId}
        embedSlug={embedSlug}
        isChildCheckin={isChildCheckin}
        eventId={eventId}
        open={addRegOpen}
        onOpenChange={setAddRegOpen}
      />
    </div>
  );
}

// ─── Families tab ─────────────────────────────────────────────────────────────

function FamiliesTabContent({ eventId }: { eventId: number }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: children, isLoading } = useListChildren({ eventId, search: debouncedSearch || undefined });

  const families = useMemo(() => {
    if (!children) return [];
    const map = new Map<string, typeof children>();
    for (const child of children) {
      const key = child.guardianName ?? "Unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(child);
    }
    return [...map.entries()].map(([guardian, members]) => ({ guardian, members }));
  }, [children]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search families…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <p className="text-sm text-muted-foreground shrink-0">
          {families.length} {families.length === 1 ? "family" : "families"}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : !families.length ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p>{search ? `No families matching "${search}"` : "No registrants yet."}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {families.map(({ guardian, members }) => (
            <Card key={guardian}>
              <CardContent className="px-4 py-3">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-serif font-bold text-primary text-sm flex-shrink-0">
                    {guardian[0]}
                  </div>
                  <p className="font-medium">{guardian}</p>
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {members.length} {members.length === 1 ? "member" : "members"}
                  </Badge>
                </div>
                <div className="ml-12 space-y-0.5">
                  {members.map((m) => (
                    <p key={m.id} className="text-sm text-muted-foreground">{m.firstName} {m.lastName}</p>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Check-In Confirm Dialog ───────────────────────────────────────────────────

function CheckInConfirmDialog({
  reg,
  open,
  onConfirm,
  onCancel,
  isPending,
}: {
  reg: Registration;
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !isPending) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Medical Alert — Check In {reg.childFirstName} {reg.childLastName}?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          {reg.allergies && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">Allergies</p>
              <p className="text-sm text-red-800">{reg.allergies}</p>
            </div>
          )}
          {reg.specialNeeds && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Medical / Special Needs</p>
              <p className="text-sm text-blue-800">{reg.specialNeeds}</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground pt-1">
            Please review the above notes with the supervising volunteer before checking in this child.
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isPending}>Cancel</Button>
          <Button onClick={onConfirm} disabled={isPending} className="gap-2">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            Check In Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Check-Out Dialog ──────────────────────────────────────────────────────────

function CheckOutDialog({
  reg,
  checkin,
  open,
  onConfirm,
  onCancel,
  isPending,
}: {
  reg: Registration;
  checkin: EventCheckin;
  open: boolean;
  onConfirm: (pickupPersonName: string, notes: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [pickupPerson, setPickupPerson] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch registration detail to get authorized pickup names
  const { data: regDetail } = useGetRegistration(reg.id, {
    query: { enabled: open, queryKey: [`/api/registrations/${reg.id}`] },
  });

  const authorizedPickup = regDetail?.customAnswers?.find(
    (a) => a.fieldLabel.toLowerCase().includes("pickup")
  )?.value ?? null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !isPending) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
            Check Out — {reg.childFirstName} {reg.childLastName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          {/* Child info */}
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Guardian</span>
              <span className="font-medium">{reg.guardianName}</span>
            </div>
            {reg.guardianPhone && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone</span>
                <span className="font-medium">{reg.guardianPhone}</span>
              </div>
            )}
            {reg.room && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Room</span>
                <span className="font-medium">{reg.room}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1 border-t border-border">
              <span className="text-muted-foreground">Pickup Code</span>
              <span className="font-mono font-bold tracking-widest text-green-700 bg-green-100 px-2 py-0.5 rounded text-base">
                {checkin.labelCode}
              </span>
            </div>
          </div>

          {/* Alerts */}
          {reg.allergies && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-red-700">Allergy Alert</p>
                <p className="text-xs text-red-700">{reg.allergies}</p>
              </div>
            </div>
          )}

          {/* Authorized pickup names */}
          {authorizedPickup && (
            <div className="rounded-lg border border-border px-3 py-2.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Authorized Pickup</p>
              <p className="text-sm">{authorizedPickup}</p>
            </div>
          )}

          {/* Pickup person input */}
          <div className="space-y-1.5">
            <Label htmlFor="pickup-person" className="text-sm font-medium">
              Who is picking up? <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="pickup-person"
              placeholder="Enter name of person picking up"
              value={pickupPerson}
              onChange={(e) => setPickupPerson(e.target.value)}
              disabled={isPending}
              autoFocus
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="checkout-notes" className="text-sm font-medium">
              Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="checkout-notes"
              placeholder="Any notes for this checkout…"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isPending}
              className="resize-none"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isPending}>Cancel</Button>
          <Button
            onClick={() => onConfirm(pickupPerson.trim(), notes.trim())}
            disabled={isPending}
            className="gap-2 border-amber-400 bg-amber-500 text-white hover:bg-amber-600"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            Confirm Check-Out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Registration Edit Dialog ────────────────────────────────────────────────

function RegistrationEditDialog({
  reg,
  open,
  onOpenChange,
  onSaved,
  isChildCheckin = true,
}: {
  reg: Registration;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  isChildCheckin?: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { id: _regEditEventIdStr } = useParams<{ id: string }>();
  const _regEditEventId = parseInt(_regEditEventIdStr || "0", 10);
  const { data: rooms } = useListRooms(_regEditEventId, {
    query: { enabled: !!_regEditEventId, queryKey: getListRoomsQueryKey(_regEditEventId) },
  });

  const [tab, setTab] = useState("child");
  useEffect(() => { if (open) setTab("child"); }, [open]);

  const guardianParts = (reg.guardianName ?? "").trim().split(/\s+/);
  const [form, setForm] = useState({
    childFirstName: reg.childFirstName,
    childLastName: reg.childLastName,
    childDateOfBirth: reg.childDateOfBirth ?? "",
    guardianFirstName: guardianParts[0] ?? "",
    guardianLastName: guardianParts.slice(1).join(" "),
    guardianPhone: reg.guardianPhone ?? "",
    guardianEmail: reg.guardianEmail ?? "",
    allergies: reg.allergies ?? "",
    medicalNotes: reg.medicalNotes ?? "",
    specialNeeds: reg.specialNeeds ?? "",
    emergencyContactName: reg.emergencyContactName ?? "",
    emergencyContactPhone: reg.emergencyContactPhone ?? "",
    emergencyContactRelationship: reg.emergencyContactRelationship ?? "",
    room: reg.room ?? "",
  });

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

  // Custom answers (for Additional Questions tab)
  const { data: regDetail, isLoading: detailLoading } = useGetRegistration(reg.id, {
    query: { enabled: open, queryKey: [`/api/registrations/${reg.id}`] },
  });
  const [customEdits, setCustomEdits] = useState<Record<number, string>>({});
  useEffect(() => {
    if (regDetail?.customAnswers) {
      const edits: Record<number, string> = {};
      for (const ca of regDetail.customAnswers) edits[ca.id] = ca.value;
      setCustomEdits(edits);
    }
  }, [regDetail]);

  const isPickupRelated = (label: string) => {
    const l = label.toLowerCase();
    return l.includes("authorized pickup") || l.includes("pickup name") ||
      l.includes("unauthorized") || l.includes("not authorized") || l.includes("not allowed");
  };
  const pickupAnswers = useMemo(
    () => (regDetail?.customAnswers ?? []).filter((ca) => isPickupRelated(ca.fieldLabel)),
    [regDetail]
  );
  const additionalAnswers = useMemo(
    () => (regDetail?.customAnswers ?? []).filter((ca) => !isPickupRelated(ca.fieldLabel)),
    [regDetail]
  );

  const updateRegistration = useUpdateRegistration();
  const updateCustomAnswers = useUpdateRegistrationCustomAnswers();
  const isPending = updateRegistration.isPending || updateCustomAnswers.isPending;
  const registrantInfoLabel = isChildCheckin ? "Child Info" : "Registrant Info";
  const contactLabel = isChildCheckin ? "Guardian" : "Contact";
  const safetySectionLabel = isChildCheckin ? "Safety Information" : "Health / Accessibility";
  const contactName = [form.guardianFirstName, form.guardianLastName].filter(Boolean).join(" ").trim();
  const registrantName = `${form.childFirstName} ${form.childLastName}`.trim();
  const shouldShowContactNameInSummary = isChildCheckin || (contactName && contactName !== registrantName);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateRegistration.mutateAsync({
        registrationId: reg.id,
        data: {
          childFirstName: form.childFirstName.trim() || undefined,
          childLastName: form.childLastName.trim() || undefined,
          childDateOfBirth: form.childDateOfBirth || undefined,
          guardianFirstName: form.guardianFirstName.trim() || undefined,
          guardianLastName: form.guardianLastName.trim() || undefined,
          guardianPhone: form.guardianPhone.trim() || undefined,
          guardianEmail: form.guardianEmail.trim() || undefined,
          allergies: form.allergies.trim(),
          medicalNotes: form.medicalNotes.trim(),
          specialNeeds: form.specialNeeds.trim(),
          emergencyContactName: form.emergencyContactName.trim(),
          emergencyContactPhone: form.emergencyContactPhone.trim(),
          emergencyContactRelationship: form.emergencyContactRelationship.trim(),
          room: form.room || undefined,
        },
      });
      const changedAnswers = Object.entries(customEdits)
        .filter(([id, val]) => {
          const orig = regDetail?.customAnswers.find((ca) => ca.id === Number(id));
          return orig && orig.value !== val;
        })
        .map(([id, value]) => ({ id: Number(id), value }));
      if (changedAnswers.length > 0) {
        await updateCustomAnswers.mutateAsync({ registrationId: reg.id, data: { answers: changedAnswers } });
      }
      queryClient.invalidateQueries({ queryKey: getListRegistrationsQueryKey(reg.formId) });
      queryClient.invalidateQueries({ queryKey: getListChildrenQueryKey() });
      queryClient.invalidateQueries({ queryKey: [`/api/registrations/${reg.id}`] });
      toast({ title: "Changes saved" });
      onSaved();
      onOpenChange(false);
    } catch {
      toast({ title: "Failed to save changes", variant: "destructive" });
    }
  };

  const tabTriggerClass = "rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 sm:px-4 h-full text-xs sm:text-sm font-medium";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isPending) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-2xl flex flex-col p-0 gap-0 max-h-[90vh] overflow-hidden">

        {/* ── Header: title + summary ── */}
        <div className="px-6 pt-5 pb-3 shrink-0 border-b">
          <DialogTitle className="text-xl font-serif mb-3">Edit Registrant</DialogTitle>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold leading-tight">{reg.childFirstName} {reg.childLastName}</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {[
                  form.room && `Room: ${form.room}`,
                  shouldShowContactNameInSummary
                    ? `${contactLabel}: ${contactName}`
                    : !isChildCheckin && form.guardianPhone
                      ? `Contact: ${form.guardianPhone}`
                      : null,
                ].filter(Boolean).join(" · ")}
              </p>
            </div>
            {(form.allergies || form.medicalNotes || form.specialNeeds) && (
              <div className="flex gap-1.5 flex-wrap justify-end shrink-0">
                {form.allergies && <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">Allergy</Badge>}
                {form.medicalNotes && <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-[10px] px-1.5 py-0.5">Medical</Badge>}
                {form.specialNeeds && <Badge className="bg-blue-500 hover:bg-blue-500 text-white text-[10px] px-1.5 py-0.5">Special Needs</Badge>}
              </div>
            )}
          </div>
        </div>

        {/* ── Tabs + form ── */}
        <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 min-h-0">

          {/* Tab bar */}
          <div className="px-6 border-b shrink-0">
            <TabsList className="rounded-none bg-transparent p-0 h-10 w-full justify-start gap-0">
              <TabsTrigger value="child" className={tabTriggerClass}>{registrantInfoLabel}</TabsTrigger>
              <TabsTrigger value="guardian" className={tabTriggerClass}>{contactLabel}</TabsTrigger>
              <TabsTrigger value="emergency" className={tabTriggerClass}>Emergency</TabsTrigger>
              <TabsTrigger value="additional" className={tabTriggerClass}>
                Additional
                {additionalAnswers.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold px-1.5 py-0.5 leading-none">{additionalAnswers.length}</span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            {/* Scrollable tab content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">

              {/* ── Registrant Info ── */}
              <TabsContent value="child" className="mt-0 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label>First Name</Label><Input value={form.childFirstName} onChange={set("childFirstName")} /></div>
                  <div className="space-y-1.5"><Label>Last Name</Label><Input value={form.childLastName} onChange={set("childLastName")} /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{isChildCheckin ? "Date of Birth" : "Birthdate"}</Label>
                    <Input type="date" value={form.childDateOfBirth} onChange={set("childDateOfBirth")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Room / Group</Label>
                    {rooms && rooms.length > 0 ? (
                      <Select value={form.room || "__none__"} onValueChange={(v) => setForm((p) => ({ ...p, room: v === "__none__" ? "" : v }))}>
                        <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Unassigned</SelectItem>
                          {rooms.map((r) => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={form.room} onChange={set("room")} placeholder="Room name" />
                    )}
                  </div>
                </div>

                {/* Safety section */}
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <p className="text-sm font-semibold text-amber-800">{safetySectionLabel}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Allergies</Label>
                    <Textarea value={form.allergies} onChange={set("allergies")} placeholder="e.g. peanuts, latex" rows={2} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Medical Notes</Label>
                    <Textarea value={form.medicalNotes} onChange={set("medicalNotes")} placeholder="Any diagnoses, medications, or medical considerations…" rows={2} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Special Needs / Accommodations</Label>
                    <Textarea value={form.specialNeeds} onChange={set("specialNeeds")} placeholder="Describe any special needs or accommodations required…" rows={2} />
                  </div>
                </div>
              </TabsContent>

              {/* ── Contact ── */}
              <TabsContent value="guardian" className="mt-0 space-y-4">
                <p className="text-sm text-muted-foreground">
                  {isChildCheckin
                    ? "Parent or guardian details for pickup and communication."
                    : "Contact details for this registrant."}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label>First Name</Label><Input value={form.guardianFirstName} onChange={set("guardianFirstName")} /></div>
                  <div className="space-y-1.5"><Label>Last Name</Label><Input value={form.guardianLastName} onChange={set("guardianLastName")} /></div>
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input type="tel" value={form.guardianPhone} onChange={set("guardianPhone")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={form.guardianEmail} onChange={set("guardianEmail")} />
                </div>
                {pickupAnswers.length > 0 && (
                  <div className="pt-3 border-t border-border space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pickup Authorization</p>
                    {pickupAnswers.map((ca) => (
                      <div key={ca.id} className="space-y-1.5">
                        <Label>{ca.fieldLabel}</Label>
                        <Textarea
                          value={customEdits[ca.id] ?? ca.value}
                          onChange={(e) => setCustomEdits((p) => ({ ...p, [ca.id]: e.target.value }))}
                          rows={2}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ── Emergency Contact ── */}
              <TabsContent value="emergency" className="mt-0 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label>Name</Label><Input value={form.emergencyContactName} onChange={set("emergencyContactName")} placeholder="Full name" /></div>
                  <div className="space-y-1.5"><Label>Relationship</Label><Input value={form.emergencyContactRelationship} onChange={set("emergencyContactRelationship")} placeholder="e.g. Aunt, Neighbor" /></div>
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input type="tel" value={form.emergencyContactPhone} onChange={set("emergencyContactPhone")} placeholder="(555) 000-0000" />
                </div>
              </TabsContent>

              {/* ── Additional Questions ── */}
              <TabsContent value="additional" className="mt-0">
                {detailLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                ) : additionalAnswers.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <p className="text-sm">No additional questions for this registration.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {additionalAnswers.map((ca) => (
                      <div key={ca.id} className="space-y-1.5">
                        <Label>{ca.fieldLabel}</Label>
                        <Textarea
                          value={customEdits[ca.id] ?? ca.value}
                          onChange={(e) => setCustomEdits((p) => ({ ...p, [ca.id]: e.target.value }))}
                          rows={2}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

            </div>

            {/* ── Sticky footer ── */}
            <div className="border-t px-6 py-4 shrink-0 flex items-center justify-end gap-3 bg-background">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
              <Button type="submit" disabled={isPending} className="gap-2">
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        </Tabs>

      </DialogContent>
    </Dialog>
  );
}

// ─── Child Detail Sheet ──────────────────────────────────────────────────────

function ChildDetailSheet({
  open,
  onOpenChange,
  reg,
  checkin,
  allCheckins,
  eventId,
  labelType,
  requireCheckout,
  onCheckin,
  onCheckout,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reg: Registration;
  checkin: EventCheckin | undefined;
  allCheckins: EventCheckin[];
  eventId: number;
  labelType: string;
  requireCheckout: boolean;
  onCheckin: () => void;
  onCheckout: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState("");
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const { data: regDetail } = useGetRegistration(reg.id, {
    query: { enabled: open, queryKey: [`/api/registrations/${reg.id}`] },
  });

  const updateCheckin = useUpdateCheckin({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEventCheckinsQueryKey(eventId) });
        toast({ title: "Note saved" });
        setShowNoteForm(false);
        setNoteText("");
      },
      onError: () => toast({ title: "Failed to save note", variant: "destructive" }),
    },
  });

  useEffect(() => {
    if (open) {
      setShowNoteForm(false);
      setEditOpen(false);
      setNoteText(checkin?.notes ?? "");
    }
  }, [open, reg.id, checkin?.id]);

  const status: Exclude<DeskFilter, "all"> = !checkin
    ? "not_checked_in"
    : !checkin.checkoutAt
    ? "checked_in"
    : "checked_out";

  const age = reg.childDateOfBirth
    ? (() => {
        const birth = new Date(reg.childDateOfBirth);
        const today = new Date();
        let years = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) years--;
        if (years === 0) {
          const months =
            (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
          return `${months < 0 ? 0 : months} mo`;
        }
        return `${years} yr`;
      })()
    : null;

  const customAnswers = regDetail?.customAnswers ?? [];
  const findAnswer = (...keywords: string[]) =>
    customAnswers.find((a) => keywords.some((kw) => a.fieldLabel.toLowerCase().includes(kw)))?.value ?? null;

  const emergencyContactName = findAnswer("emergency contact", "emergency name");
  const emergencyContactPhone = findAnswer("emergency phone", "emergency contact phone");
  const authorizedPickup = findAnswer("authorized pickup", "pickup name");
  const unauthorizedPickup = findAnswer("unauthorized", "not authorized", "not allowed");
  const secondaryGuardian = findAnswer("secondary guardian", "second guardian");
  const grade = findAnswer("grade");

  const labelData: LabelData | null = checkin
    ? {
        childName: `${reg.childFirstName} ${reg.childLastName}`,
        guardianName: reg.guardianName ?? "",
        labelCode: checkin.labelCode,
        checkinDate: checkin.checkinAt,
        room: reg.room ?? null,
        allergies: reg.allergies ?? null,
        specialNeeds: reg.specialNeeds ?? null,
      }
    : null;

  const statusColor = {
    not_checked_in: "bg-muted text-muted-foreground",
    checked_in: "bg-green-100 text-green-800",
    checked_out: "bg-amber-100 text-amber-800",
  }[status];
  const statusLabel = {
    not_checked_in: "Not Checked In",
    checked_in: "Checked In",
    checked_out: "Checked Out",
  }[status];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col p-0 gap-0">
          <SheetTitle className="sr-only">{reg.childFirstName} {reg.childLastName} — Details</SheetTitle>

          {/* Header (leave pr-12 for the built-in close button at right-4 top-4) */}
          <div className="flex items-center gap-3 px-5 pt-5 pb-4 pr-14 border-b shrink-0">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-bold font-serif flex-shrink-0 ${statusColor}`}>
              {reg.childFirstName[0]}{reg.childLastName[0]}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold font-serif leading-tight truncate">
                {reg.childFirstName} {reg.childLastName}
              </h2>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <Badge className={`text-xs ${statusColor}`}>{statusLabel}</Badge>
                {reg.room && <Badge variant="outline" className="text-xs">{reg.room}</Badge>}
                {reg.allergies && (
                  <Badge className="text-xs bg-red-100 text-red-800 border-red-200 hover:bg-red-100">Allergy</Badge>
                )}
                {reg.specialNeeds && (
                  <Badge className="text-xs bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">Medical</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-5 py-5 space-y-6">

              {/* Child Info */}
              <section className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Child Info</p>
                <div className="space-y-1.5 text-sm">
                  {reg.childDateOfBirth && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span>{format(new Date(reg.childDateOfBirth + "T00:00:00"), "MMMM d, yyyy")}</span>
                      {age && <span className="text-muted-foreground">({age} old)</span>}
                    </div>
                  )}
                  {grade && (
                    <div className="flex items-center gap-2">
                      <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span>Grade: {grade}</span>
                    </div>
                  )}
                  {reg.room && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span>Room: <span className="font-medium">{reg.room}</span></span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>Registered {format(new Date(reg.createdAt), "MMM d, yyyy")}</span>
                  </div>
                </div>
              </section>

              {/* Guardian Info */}
              {(reg.guardianName || reg.guardianPhone || reg.guardianEmail || secondaryGuardian) && (
                <section className="space-y-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Guardian</p>
                  <div className="space-y-1.5 text-sm">
                    {reg.guardianName && (
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium">{reg.guardianName}</span>
                      </div>
                    )}
                    {reg.guardianPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <a href={`tel:${reg.guardianPhone}`} className="text-primary hover:underline">
                          {reg.guardianPhone}
                        </a>
                      </div>
                    )}
                    {reg.guardianEmail && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground truncate">{reg.guardianEmail}</span>
                      </div>
                    )}
                    {secondaryGuardian && (
                      <div className="flex items-start gap-2 pt-1 border-t border-border">
                        <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Secondary Guardian</p>
                          <p>{secondaryGuardian}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Safety Info */}
              {(reg.allergies || reg.specialNeeds || emergencyContactName || emergencyContactPhone || authorizedPickup || unauthorizedPickup) && (
                <section className="space-y-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Safety</p>
                  <div className="space-y-2">
                    {reg.allergies && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                        <p className="text-xs font-bold text-red-700 uppercase tracking-wide flex items-center gap-1.5 mb-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Allergies
                        </p>
                        <p className="text-sm text-red-800">{reg.allergies}</p>
                      </div>
                    )}
                    {reg.specialNeeds && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                        <p className="text-xs font-bold text-blue-700 uppercase tracking-wide flex items-center gap-1.5 mb-1">
                          <ShieldCheck className="w-3.5 h-3.5" /> Medical / Special Needs
                        </p>
                        <p className="text-sm text-blue-800">{reg.specialNeeds}</p>
                      </div>
                    )}
                    {(emergencyContactName || emergencyContactPhone) && (
                      <div className="rounded-lg border border-border px-4 py-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                          Emergency Contact
                        </p>
                        {emergencyContactName && <p className="text-sm font-medium">{emergencyContactName}</p>}
                        {emergencyContactPhone && (
                          <a href={`tel:${emergencyContactPhone}`} className="text-sm text-primary hover:underline">
                            {emergencyContactPhone}
                          </a>
                        )}
                      </div>
                    )}
                    {authorizedPickup && (
                      <div className="rounded-lg border border-green-200 bg-green-50/50 px-4 py-3">
                        <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">
                          Authorized Pickup
                        </p>
                        <p className="text-sm text-green-800">{authorizedPickup}</p>
                      </div>
                    )}
                    {unauthorizedPickup && (
                      <div className="rounded-lg border border-red-200 bg-red-50/50 px-4 py-3">
                        <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">
                          Not Authorized for Pickup
                        </p>
                        <p className="text-sm text-red-800">{unauthorizedPickup}</p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Attendance */}
              <section className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Attendance</p>
                <div className="rounded-lg border border-border divide-y divide-border text-sm">
                  <div className="flex justify-between items-center px-4 py-2.5">
                    <span className="text-muted-foreground">Status</span>
                    <Badge className={`text-xs ${statusColor}`}>{statusLabel}</Badge>
                  </div>
                  {checkin && (
                    <>
                      <div className="flex justify-between px-4 py-2.5">
                        <span className="text-muted-foreground">Checked In</span>
                        <span className="font-medium">{format(new Date(checkin.checkinAt), "h:mm a, MMM d")}</span>
                      </div>
                      {checkin.checkoutAt && (
                        <div className="flex justify-between px-4 py-2.5">
                          <span className="text-muted-foreground">Checked Out</span>
                          <span className="font-medium">{format(new Date(checkin.checkoutAt), "h:mm a, MMM d")}</span>
                        </div>
                      )}
                      {checkin.checkoutAt && checkin.checkoutMethod === "bulk_admin" && (
                        <div className="flex justify-between px-4 py-2.5">
                          <span className="text-muted-foreground">Checkout method</span>
                          <span className="font-medium text-amber-700">Bulk checkout by admin</span>
                        </div>
                      )}
                      {checkin.checkoutMethod === "bulk_admin" && checkin.checkoutReason && (
                        <div className="flex justify-between px-4 py-2.5">
                          <span className="text-muted-foreground">Reason</span>
                          <span className="font-medium">
                            {BULK_CHECKOUT_REASON_LABELS[checkin.checkoutReason] ?? checkin.checkoutReason}
                          </span>
                        </div>
                      )}
                      {checkin.pickupPersonName && checkin.checkoutMethod !== "bulk_admin" && (
                        <div className="flex justify-between px-4 py-2.5">
                          <span className="text-muted-foreground">Picked Up By</span>
                          <span className="font-medium">{checkin.pickupPersonName}</span>
                        </div>
                      )}
                      {checkin.labelCode && (
                        <div className="flex justify-between items-center px-4 py-2.5">
                          <span className="text-muted-foreground">Pickup Code</span>
                          <span className="font-mono font-bold tracking-widest text-green-700 bg-green-100 px-2 py-0.5 rounded">
                            {checkin.labelCode}
                          </span>
                        </div>
                      )}
                      {checkin.notes && (
                        <div className="px-4 py-2.5">
                          <p className="text-xs text-muted-foreground mb-1">Notes</p>
                          <p>{checkin.notes}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
                {allCheckins.length > 1 && (
                  <div className="space-y-1 mt-1">
                    <p className="text-xs text-muted-foreground">Previous Sessions</p>
                    {allCheckins.slice(1).map((c) => (
                      <div key={c.id} className="flex justify-between text-xs text-muted-foreground rounded border border-border px-3 py-1.5">
                        <span>{format(new Date(c.checkinAt), "MMM d, h:mm a")}</span>
                        {c.checkoutAt && <span className="text-amber-700">Out {format(new Date(c.checkoutAt), "h:mm a")}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Add / Edit Note */}
              {checkin && (
                <section>
                  {!showNoteForm ? (
                    <button
                      type="button"
                      className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
                      onClick={() => setShowNoteForm(true)}
                    >
                      <StickyNote className="w-3.5 h-3.5" />
                      {checkin.notes ? "Edit note" : "Add a note"}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Note</Label>
                      <Textarea
                        placeholder="Add a note about this check-in…"
                        rows={3}
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        className="resize-none"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="gap-1.5"
                          disabled={updateCheckin.isPending}
                          onClick={() => updateCheckin.mutate({ checkinId: checkin.id, data: { notes: noteText } })}
                        >
                          {updateCheckin.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          Save Note
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowNoteForm(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </section>
              )}

            </div>
          </div>

          {/* Sticky footer */}
          <div className="border-t border-border px-5 py-4 bg-background shrink-0 space-y-2">
            <div className="flex gap-2">
              {status === "not_checked_in" && (
                <Button className="flex-1 gap-2" onClick={() => { onOpenChange(false); onCheckin(); }}>
                  <LogIn className="w-4 h-4" /> Check In
                </Button>
              )}
              {status === "checked_in" && requireCheckout && (
                <Button
                  onClick={() => { onOpenChange(false); onCheckout(); }}
                  className="flex-1 gap-2 bg-amber-500 text-white hover:bg-amber-600 border-amber-400"
                >
                  <LogOut className="w-4 h-4" /> Check Out
                </Button>
              )}
              {status === "checked_out" && (
                <Button className="flex-1 gap-2" onClick={() => { onOpenChange(false); onCheckin(); }}>
                  <LogIn className="w-4 h-4" /> Check In Again
                </Button>
              )}
              {checkin && labelData && (
                <Button variant="outline" className="flex-1 gap-2" onClick={() => setPrintOpen(true)}>
                  <Printer className="w-4 h-4" /> Print Label
                </Button>
              )}
            </div>
            <Button
              variant="ghost"
              className="w-full gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="w-4 h-4" /> Edit Info
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {labelData && (
        <LabelPrintDialog open={printOpen} onOpenChange={setPrintOpen} labels={[labelData]} />
      )}

      <RegistrationEditDialog
        key={reg.id}
        reg={reg}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={() => {}}
        isChildCheckin
      />
    </>
  );
}

// ─── End Session / Bulk Checkout dialog ──────────────────────────────────────

function EndSessionDialog({
  open,
  onOpenChange,
  eventId,
  sessionId,
  eventName,
  checkedInCount,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: number;
  sessionId?: number | null;
  eventName: string;
  checkedInCount: number;
  onSuccess: (count: number) => void;
}) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const bulkCheckout = useBulkCheckout();

  const reset = () => { setReason(""); setNote(""); setConfirm(""); };
  const canSubmit = !!reason && confirm === "CHECK OUT" && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const result = await bulkCheckout.mutateAsync({
        data: { eventId, sessionId: sessionId ?? undefined, reason, note: note || undefined },
      });
      onSuccess(result.count);
      onOpenChange(false);
      reset();
    } catch {
      toast({ title: "Bulk checkout failed — please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-serif flex items-center gap-2">
            <PowerOff className="w-5 h-5 text-destructive" />
            End Session / Check Out Remaining
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Event</span>
              <span className="font-medium">{eventName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Currently checked in</span>
              <span className="font-bold">{checkedInCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Checkout time</span>
              <span className="font-medium">
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex gap-2 text-sm text-amber-800">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>
              This will check out all children who are currently checked in. Use this only at
              the end of the event or when individual checkout was not recorded.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue placeholder="Select a reason…" /></SelectTrigger>
              <SelectContent>
                {BULK_CHECKOUT_REASONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Additional note <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any context for this bulk checkout…"
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Type <span className="font-mono font-bold">CHECK OUT</span> to confirm
            </Label>
            <Input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="CHECK OUT"
              className="font-mono"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); reset(); }}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="gap-2"
          >
            {submitting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <PowerOff className="w-4 h-4" />
            }
            Check Out All Remaining
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Check-In Desk ─────────────────────────────────────────────────────────────

type DeskFilter = "all" | "not_checked_in" | "checked_in" | "checked_out";

const DESK_FILTER_LABELS: Record<DeskFilter, string> = {
  all: "All Registered",
  not_checked_in: "Not Checked In",
  checked_in: "Checked In",
  checked_out: "Checked Out",
};

// ─── Check-In Settings ────────────────────────────────────────────────────────

type DeskDisplayMode = "standard" | "family_grouping";

function CheckinDeskSettingsDialog({
  open,
  onOpenChange,
  displayMode,
  onDisplayModeChange,
  familyCodeEnabled,
  onFamilyCodeEnabledChange,
  showFamilyCodeSetting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  displayMode: DeskDisplayMode;
  onDisplayModeChange: (mode: DeskDisplayMode) => void;
  familyCodeEnabled: boolean;
  onFamilyCodeEnabledChange: (v: boolean) => void;
  showFamilyCodeSetting: boolean;
}) {
  const options: { value: DeskDisplayMode; label: string; description: string }[] = [
    {
      value: "standard",
      label: "Standard List",
      description:
        "Show every registrant as their own card. Best when staff check people in one at a time.",
    },
    {
      value: "family_grouping",
      label: "Family Grouping",
      description:
        "Group children from the same family registration inside a shared section. Best when parents check in multiple children at once.",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Check-In Settings
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-2">
          {/* Display mode */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">Check-In List Display Mode</p>
            <div className="space-y-3">
              {options.map((opt) => {
                const active = displayMode === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                    }`}
                    onClick={() => onDisplayModeChange(opt.value)}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                          active ? "border-primary bg-primary" : "border-muted-foreground"
                        }`}
                      >
                        {active && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{opt.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Family pickup code setting — only shown for child security events */}
          {showFamilyCodeSetting && (
            <>
              <div className="border-t border-border" />
              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">Security Pickup Codes</p>
                <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-border">
                  <div className="space-y-1 flex-1 min-w-0">
                    <Label htmlFor="family-code-toggle" className="text-sm font-medium cursor-pointer">
                      Keep family pickup code the same
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Use one pickup/security code for the entire family during this event, even if siblings are checked in at different times.
                    </p>
                    <p className="text-xs text-muted-foreground/70 italic">
                      Recommended when parents may drop off siblings at different times.
                    </p>
                  </div>
                  <Switch
                    id="family-code-toggle"
                    checked={familyCodeEnabled}
                    onCheckedChange={onFamilyCodeEnabledChange}
                    className="shrink-0 mt-0.5"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Family group card for the check-in desk ──────────────────────────────────

type DeskParticipant = {
  reg: Registration;
  checkin: EventCheckin | undefined;
  status: "not_checked_in" | "checked_in" | "checked_out";
};

interface FamilyGroupDeskCardProps {
  guardian: string;
  guardianPhone: string;
  items: DeskParticipant[];
  isGroupCheckinLoading: boolean;
  loadingId: number | null;
  labelType: string;
  requireCheckout: boolean;
  onCheckinSelected: (regs: Registration[]) => void;
  onIndividualCheckin: (reg: Registration) => void;
  onOpenDetail: (regId: number) => void;
  onCheckout: (reg: Registration, checkin: EventCheckin) => void;
  onCheckoutSelected: (items: Array<{ reg: Registration; checkin: EventCheckin }>) => void;
  isGroupCheckoutLoading?: boolean;
  onUndoCheckin: (checkinId: number, regId: number) => void;
  onUndoCheckout: (checkinId: number, regId: number) => void;
  onReprint: (reg: Registration, checkin: EventCheckin) => void;
}

function FamilyGroupDeskCard({
  guardian,
  guardianPhone,
  items,
  isGroupCheckinLoading,
  loadingId,
  labelType,
  requireCheckout,
  onCheckinSelected,
  onIndividualCheckin,
  onOpenDetail,
  onCheckout,
  onCheckoutSelected,
  isGroupCheckoutLoading = false,
  onUndoCheckin,
  onUndoCheckout,
  onReprint,
}: FamilyGroupDeskCardProps) {
  const notCheckedIn = items.filter((p) => p.status === "not_checked_in");
  const checkedIn = items.filter((p) => p.status === "checked_in");

  const [selected, setSelected] = useState<Set<number>>(
    new Set(notCheckedIn.map((p) => p.reg.id))
  );
  // Track explicit deselections so newly-checked-in children are selected by default
  const [deselectedForCheckout, setDeselectedForCheckout] = useState<Set<number>>(new Set());

  const toggleChild = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleCheckoutChild = (id: number) =>
    setDeselectedForCheckout((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectedRegs = notCheckedIn.filter((p) => selected.has(p.reg.id)).map((p) => p.reg);
  const selectedForCheckoutItems = checkedIn
    .filter((p) => !deselectedForCheckout.has(p.reg.id) && p.checkin)
    .map((p) => ({ reg: p.reg, checkin: p.checkin! }));

  const familyLastName = guardian.split(" ").slice(-1)[0];
  const childCount = items.length;
  const allCheckedIn = notCheckedIn.length === 0 && checkedIn.length > 0;
  const showBatchCheckout = checkedIn.length > 1 && requireCheckout;

  return (
    <div className="rounded-xl border border-blue-200 dark:border-slate-600 shadow-sm overflow-hidden">
      {/* Family header */}
      <div className="px-3 pt-2 pb-2 bg-blue-50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-900/40">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            <Users className="w-4 h-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />
            <span className="font-semibold text-sm">{familyLastName} Family</span>
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              {childCount} {childCount === 1 ? "child" : "children"}
            </Badge>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {notCheckedIn.length > 0 && (
              <Button
                size="sm"
                className="gap-1.5 h-7 px-3 text-xs font-semibold shrink-0"
                disabled={selectedRegs.length === 0 || isGroupCheckinLoading}
                onClick={(e) => {
                  e.stopPropagation();
                  onCheckinSelected(selectedRegs);
                }}
              >
                {isGroupCheckinLoading
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <LogIn className="w-3 h-3" />}
                {selectedRegs.length === 0
                  ? "No children selected"
                  : selectedRegs.length === 1
                    ? "Check in 1 child"
                    : `Check in ${selectedRegs.length} children`}
              </Button>
            )}
            {showBatchCheckout ? (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-7 px-3 text-xs font-semibold shrink-0 border-amber-300 text-amber-800 hover:bg-amber-50 hover:border-amber-400"
                disabled={selectedForCheckoutItems.length === 0 || isGroupCheckoutLoading}
                onClick={(e) => {
                  e.stopPropagation();
                  onCheckoutSelected(selectedForCheckoutItems);
                }}
              >
                {isGroupCheckoutLoading
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <LogOut className="w-3 h-3" />}
                {selectedForCheckoutItems.length === 0
                  ? "No Children Selected"
                  : selectedForCheckoutItems.length === 1
                    ? "Check Out 1 Child"
                    : `Check Out ${selectedForCheckoutItems.length} Children`}
              </Button>
            ) : !showBatchCheckout && allCheckedIn ? (
              <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px] shrink-0">All Checked In</Badge>
            ) : null}
          </div>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Guardian: {guardian}{guardianPhone && <> · {guardianPhone}</>}
        </div>
      </div>

      {/* Child rows */}
      <div className="p-2 space-y-1.5 bg-background">
        {items.map(({ reg, checkin, status }) => {
          const acting = loadingId === reg.id;
          const isNotIn = status === "not_checked_in";
          const isSelected = isNotIn && selected.has(reg.id);
          const isSelectedForCheckout = status === "checked_in" && showBatchCheckout && !deselectedForCheckout.has(reg.id);
          const isClickable = isNotIn || (status === "checked_in" && showBatchCheckout);
          const childName = `${reg.childFirstName} ${reg.childLastName}`;
          const avatarCls =
            status === "checked_in" ? "bg-green-100 text-green-800" :
            status === "checked_out" ? "bg-amber-100 text-amber-800" :
            "bg-primary/10 text-primary";
          const cardCls =
            status === "checked_in"
              ? isSelectedForCheckout
                ? "border-green-400 bg-green-50/60 dark:border-green-600 dark:bg-green-950/30"
                : "border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/20"
              : status === "checked_out" ? "border-amber-200 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-950/20" :
            isSelected ? "border-amber-300/80 bg-amber-50/50" :
            "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50";

          return (
            <Card
              key={reg.id}
              className={cn("transition-all", isClickable ? "cursor-pointer" : "", cardCls)}
              onClick={() => {
                if (isNotIn) toggleChild(reg.id);
                if (status === "checked_in" && showBatchCheckout) toggleCheckoutChild(reg.id);
              }}
            >
              <CardContent className="px-3 py-2.5 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-serif font-bold text-sm flex-shrink-0 ${avatarCls}`}>
                  {reg.childFirstName[0]}{reg.childLastName[0]}
                </div>

                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="font-semibold text-base leading-tight">{reg.childFirstName} {reg.childLastName}</span>
                    {reg.room && (
                      <Badge className="text-[10px] h-5 bg-[#FFF9EF] text-[#A85B00] border-[#E5BE57] hover:bg-[#FFF9EF] rounded-full font-semibold">{reg.room}</Badge>
                    )}
                    {reg.allergies && (
                      <Badge className="text-[10px] h-5 bg-red-100 text-red-800 border-red-200 hover:bg-red-100 rounded-full">Allergy</Badge>
                    )}
                    {reg.specialNeeds && (
                      <Badge className="text-[10px] h-5 bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 rounded-full">Medical</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    {status === "not_checked_in" && (
                      <span className="text-[11px] text-muted-foreground/50">
                        Registered {format(new Date(reg.createdAt), "MMM d")}
                      </span>
                    )}
                    {status === "checked_in" && checkin && (
                      <div className="space-y-1.5">
                        <span className="text-green-700 font-medium flex items-center gap-1.5">
                          <LogIn className="w-3 h-3" />
                          Checked in {format(new Date(checkin.checkinAt), "h:mm a")}
                        </span>
                        {labelType === "child_security" && checkin.labelCode && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground font-medium">Pickup Code</span>
                            <span className="font-mono font-bold tracking-widest text-sm bg-amber-50 border border-amber-200 text-amber-900 px-2.5 py-1 rounded-md">
                              {checkin.labelCode}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    {status === "checked_out" && checkin && (
                      <span className="text-amber-700 font-medium flex items-center gap-1.5">
                        <LogOut className="w-3 h-3" />
                        Out {checkin.checkoutAt ? format(new Date(checkin.checkoutAt), "h:mm a") : ""}
                        {checkin.labelCode && (
                          <span className="font-mono text-muted-foreground ml-1">{checkin.labelCode}</span>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions — checkbox on right for eligible children; secondary actions for checked-in/out */}
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                          aria-label={`Edit ${reg.childFirstName} ${reg.childLastName}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenDetail(reg.id);
                          }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit {reg.childFirstName} {reg.childLastName}</TooltipContent>
                    </Tooltip>
                    {isNotIn && (
                      acting
                        ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        : (
                          <button
                            type="button"
                            className={cn(
                              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                              isSelected
                                ? "border-primary-border bg-primary text-primary-foreground shadow-sm hover:bg-[hsl(38_90%_44%)] hover:shadow-md hover:-translate-y-px active:translate-y-0 active:shadow-sm"
                                : "border-muted-foreground/30 bg-background text-transparent hover:border-primary/60"
                            )}
                            aria-pressed={isSelected}
                            aria-label={
                              isSelected
                                ? `Exclude ${childName} from family check-in`
                                : `Include ${childName} in family check-in`
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleChild(reg.id);
                            }}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.75]" />}
                          </button>
                        )
                    )}
                    {status === "checked_in" && showBatchCheckout && (
                      acting
                        ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        : (
                          <button
                            type="button"
                            className={cn(
                              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                              isSelectedForCheckout
                                ? "border-green-600 bg-green-600 text-white shadow-sm hover:bg-green-700 hover:shadow-md hover:-translate-y-px active:translate-y-0 active:shadow-sm"
                                : "border-muted-foreground/30 bg-background text-transparent hover:border-green-600/60"
                            )}
                            aria-pressed={isSelectedForCheckout}
                            aria-label={
                              isSelectedForCheckout
                                ? `Exclude ${childName} from family check-out`
                                : `Include ${childName} in family check-out`
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCheckoutChild(reg.id);
                            }}
                          >
                            {isSelectedForCheckout && <Check className="w-3.5 h-3.5 stroke-[2.75]" />}
                          </button>
                        )
                    )}
                  </div>
                  {status === "checked_in" && checkin && (
                    <>
                      {requireCheckout ? (
                        <Button
                          variant="outline"
                          className="gap-2 h-11 px-5 font-semibold min-w-[108px] border-amber-300 text-amber-800 hover:bg-amber-50 hover:border-amber-400"
                          disabled={acting}
                          onClick={(e) => {
                            e.stopPropagation();
                            onCheckout(reg, checkin);
                          }}
                        >
                          {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                          Check Out
                        </Button>
                      ) : (
                        <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Checked In</Badge>
                      )}
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                          disabled={acting}
                          onClick={(e) => {
                            e.stopPropagation();
                            onUndoCheckin(checkin.id, reg.id);
                          }}
                        >
                          <Undo2 className="w-3 h-3" /> Undo
                        </button>
                        <button
                          type="button"
                          className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            onReprint(reg, checkin);
                          }}
                        >
                          <Printer className="w-3 h-3" /> Reprint
                        </button>
                      </div>
                    </>
                  )}
                  {status === "checked_out" && checkin && (
                    <>
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">Checked Out</Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs h-7 min-w-[96px]"
                        disabled={acting}
                        onClick={(e) => {
                          e.stopPropagation();
                          onIndividualCheckin(reg);
                        }}
                      >
                        {acting ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogIn className="w-3 h-3" />}
                        Check In Again
                      </Button>
                      <button
                        type="button"
                        className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                        disabled={acting}
                        onClick={(e) => {
                          e.stopPropagation();
                          onUndoCheckout(checkin.id, reg.id);
                        }}
                      >
                        <Undo2 className="w-3 h-3" /> Undo Checkout
                      </button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function groupForDesk(filtered: DeskParticipant[]): Array<{
  groupId: number | null;
  guardian: string;
  guardianPhone: string;
  items: DeskParticipant[];
}> {
  const grouped = new Map<number, DeskParticipant[]>();
  const ungrouped: DeskParticipant[] = [];

  for (const p of filtered) {
    const gid = p.reg.registrationGroupId ?? null;
    if (gid != null) {
      if (!grouped.has(gid)) grouped.set(gid, []);
      grouped.get(gid)!.push(p);
    } else {
      ungrouped.push(p);
    }
  }

  const result: ReturnType<typeof groupForDesk> = [];

  for (const [gid, items] of grouped.entries()) {
    const first = items[0]!;
    result.push({
      groupId: gid,
      guardian: first.reg.guardianName || "Unknown",
      guardianPhone: first.reg.guardianPhone || "",
      items,
    });
  }

  for (const p of ungrouped) {
    result.push({
      groupId: null,
      guardian: p.reg.guardianName || "Unknown",
      guardianPhone: p.reg.guardianPhone || "",
      items: [p],
    });
  }

  return result;
}

// ─── Check-In Desk ────────────────────────────────────────────────────────────

function CheckInDeskContent({
  eventId,
  eventName,
  formId,
  embedSlug,
  registrations,
  checkins,
  regsLoading,
  checkinsLoading,
  labelType,
  requireCheckout,
  isChildEvent,
  attendanceSessions,
  onExportCsv,
  isExporting,
  sessions,
  selectedSessionId,
  onSessionChange,
  initialPrintLabels,
}: {
  eventId: number;
  eventName: string;
  formId?: number | null;
  embedSlug?: string | null;
  registrations: Registration[] | undefined;
  checkins: EventCheckin[] | undefined;
  regsLoading: boolean;
  checkinsLoading: boolean;
  labelType: string;
  requireCheckout: boolean;
  isChildEvent: boolean;
  attendanceSessions: Array<{ date: string; items: EventCheckin[] }>;
  onExportCsv: () => void;
  isExporting: boolean;
  sessions?: EventSession[];
  selectedSessionId?: number | null;
  onSessionChange?: (id: number | null) => void;
  initialPrintLabels?: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<DeskFilter>("all");
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [showAttendance, setShowAttendance] = useState(false);
  const [selectedRegId, setSelectedRegId] = useState<number | null>(null);
  const [addRegOpen, setAddRegOpen] = useState(false);
  const [printLabels, setPrintLabels] = useState(initialPrintLabels ?? true);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [pendingPrintLabel, setPendingPrintLabel] = useState<LabelData | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [displayMode, setDisplayMode] = useState<DeskDisplayMode>("standard");
  const [familyCodeEnabled, setFamilyCodeEnabled] = useState(false);
  const [batchLoadingGroupId, setBatchLoadingGroupId] = useState<string | null>(null);
  const [batchCheckoutGroupId, setBatchCheckoutGroupId] = useState<string | null>(null);

  // Family code setting is only relevant when printing child-security labels
  const showFamilyCodeSetting = isChildEvent && labelType === "child_security";

  // Dialog state
  const [pendingCheckinReg, setPendingCheckinReg] = useState<Registration | null>(null);
  const [pendingCheckout, setPendingCheckout] = useState<{ reg: Registration; checkin: EventCheckin } | null>(null);
  const [endSessionOpen, setEndSessionOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(`checkin:displayMode:${eventId}`);
    if (saved === "standard" || saved === "family_grouping") setDisplayMode(saved);
    else setDisplayMode(isChildEvent ? "family_grouping" : "standard");
  }, [eventId, isChildEvent]);

  useEffect(() => {
    const saved = localStorage.getItem(`checkin:familyCode:${eventId}`);
    if (saved === "on" || saved === "off") {
      setFamilyCodeEnabled(saved === "on");
    } else {
      // Default ON for child security events
      setFamilyCodeEnabled(showFamilyCodeSetting);
    }
  }, [eventId, showFamilyCodeSetting]);

  const handleDisplayModeChange = (mode: DeskDisplayMode) => {
    setDisplayMode(mode);
    localStorage.setItem(`checkin:displayMode:${eventId}`, mode);
  };

  const handleFamilyCodeEnabledChange = (v: boolean) => {
    setFamilyCodeEnabled(v);
    localStorage.setItem(`checkin:familyCode:${eventId}`, v ? "on" : "off");
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListEventCheckinsQueryKey(eventId) });

  const handleEndSession = (count: number) => {
    toast({ title: `${count} ${count === 1 ? "child" : "children"} checked out.` });
    invalidate();
  };

  const createCheckin = useCreateCheckin({
    mutation: {
      onSuccess: (data) => {
        console.log("CHECK_IN_SUCCESS");
        invalidate();
        toast({ title: isChildEvent ? "Child checked in" : "Checked in" });
        setLoadingId(null);
        setPendingCheckinReg(null);
        if (data.labelData) {
          const labelToPrint = labelType === "child_security"
            ? data.labelData
            : labelType === "simple_name_tag"
            ? { ...data.labelData, labelCode: "", room: null, allergies: null, specialNeeds: null, guardianName: undefined }
            : { ...data.labelData, labelCode: "" };
          setPendingPrintLabel(labelToPrint);
          if (printLabels) {
            console.log("PRINT_LABEL_DIRECTLY");
            printLabelDirectly([labelToPrint], labelType);
          }
        }
      },
      onError: (err: unknown) => {
        setLoadingId(null);
        setPendingCheckinReg(null);
        const status = (err as { status?: number })?.status;
        if (status === 409) {
          toast({ title: "Already checked in", description: "This child already has an active check-in.", variant: "destructive" });
          invalidate(); // refresh to show current state
        } else {
          toast({ title: "Check-in failed", variant: "destructive" });
        }
      },
    },
  });
  const batchCheckin = useBatchCheckin();
  const groupCheckoutMutation = useCheckoutChild();

  const checkoutMutation = useCheckoutChild({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: isChildEvent ? "Child checked out" : "Checked out" });
        setLoadingId(null);
        setPendingCheckout(null);
      },
      onError: () => { toast({ title: "Check-out failed", variant: "destructive" }); setLoadingId(null); setPendingCheckout(null); },
    },
  });
  const deleteCheckinMutation = useDeleteCheckin({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Check-in removed" }); setLoadingId(null); },
      onError: () => { toast({ title: "Could not undo check-in", variant: "destructive" }); setLoadingId(null); },
    },
  });
  const undoCheckoutMutation = useUndoCheckout({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Check-out reversed" }); setLoadingId(null); },
      onError: () => { toast({ title: "Could not undo check-out", variant: "destructive" }); setLoadingId(null); },
    },
  });

  const doCheckin = (reg: Registration) => {
    setLoadingId(reg.id);
    createCheckin.mutate({
      data: {
        registrationId: reg.id,
        sessionId: selectedSessionId ?? undefined,
        reuseFamilyCode: familyCodeEnabled || undefined,
      },
    });
  };

  const handleCheckinClick = (reg: Registration) => {
    doCheckin(reg);
  };

  const handleGroupCheckin = async (groupKey: string, regs: Registration[]) => {
    if (regs.length === 0) return;
    setBatchLoadingGroupId(groupKey);
    try {
      const result = await batchCheckin.mutateAsync({
        data: {
          items: regs.map((r) => ({ registrationId: r.id, room: r.room ?? undefined })),
          sessionId: selectedSessionId ?? undefined,
          reuseFamilyCode: familyCodeEnabled || undefined,
        },
      });
      invalidate();
      if (printLabels && result.labels?.length) {
        printLabelDirectly(
          result.labels.map((l) => ({
            ...l,
            labelCode: labelType !== "child_security" ? "" : l.labelCode,
            room: labelType === "simple_name_tag" ? null : l.room,
          })),
          labelType
        );
      }
      toast({
        title: regs.length > 1
          ? `${regs.length} children checked in!`
          : `${regs[0]!.childFirstName} checked in!`,
      });
    } catch {
      toast({ title: "Check-in failed — please try again.", variant: "destructive" });
    } finally {
      setBatchLoadingGroupId(null);
    }
  };

  const handleGroupCheckout = async (groupKey: string, items: Array<{ reg: Registration; checkin: EventCheckin }>) => {
    if (items.length === 0) return;
    setBatchCheckoutGroupId(groupKey);
    try {
      for (const { checkin } of items) {
        await groupCheckoutMutation.mutateAsync({ checkinId: checkin.id, data: {} });
      }
      invalidate();
      toast({
        title: items.length > 1
          ? `${items.length} children checked out!`
          : `${items[0]!.reg.childFirstName} checked out!`,
      });
    } catch {
      toast({ title: "Check-out failed — please try again.", variant: "destructive" });
      invalidate();
    } finally {
      setBatchCheckoutGroupId(null);
    }
  };

  const handleStartTodaySession = async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/sessions/today`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to start today's session");
      const session = await res.json() as EventSession;
      await queryClient.invalidateQueries({ queryKey: getListEventSessionsQueryKey(eventId) });
      onSessionChange?.(session.id);
      const today = getLocalDateKey();
      toast({
        title: session.sessionDate === today
          ? "Today's session is ready"
          : `Selected ${format(new Date(session.sessionDate + "T00:00:00"), "MMMM d, yyyy")}`,
      });
    } catch {
      toast({ title: "Could not start today's session", variant: "destructive" });
    }
  };

  // Live desk status is scoped to the selected event session/date.
  const latestCheckinByRegId = useMemo(() => {
    const map = new Map<number, EventCheckin>();
    if (!checkins) return map;
    const pool = selectedSessionId != null
      ? checkins.filter((c) => c.sessionId === selectedSessionId)
      : [];
    for (const c of pool) {
      if (!map.has(c.registrationId)) map.set(c.registrationId, c);
    }
    return map;
  }, [checkins, selectedSessionId]);

  const participants = useMemo(() => {
    if (!registrations) return [] as Array<{ reg: Registration; checkin: EventCheckin | undefined; status: Exclude<DeskFilter, "all"> }>;
    return registrations.map((reg) => {
      const checkin = latestCheckinByRegId.get(reg.id);
      const status: Exclude<DeskFilter, "all"> = !checkin ? "not_checked_in" : !checkin.checkoutAt ? "checked_in" : "checked_out";
      return { reg, checkin, status };
    });
  }, [registrations, latestCheckinByRegId]);

  // Derived — always stays fresh after edits because it reads from the `participants` memo
  const selectedParticipant = selectedRegId !== null
    ? (participants.find((p) => p.reg.id === selectedRegId) ?? null)
    : null;

  const counts = useMemo(() => ({
    all: participants.length,
    not_checked_in: participants.filter((p) => p.status === "not_checked_in").length,
    checked_in: participants.filter((p) => p.status === "checked_in").length,
    checked_out: participants.filter((p) => p.status === "checked_out").length,
  }), [participants]);

  const filtered = useMemo(() => {
    let result = filter === "all" ? participants : participants.filter((p) => p.status === filter);
    if (!search.trim()) return result;
    const q = search.toLowerCase();
    return result.filter(({ reg, checkin }) =>
      `${reg.childFirstName} ${reg.childLastName}`.toLowerCase().includes(q) ||
      (reg.guardianName ?? "").toLowerCase().includes(q) ||
      (reg.guardianPhone ?? "").toLowerCase().includes(q) ||
      (reg.room ?? "").toLowerCase().includes(q) ||
      (checkin?.labelCode ?? "").toLowerCase().includes(q)
    );
  }, [participants, filter, search]);

  // In family grouping mode with an active search: expand results to include all
  // siblings from the same group so the whole family rectangle appears together.
  const filteredForGrouping = useMemo(() => {
    if (!search.trim() || !isChildEvent) return filtered;
    const matchingGroupIds = new Set<number>();
    for (const p of filtered) {
      if (p.reg.registrationGroupId != null) matchingGroupIds.add(p.reg.registrationGroupId);
    }
    if (matchingGroupIds.size === 0) return filtered;
    const statusPool = filter === "all" ? participants : participants.filter((p) => p.status === filter);
    const directMatchIds = new Set(filtered.map((p) => p.reg.id));
    const expanded = statusPool.filter(
      (p) =>
        directMatchIds.has(p.reg.id) ||
        (p.reg.registrationGroupId != null && matchingGroupIds.has(p.reg.registrationGroupId))
    );
    return expanded;
  }, [filtered, search, isChildEvent, filter, participants]);

  const isLoading = regsLoading || checkinsLoading;

  const today = getLocalDateKey();
  const selectedSession = sessions?.find((session) => session.id === selectedSessionId);
  const selectedSessionDate = selectedSession?.sessionDate;
  const selectedSessionShortLabel = selectedSessionDate
    ? selectedSessionDate === today
      ? `Today · ${format(new Date(selectedSessionDate + "T00:00:00"), "MMM d, yyyy")}`
      : format(new Date(selectedSessionDate + "T00:00:00"), "MMM d, yyyy")
    : "Select date";

  return (
    <div className="space-y-5">
      {/* Page header: title row + subtitle/session row */}
      <div className="space-y-1.5">
        {/* Row 1: title + utility controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-serif font-bold">Check-In Desk</h1>
            {selectedSessionDate === today ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-800">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Today's session
              </span>
            ) : selectedSessionDate && selectedSessionDate > today ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#B9D2FF] bg-[#EAF2FF] px-2.5 py-1 text-xs font-semibold text-[#2E5AAC]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4A7DFF]" />
                Upcoming
              </span>
            ) : selectedSessionDate && selectedSessionDate < today ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                Past session
              </span>
            ) : null}
          </div>
          {/* Utility controls: top-right of the page */}
          <div className="flex items-center gap-1 shrink-0">
            {pendingPrintLabel && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground gap-1.5"
                title="Reprint last label"
                onClick={() => {
                  console.log("OPEN_PRINT_MODAL");
                  setPrintDialogOpen(true);
                }}
              >
                <Repeat className="w-4 h-4" />
                <span className="hidden sm:inline">Reprint</span>
              </Button>
            )}
            <div
              className={`flex items-center gap-1.5 text-sm font-medium cursor-pointer select-none transition-colors px-2 py-1.5 rounded-md hover:bg-muted/60 ${printLabels ? "text-primary" : "text-muted-foreground"}`}
              title={printLabels ? "Label printing on — click to disable" : "Label printing off — click to enable"}
              onClick={() => setPrintLabels((v) => !v)}
            >
              <Printer className="w-4 h-4" />
              <Switch
                checked={printLabels}
                onCheckedChange={setPrintLabels}
                onClick={(e) => e.stopPropagation()}
                aria-label="Print labels on check-in"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className={`gap-1.5 ${displayMode === "family_grouping" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setSettingsOpen(true)}
              title="Check-In Settings"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onExportCsv}
              disabled={isExporting}
              className="text-muted-foreground hover:text-foreground gap-1.5"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground px-2">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isChildEvent && (
                  <>
                  <DropdownMenuItem
                    className="gap-2 cursor-pointer"
                    onClick={handleStartTodaySession}
                  >
                    <Calendar className="w-4 h-4" />
                    Start new session / Reset for today
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive gap-2 cursor-pointer"
                    onClick={() => setEndSessionOpen(true)}
                  >
                    <PowerOff className="w-4 h-4" />
                    End Session / Check Out Remaining
                  </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {/* Row 2: subtitle */}
        <p className="text-muted-foreground text-sm">
          {isChildEvent
            ? "Search and check children in or out for this event."
            : "Search and check participants in or out for this event."}
        </p>
        {/* Row 3: session selector — only when there is more than one valid session */}
        {sessions && sessions.length > 1 && onSessionChange && (
          <div className="flex justify-start">
            <Select
              value={selectedSessionId != null ? String(selectedSessionId) : ""}
              onValueChange={(v) => onSessionChange(parseInt(v, 10))}
            >
              <SelectTrigger className="h-9 w-auto min-w-[210px] max-w-[260px] rounded-lg border-border bg-background px-3 text-sm font-medium shadow-sm">
                <Calendar className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
                <span className="text-muted-foreground mr-1">Session:</span>
                <span className="truncate">{selectedSessionShortLabel}</span>
              </SelectTrigger>
              <SelectContent align="end">
                {sessions.map((s) => {
                  const label = format(new Date(s.sessionDate + "T00:00:00"), "EEEE, MMMM d, yyyy");
                  const isToday = s.sessionDate === today;
                  return (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {label}{isToday ? " — Today" : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {selectedSessionDate && selectedSessionDate !== today && (
        <div className={`flex items-start gap-2.5 px-4 py-3 rounded-lg border text-sm ${
          selectedSessionDate < today
            ? "border-amber-300 bg-amber-50 text-amber-900"
            : "border-blue-300 bg-blue-50 text-blue-900"
        }`}>
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            {selectedSessionDate < today
              ? `Viewing past session: ${format(new Date(selectedSessionDate + "T00:00:00"), "MMM d, yyyy")}. Changes will edit attendance history for that date.`
              : `Viewing upcoming session: ${format(new Date(selectedSessionDate + "T00:00:00"), "MMM d, yyyy")}. Check-ins will be recorded for this date.`}
          </span>
        </div>
      )}

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {(["all", "not_checked_in", "checked_in", "checked_out"] as DeskFilter[]).map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {DESK_FILTER_LABELS[f]}
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold min-w-[1.4rem] text-center ${
                active ? "bg-white/20 text-white" : "bg-muted"
              }`}>
                {counts[f]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Registrants section */}
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Registrants</h2>
          <p className="text-sm text-muted-foreground">
            {counts.all} registered{displayMode === "family_grouping" ? " · Family grouping on" : ""}
          </p>
        </div>

        {/* Search + Add Registrant */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-11 h-12 text-base"
              placeholder={
                isChildEvent
                  ? "Search child, guardian, phone, room, or pickup code…"
                  : "Search participant, contact, phone, or room…"
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {isChildEvent && (
            <Button className="shrink-0 gap-2 h-12 px-5 text-base font-semibold" onClick={() => setAddRegOpen(true)}>
              <Plus className="w-5 h-5" /> Add Registrant
            </Button>
          )}
        </div>

        {displayMode === "family_grouping" && isChildEvent && (
          <p className="text-xs text-muted-foreground">Click a child card to include/exclude from family check-in. Use the pencil icon to edit details.</p>
        )}
      </div>

      {/* Participant cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              {search
                ? `No results for "${search}"`
                : filter === "all"
                ? `No ${isChildEvent ? "children" : "participants"} registered yet.`
                : `No ${isChildEvent ? "children" : "participants"} — ${DESK_FILTER_LABELS[filter].toLowerCase()}.`}
            </p>
          </CardContent>
        </Card>
      ) : displayMode === "family_grouping" && isChildEvent ? (
        <div className="space-y-4">
          {groupForDesk(filteredForGrouping as DeskParticipant[]).map((group) => {
            const groupKey = group.groupId != null ? String(group.groupId) : `ungrouped-${group.items[0]!.reg.id}`;

            return (
              <FamilyGroupDeskCard
                key={groupKey}
                guardian={group.guardian}
                guardianPhone={group.guardianPhone}
                items={group.items as DeskParticipant[]}
                isGroupCheckinLoading={batchLoadingGroupId === groupKey}
                loadingId={loadingId}
                labelType={labelType}
                requireCheckout={requireCheckout}
                onCheckinSelected={(regs) => handleGroupCheckin(groupKey, regs)}
                onIndividualCheckin={handleCheckinClick}
                onOpenDetail={setSelectedRegId}
                onCheckout={(reg, checkin) => setPendingCheckout({ reg, checkin })}
                onCheckoutSelected={(items) => handleGroupCheckout(groupKey, items)}
                isGroupCheckoutLoading={batchCheckoutGroupId === groupKey}
                onUndoCheckin={(checkinId, regId) => { setLoadingId(regId); deleteCheckinMutation.mutate({ checkinId }); }}
                onUndoCheckout={(checkinId, regId) => { setLoadingId(regId); undoCheckoutMutation.mutate({ checkinId }); }}
                onReprint={(reg, checkin) => {
                  const reprintData: LabelData = {
                    childName: `${reg.childFirstName} ${reg.childLastName}`,
                    guardianName: reg.guardianName ?? "",
                    labelCode: checkin.labelCode,
                    checkinDate: checkin.checkinAt,
                    room: reg.room ?? null,
                    allergies: reg.allergies ?? null,
                    specialNeeds: reg.specialNeeds ?? null,
                  };
                  printLabelDirectly([reprintData], labelType);
                }}
              />
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(({ reg, checkin, status }) => {
            const acting = loadingId === reg.id;
            const avatarCls =
              status === "checked_in" ? "bg-green-100 text-green-800" :
              status === "checked_out" ? "bg-amber-100 text-amber-800" :
              "bg-primary/10 text-primary";
            const cardCls =
              status === "checked_in" ? "border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/20" :
              status === "checked_out" ? "border-amber-200 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-950/20" :
              "";

            return (
              <Card
                key={reg.id}
                className={`transition-colors cursor-pointer ${cardCls}`}
                onClick={() => setSelectedRegId(reg.id)}
              >
                <CardContent className="px-4 py-4 flex items-start gap-4">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-serif font-bold text-sm flex-shrink-0 mt-0.5 ${avatarCls}`}>
                    {reg.childFirstName[0]}{reg.childLastName[0]}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="font-semibold text-base leading-tight">{reg.childFirstName} {reg.childLastName}</span>
                      {reg.room && (
                        <Badge className="text-[10px] h-5 bg-[#FFF9EF] text-[#A85B00] border-[#E5BE57] hover:bg-[#FFF9EF] rounded-full font-semibold">{reg.room}</Badge>
                      )}
                      {reg.allergies && (
                        <Badge className="text-[10px] h-5 bg-red-100 text-red-800 border-red-200 hover:bg-red-100 rounded-full">Allergy</Badge>
                      )}
                      {reg.specialNeeds && (
                        <Badge className="text-[10px] h-5 bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 rounded-full">Medical</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
                      <span>
                        <span className="font-medium text-foreground/80">
                          {isChildEvent ? "Parent/Guardian:" : "Contact:"}
                        </span>{" "}
                        {isChildEvent
                          ? <>{reg.guardianName || "—"}{reg.guardianPhone && <> · {reg.guardianPhone}</>}</>
                          : <>{[
                              reg.guardianName && reg.guardianName !== `${reg.childFirstName} ${reg.childLastName}` ? reg.guardianName : null,
                              reg.guardianPhone,
                              reg.guardianEmail,
                            ].filter(Boolean).join(" · ") || "—"}</>}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      {status === "not_checked_in" && (
                        <span className="text-muted-foreground">
                          Registered {format(new Date(reg.createdAt), "MMM d")}
                        </span>
                      )}
                      {status === "checked_in" && checkin && (
                        <div className="space-y-1.5">
                          <span className="text-green-700 font-medium flex items-center gap-1.5">
                            <LogIn className="w-3 h-3" />
                            Checked in {format(new Date(checkin.checkinAt), "h:mm a")}
                          </span>
                          {labelType === "child_security" && checkin.labelCode && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground font-medium">Pickup Code</span>
                              <span className="font-mono font-bold tracking-widest text-sm bg-amber-50 border border-amber-200 text-amber-900 px-2.5 py-1 rounded-md">
                                {checkin.labelCode}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      {status === "checked_out" && checkin && (
                        <span className="text-amber-700 font-medium flex items-center gap-1.5">
                          <LogOut className="w-3 h-3" />
                          Out {checkin.checkoutAt ? format(new Date(checkin.checkoutAt), "h:mm a") : ""}
                          {checkin.labelCode && (
                            <span className="font-mono text-muted-foreground ml-1">{checkin.labelCode}</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action column — stop propagation so clicks here don't open the detail drawer */}
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    {status === "not_checked_in" && (
                      <Button
                        className="gap-2 h-11 px-5 font-semibold min-w-[108px]"
                        disabled={acting}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCheckinClick(reg);
                        }}
                      >
                        {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                        Check In
                      </Button>
                    )}

                    {status === "checked_in" && checkin && (
                      <>
                        {requireCheckout ? (
                          <Button
                            variant="outline"
                            className="gap-2 h-11 px-5 font-semibold min-w-[108px] border-amber-300 text-amber-800 hover:bg-amber-50 hover:border-amber-400"
                            disabled={acting}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingCheckout({ reg, checkin });
                            }}
                          >
                            {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                            Check Out
                          </Button>
                        ) : (
                          <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Checked In</Badge>
                        )}
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                            disabled={acting}
                            onClick={(e) => {
                              e.stopPropagation();
                              setLoadingId(reg.id);
                              deleteCheckinMutation.mutate({ checkinId: checkin.id });
                            }}
                          >
                            <Undo2 className="w-3 h-3" /> Undo
                          </button>
                          <button
                            type="button"
                            className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              const reprintData: LabelData = {
                                childName: `${reg.childFirstName} ${reg.childLastName}`,
                                guardianName: reg.guardianName ?? "",
                                labelCode: checkin.labelCode,
                                checkinDate: checkin.checkinAt,
                                room: reg.room ?? null,
                                allergies: reg.allergies ?? null,
                                specialNeeds: reg.specialNeeds ?? null,
                              };
                              printLabelDirectly([reprintData], labelType);
                            }}
                          >
                            <Printer className="w-3 h-3" /> Reprint
                          </button>
                        </div>
                      </>
                    )}

                    {status === "checked_out" && checkin && (
                      <>
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">Checked Out</Badge>
                        {checkin.checkoutMethod === "bulk_admin" ? (
                          <p className="text-[11px] text-amber-700 text-right">Bulk checkout by admin</p>
                        ) : checkin.pickupPersonName ? (
                          <p className="text-[11px] text-muted-foreground text-right max-w-[120px] truncate">
                            Picked up by {checkin.pickupPersonName}
                          </p>
                        ) : null}
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs h-7 min-w-[96px]"
                          disabled={acting}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCheckinClick(reg);
                          }}
                        >
                          {acting ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogIn className="w-3 h-3" />}
                          Check In Again
                        </Button>
                        <button
                          type="button"
                          className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                          disabled={acting}
                          onClick={(e) => {
                            e.stopPropagation();
                            setLoadingId(reg.id);
                            undoCheckoutMutation.mutate({ checkinId: checkin.id });
                          }}
                        >
                          <Undo2 className="w-3 h-3" /> Undo Checkout
                        </button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Child detail drawer */}
      {selectedParticipant && (
        <ChildDetailSheet
          open={!!selectedParticipant}
          onOpenChange={(v) => { if (!v) setSelectedRegId(null); }}
          reg={selectedParticipant.reg}
          checkin={selectedParticipant.checkin}
          allCheckins={(checkins ?? [])
            .filter((c) => c.registrationId === selectedParticipant.reg.id)
            .sort((a, b) => new Date(b.checkinAt).getTime() - new Date(a.checkinAt).getTime())}
          eventId={eventId}
          labelType={labelType}
          requireCheckout={requireCheckout}
          onCheckin={() => handleCheckinClick(selectedParticipant.reg)}
          onCheckout={() => {
            if (selectedParticipant.checkin) {
              setPendingCheckout({ reg: selectedParticipant.reg, checkin: selectedParticipant.checkin });
            }
          }}
        />
      )}

      {/* Check-in confirmation dialog (allergies/medical) */}
      {pendingCheckinReg && (
        <CheckInConfirmDialog
          reg={pendingCheckinReg}
          open={!!pendingCheckinReg}
          onConfirm={() => doCheckin(pendingCheckinReg)}
          onCancel={() => setPendingCheckinReg(null)}
          isPending={loadingId === pendingCheckinReg.id}
        />
      )}

      {/* Check-out dialog (pickup person + notes) */}
      {pendingCheckout && (
        <CheckOutDialog
          reg={pendingCheckout.reg}
          checkin={pendingCheckout.checkin}
          open={!!pendingCheckout}
          onConfirm={(pickupPersonName, notes) => {
            setLoadingId(pendingCheckout.reg.id);
            checkoutMutation.mutate({ checkinId: pendingCheckout.checkin.id, data: { pickupPersonName: pickupPersonName || undefined, notes: notes || undefined } });
          }}
          onCancel={() => setPendingCheckout(null)}
          isPending={loadingId === pendingCheckout.reg.id}
        />
      )}

      {/* Attendance history (collapsible) */}
      {attendanceSessions.length > 0 && (
        <div className="pt-2 border-t border-border">
          <button
            type="button"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
            onClick={() => setShowAttendance((v) => !v)}
          >
            <BarChart2 className="w-4 h-4" />
            {showAttendance ? "Hide" : "View"} Attendance History
            <Badge variant="secondary" className="text-xs">{attendanceSessions.length} session{attendanceSessions.length !== 1 ? "s" : ""}</Badge>
          </button>
          {showAttendance && (
            <div className="space-y-3 mt-3">
              {attendanceSessions.map(({ date, items }) => (
                <Card key={date}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {format(new Date(date + "T00:00:00"), "EEEE, MMMM d, yyyy")}
                      </CardTitle>
                      <div className="flex flex-wrap justify-end gap-2 text-xs text-muted-foreground">
                        <span>Total check-ins: {items.length}</span>
                        <span>Currently in: {items.filter((item) => !item.checkoutAt).length}</span>
                        <span>Checked out: {items.filter((item) => !!item.checkoutAt).length}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {[...items]
                        .sort((a, b) => new Date(a.checkinAt).getTime() - new Date(b.checkinAt).getTime())
                        .map((c) => (
                          <div key={c.id} className="px-5 py-2.5 flex items-center justify-between gap-4">
                            <div>
                              <p className="font-medium text-sm">{c.childFirstName} {c.childLastName}</p>
                              {c.room && <p className="text-xs text-muted-foreground">{c.room}</p>}
                            </div>
                            <div className="text-right text-xs text-muted-foreground flex-shrink-0">
                              <p>In: {format(new Date(c.checkinAt), "h:mm a")}</p>
                              {c.checkoutAt && <p className="text-amber-700">Out: {format(new Date(c.checkoutAt), "h:mm a")}</p>}
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <ManualRegistrationDialog
        formId={formId}
        embedSlug={embedSlug}
        isChildCheckin={isChildEvent}
        eventId={eventId}
        open={addRegOpen}
        onOpenChange={setAddRegOpen}
      />

      <LabelPrintDialog
        open={printDialogOpen}
        onOpenChange={(v) => { setPrintDialogOpen(v); if (!v) setPendingPrintLabel(null); }}
        labels={pendingPrintLabel ? [pendingPrintLabel] : []}
      />
      <EndSessionDialog
        open={endSessionOpen}
        onOpenChange={setEndSessionOpen}
        eventId={eventId}
        sessionId={selectedSessionId}
        eventName={eventName}
        checkedInCount={counts.checked_in}
        onSuccess={handleEndSession}
      />
      <CheckinDeskSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        displayMode={displayMode}
        onDisplayModeChange={handleDisplayModeChange}
        familyCodeEnabled={familyCodeEnabled}
        onFamilyCodeEnabledChange={handleFamilyCodeEnabledChange}
        showFamilyCodeSetting={showFamilyCodeSetting}
      />
    </div>
  );
}

// ─── Event Date Card ──────────────────────────────────────────────────────────

function EventDateCard({ event }: { event: EventWithForm }) {
  const { scheduleType, startDate, endDate, repeatDayOfWeek, nextSessionDate } = event;
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  if (scheduleType === "repeating") {
    const dayLabel = repeatDayOfWeek != null ? DAY_NAMES[repeatDayOfWeek] : null;
    if (nextSessionDate) {
      return (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Event Date</p>
            <p className="text-xl font-bold font-serif mt-1">
              {format(new Date(nextSessionDate + "T00:00:00"), "MMM d")}
            </p>
            {dayLabel && <p className="text-xs text-muted-foreground mt-0.5">Every {dayLabel}</p>}
          </CardContent>
        </Card>
      );
    }
    const startLabel = startDate ? format(new Date(startDate + "T00:00:00"), "MMM d") : null;
    const endLabel = endDate ? format(new Date(endDate + "T00:00:00"), "MMM d, yyyy") : null;
    return (
      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Event Date</p>
          <p className="text-base font-bold font-serif mt-1 leading-tight">
            {startLabel && endLabel ? `${startLabel} – ${endLabel}` : startLabel ?? "—"}
          </p>
          {dayLabel && <p className="text-xs text-muted-foreground mt-0.5">Every {dayLabel}</p>}
        </CardContent>
      </Card>
    );
  }

  if (scheduleType === "multi_day") {
    const startLabel = startDate ? format(new Date(startDate + "T00:00:00"), "MMM d") : null;
    const endLabel = endDate ? format(new Date(endDate + "T00:00:00"), "MMM d, yyyy") : null;
    return (
      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Event Dates</p>
          <p className="text-base font-bold font-serif mt-1 leading-tight">
            {startLabel && endLabel ? `${startLabel} – ${endLabel}` : startLabel ?? "—"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">Event Date</p>
        <p className="text-xl font-bold font-serif mt-1">
          {startDate ? format(new Date(startDate + "T00:00:00"), "MMM d, yyyy") : "—"}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Section: Event Dashboard ──────────────────────────────────────────────────

function EventDashboardSection({
  event,
  eventId,
  registrations,
  checkins,
  checkedIn,
  checkedOut,
  isChildCheckin,
  trackAttendance,
  requireCheckout,
  onExportCsv,
  isExporting,
}: {
  event: EventWithForm;
  eventId: number;
  registrations: Registration[] | undefined;
  checkins: EventCheckin[] | undefined;
  checkedIn: EventCheckin[];
  checkedOut: EventCheckin[];
  isChildCheckin: boolean;
  trackAttendance: boolean;
  requireCheckout: boolean;
  onExportCsv: () => void;
  isExporting: boolean;
}) {
  const { toast } = useToast();
  const registrationUrl = event.formEmbedSlug
    ? `${window.location.origin}/register/${event.formEmbedSlug}`
    : null;

  const copyEmbedCode = () => {
    if (!registrationUrl) return;
    const code = `<iframe src="${registrationUrl}" width="100%" height="800" frameborder="0" style="border:none;"></iframe>`;
    navigator.clipboard.writeText(code);
    toast({ title: "Embed code copied!" });
  };

  const recentRegistrations = [...(registrations ?? [])]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const recentCheckins = [...(checkedIn ?? [])]
    .sort((a, b) => new Date(b.checkinAt).getTime() - new Date(a.checkinAt).getTime())
    .slice(0, 5);

  // ── Dynamic stat cards ──────────────────────────────────────────────────────
  const regType = event.registrationType ?? "child_checkin";
  const isFamilyGroup = regType === "family_group";
  const isIndividual = regType === "individual";
  const totalRegs = registrations?.length ?? 0;

  const groupCount = isFamilyGroup
    ? new Set((registrations ?? []).map((r) => r.guardianName ?? "").filter(Boolean)).size
    : 0;
  const attendanceRate = totalRegs > 0 ? Math.round((checkedIn.length / totalRegs) * 100) : 0;

  let card2: React.ReactNode = null;
  let card3: React.ReactNode = null;

  if (isChildCheckin && trackAttendance) {
    card2 = (
      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Checked In</p>
          <p className="text-3xl font-bold font-serif mt-1 text-green-800">{checkedIn.length}</p>
        </CardContent>
      </Card>
    );
    card3 = (
      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Checked Out</p>
          <p className="text-3xl font-bold font-serif mt-1 text-amber-800">{checkedOut.length}</p>
        </CardContent>
      </Card>
    );
  } else if (isFamilyGroup) {
    card2 = (
      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Groups Registered</p>
          <p className="text-3xl font-bold font-serif mt-1">{groupCount}</p>
        </CardContent>
      </Card>
    );
    if (trackAttendance) {
      card3 = (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Checked In</p>
            <p className="text-3xl font-bold font-serif mt-1 text-green-800">{checkedIn.length}</p>
          </CardContent>
        </Card>
      );
    } else {
      card3 = (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Public Form</p>
            <p className="text-sm font-medium mt-1">{event.formEmbedSlug ? "Active" : "Not configured"}</p>
            {event.formEmbedSlug && (
              <a
                href={`${window.location.origin}/register/${event.formEmbedSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
              >
                <ExternalLink className="w-3 h-3" /> Open form
              </a>
            )}
          </CardContent>
        </Card>
      );
    }
  } else if (isIndividual) {
    if (trackAttendance) {
      card2 = (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Checked In</p>
            <p className="text-3xl font-bold font-serif mt-1 text-green-800">{checkedIn.length}</p>
          </CardContent>
        </Card>
      );
      card3 = (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Attendance Rate</p>
            <p className="text-3xl font-bold font-serif mt-1">{attendanceRate}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">{checkedIn.length} of {totalRegs}</p>
          </CardContent>
        </Card>
      );
    } else {
      card2 = (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Form Status</p>
            <p className="text-xl font-bold font-serif mt-1">{event.formEmbedSlug ? "Active" : "Not Set"}</p>
          </CardContent>
        </Card>
      );
      card3 = (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Public Link</p>
            {event.formEmbedSlug ? (
              <a
                href={`${window.location.origin}/register/${event.formEmbedSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1.5 mt-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open Form
              </a>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">Not configured</p>
            )}
          </CardContent>
        </Card>
      );
    }
  }

  const totalRegisteredCard = (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">Total Registered</p>
        <p className="text-3xl font-bold font-serif mt-1">{totalRegs}</p>
      </CardContent>
    </Card>
  );

  const statsSection = !card2 && !card3 ? (
    <div className="grid grid-cols-2 gap-4">
      {totalRegisteredCard}
      <EventDateCard event={event} />
    </div>
  ) : (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {totalRegisteredCard}
      {card2}
      {card3}
      <EventDateCard event={event} />
    </div>
  );

  // ── Event header date/schedule summary ──────────────────────────────────────
  const DAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const { scheduleType, startDate, endDate, repeatDayOfWeek, nextSessionDate } = event;
  let scheduleSummary: React.ReactNode = null;
  if (scheduleType === "repeating") {
    const dayLabel = repeatDayOfWeek != null ? DAY_NAMES_FULL[repeatDayOfWeek] : null;
    scheduleSummary = (
      <div className="flex flex-col gap-0.5">
        <span className="text-sm text-muted-foreground">
          Repeating weekly{dayLabel ? ` · ${dayLabel}s` : ""}
        </span>
        {nextSessionDate && (
          <span className="text-xs text-muted-foreground">
            Next session: {format(new Date(nextSessionDate + "T00:00:00"), "MMM d")}
          </span>
        )}
      </div>
    );
  } else if (scheduleType === "multi_day") {
    const s = startDate ? format(new Date(startDate + "T00:00:00"), "MMM d") : null;
    const e = endDate ? format(new Date(endDate + "T00:00:00"), "MMM d") : null;
    scheduleSummary = (
      <span className="text-sm text-muted-foreground">
        {s && e ? `${s} – ${e}` : s ?? ""}
      </span>
    );
  } else if (startDate) {
    scheduleSummary = (
      <span className="text-sm text-muted-foreground">
        {format(new Date(startDate + "T00:00:00"), "MMM d")}
      </span>
    );
  }

  const REG_TYPE_LABELS: Record<string, string> = {
    child_checkin: "Child Check-In",
    family_group: "Family / Group",
    individual: "Individual",
  };
  const regTypeLabel = REG_TYPE_LABELS[regType] ?? regType;

  // ── Hero card ───────────────────────────────────────────────────────────────
  let heroTitle: string;
  let heroDescription: string;
  let heroButtonLabel: string;
  let heroHref: string;
  let heroIcon: React.ReactNode;
  let heroColors: { border: string; bg: string; titleColor: string; descColor: string; btnClass: string; iconBg: string; iconColor: string };

  if (trackAttendance) {
    if (isChildCheckin) {
      heroTitle = "Start Check-In Desk";
      heroDescription = "Begin checking children in and out for this event.";
      heroButtonLabel = "Open Check-In Desk";
    } else {
      heroTitle = "Start Check-In";
      heroDescription = "Begin checking people in for this event.";
      heroButtonLabel = "Open Check-In";
    }
    heroHref = `/events/${eventId}/checkin`;
    heroIcon = <ClipboardList className="w-7 h-7 text-amber-600" />;
    heroColors = {
      border: "border-amber-200",
      bg: "bg-amber-50",
      titleColor: "text-amber-900",
      descColor: "text-amber-700",
      btnClass: "bg-amber-500 hover:bg-amber-600 text-black border-0 shadow-sm",
      iconBg: "bg-amber-100 border border-amber-200",
      iconColor: "text-amber-600",
    };
  } else {
    heroTitle = "Share Registration Form";
    heroDescription = "Open or share your public form to start collecting registrations.";
    heroButtonLabel = "Open Public Form";
    heroHref = registrationUrl ?? "#";
    heroIcon = <ExternalLink className="w-7 h-7 text-primary" />;
    heroColors = {
      border: "border-primary/20",
      bg: "bg-primary/5",
      titleColor: "text-foreground",
      descColor: "text-muted-foreground",
      btnClass: "bg-primary hover:bg-primary/90 text-primary-foreground border-0 shadow-sm",
      iconBg: "bg-primary/10 border border-primary/20",
      iconColor: "text-primary",
    };
  }

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto w-full space-y-6">

      {/* 1 — Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage this event's registration, check-in, and activity.</p>
        </div>
        <Link href={`/events/${eventId}/settings`} className="shrink-0">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </Button>
        </Link>
      </div>

      {/* Event meta row */}
      <div className="flex items-center gap-2.5 flex-wrap -mt-2 pb-4 border-b border-border/60">
        <h2 className="text-base font-semibold">{event.name}</h2>
        <Badge variant="secondary" className="text-xs">{regTypeLabel}</Badge>
        {statusBadge(event.status)}
        {scheduleSummary}
      </div>

      {/* 2 — Stat Cards */}
      {statsSection}

      {/* 3 — Primary Hero Action */}
      <div className={`relative overflow-hidden rounded-2xl border ${heroColors.border} ${heroColors.bg} p-5`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className={`w-12 h-12 rounded-xl ${heroColors.iconBg} flex items-center justify-center shrink-0`}>
              {heroIcon}
            </div>
            <div className="min-w-0">
              <h2 className={`text-lg font-serif font-bold ${heroColors.titleColor}`}>{heroTitle}</h2>
              <p className={`text-sm ${heroColors.descColor} mt-0.5`}>{heroDescription}</p>
              {trackAttendance && (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${heroColors.border} ${heroColors.iconBg} ${heroColors.descColor}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                    Check-in open
                  </span>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${heroColors.border} ${heroColors.iconBg} ${heroColors.descColor}`}>
                    <Printer className="w-3 h-3" />
                    {(event.printLabels ?? isChildCheckin) ? "Labels on" : "Labels off"}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="sm:shrink-0 pl-16 sm:pl-0">
            {trackAttendance ? (
              <Link href={heroHref}>
                <Button size="lg" className={`gap-2 ${heroColors.btnClass}`}>
                  <LogIn className="w-4 h-4" />
                  {heroButtonLabel}
                </Button>
              </Link>
            ) : registrationUrl ? (
              <a href={registrationUrl} target="_blank" rel="noopener noreferrer">
                <Button className={`gap-2 ${heroColors.btnClass}`}>
                  <ExternalLink className="w-4 h-4" />
                  {heroButtonLabel}
                </Button>
              </a>
            ) : (
              <Link href={`/events/${eventId}/form`}>
                <Button className={`gap-2 ${heroColors.btnClass}`}>
                  <FileEdit className="w-4 h-4" />
                  Set Up Form
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* 4 — Recent Activity */}
      <div className="space-y-4">
        {/* Recent Registrations */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Recent Registrations</h2>
            <Link href={`/events/${eventId}/registrations`} className="text-sm text-primary hover:underline">View all</Link>
          </div>
          <Card className="overflow-hidden">
            {recentRegistrations.length > 0 ? (
              <CardContent className="p-0 divide-y divide-border">
                {recentRegistrations.map((reg) => (
                  <div key={reg.id} className="px-4 py-3.5 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-serif font-bold text-primary text-sm shrink-0">
                      {reg.childFirstName[0]}{reg.childLastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{reg.childFirstName} {reg.childLastName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {reg.guardianName}{reg.guardianPhone ? ` · ${reg.guardianPhone}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {reg.room && <Badge variant="outline" className="text-[10px] hidden sm:flex">{reg.room}</Badge>}
                      <p className="text-xs text-muted-foreground">{format(new Date(reg.createdAt), "MMM d")}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            ) : (
              <CardContent className="py-8 text-center space-y-2">
                <Users className="w-7 h-7 mx-auto text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">No registrations yet.</p>
                <p className="text-xs text-muted-foreground">Share the public form to start collecting registrations.</p>
                {registrationUrl && (
                  <a href={registrationUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="mt-2 gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5" /> Open Public Form
                    </Button>
                  </a>
                )}
              </CardContent>
            )}
          </Card>
        </div>

        {/* Recently Checked In — only when check-in is enabled */}
        {trackAttendance && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold">Recently Checked In</h2>
              <Link href={`/events/${eventId}/checkin`} className="text-sm text-primary hover:underline">View all</Link>
            </div>
            <Card className="overflow-hidden">
              {recentCheckins.length > 0 ? (
                <CardContent className="p-0 divide-y divide-border">
                  {recentCheckins.map((c) => (
                    <div key={c.id} className="px-4 py-3.5 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center font-serif font-bold text-green-800 text-sm shrink-0">
                        {c.childFirstName[0]}{c.childLastName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{c.childFirstName} {c.childLastName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {c.guardianName}{c.room ? ` · ${c.room}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {c.room && <Badge variant="outline" className="text-[10px] hidden sm:flex">{c.room}</Badge>}
                        <p className="text-xs text-green-700 font-medium">{format(new Date(c.checkinAt), "h:mm a")}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              ) : (
                <CardContent className="py-8 text-center space-y-2">
                  <LogIn className="w-7 h-7 mx-auto text-muted-foreground/40" />
                  <p className="text-sm font-medium text-muted-foreground">No check-ins yet.</p>
                  <p className="text-xs text-muted-foreground">Check-ins will appear here once people are checked in.</p>
                </CardContent>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* 5 — Quick Actions */}
      <div className="space-y-4">
        <h2 className="text-lg font-serif font-bold">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {registrationUrl && (
            <a
              href={registrationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all text-sm font-medium text-center"
            >
              <ExternalLink className="w-5 h-5 text-primary" />
              Open Public Form
            </a>
          )}
          {registrationUrl && (
            <button
              type="button"
              onClick={copyEmbedCode}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all text-sm font-medium text-center"
            >
              <Copy className="w-5 h-5 text-primary" />
              Copy Embed Code
            </button>
          )}
          <Link href={`/events/${eventId}/form`}>
            <div className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all text-sm font-medium text-center cursor-pointer">
              <FileEdit className="w-5 h-5 text-primary" />
              Edit Form
            </div>
          </Link>
          <button
            type="button"
            onClick={onExportCsv}
            disabled={isExporting}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all text-sm font-medium text-center disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : <Download className="w-5 h-5 text-primary" />}
            Export CSV
          </button>
          <Link href={`/events/${eventId}/settings`}>
            <div className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all text-sm font-medium text-center cursor-pointer">
              <Settings className="w-5 h-5 text-primary" />
              Event Settings
            </div>
          </Link>
        </div>
      </div>

    </div>
  );
}

// ─── Section: Non-child Check-In Activity (tabs) ───────────────────────────────

function NonChildCheckinSection({
  registrations,
  checkins,
  regsLoading,
  checkinsLoading,
  checkedIn,
  checkedOut,
  trackAttendance,
  requireCheckout,
  attendanceSessions,
  onExportCsv,
  isExporting,
}: {
  registrations: Registration[] | undefined;
  checkins: EventCheckin[] | undefined;
  regsLoading: boolean;
  checkinsLoading: boolean;
  checkedIn: EventCheckin[];
  checkedOut: EventCheckin[];
  trackAttendance: boolean;
  requireCheckout: boolean;
  attendanceSessions: Array<{ date: string; items: EventCheckin[] }>;
  onExportCsv: () => void;
  isExporting: boolean;
}) {
  const [activeTab, setActiveTab] = useState("registrations");

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto w-full space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold">Check-In Desk</h1>
        <p className="text-muted-foreground mt-1">Search and check participants in or out for this event.</p>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full flex flex-wrap h-auto gap-1">
          <TabsTrigger value="registrations" className="gap-1.5 text-xs sm:text-sm flex-1">
            <ClipboardList className="w-4 h-4 shrink-0" />
            Registrations
            <Badge variant="secondary" className="text-xs ml-1">{registrations?.length ?? 0}</Badge>
          </TabsTrigger>
          {trackAttendance && (
            <TabsTrigger value="checked-in" className="gap-1.5 text-xs sm:text-sm flex-1">
              <LogIn className="w-4 h-4 shrink-0" />
              Checked In
              <Badge variant="secondary" className="text-xs ml-1">{checkedIn.length}</Badge>
            </TabsTrigger>
          )}
          {requireCheckout && (
            <TabsTrigger value="checked-out" className="gap-1.5 text-xs sm:text-sm flex-1">
              <LogOut className="w-4 h-4 shrink-0" />
              Checked Out
              <Badge variant="secondary" className="text-xs ml-1">{checkedOut.length}</Badge>
            </TabsTrigger>
          )}
          {trackAttendance && (
            <TabsTrigger value="attendance" className="gap-1.5 text-xs sm:text-sm flex-1">
              <BarChart2 className="w-4 h-4 shrink-0" />
              Attendance
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="registrations">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">
              {registrations?.length ?? 0} registration{registrations?.length === 1 ? "" : "s"}
            </p>
            <Button variant="outline" size="sm" onClick={onExportCsv} disabled={isExporting}>
              {isExporting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
              Export CSV
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              {regsLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading...</div>
              ) : !registrations?.length ? (
                <div className="p-10 text-center text-muted-foreground">
                  <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No registrations yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {registrations.map((reg) => (
                    <div key={reg.id} className="px-5 py-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium">{reg.childFirstName} {reg.childLastName}</p>
                        <p className="text-sm text-muted-foreground">{reg.guardianName} · {reg.guardianPhone}</p>
                      </div>
                      <p className="text-sm text-muted-foreground shrink-0">{format(new Date(reg.createdAt), "MMM d")}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

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
                      <p className="text-xs text-muted-foreground">{format(new Date(c.checkinAt), "h:mm a")}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

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
                      <div className="text-xs text-muted-foreground text-right">
                        <p>In: {format(new Date(c.checkinAt), "h:mm a")}</p>
                        {c.checkoutAt && <p className="text-amber-700">Out: {format(new Date(c.checkoutAt), "h:mm a")}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          {!attendanceSessions.length ? (
            <div className="p-10 text-center text-muted-foreground">
              <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No attendance recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {attendanceSessions.length} session{attendanceSessions.length !== 1 ? "s" : ""}
              </p>
              {attendanceSessions.map(({ date, items }) => (
                <Card key={date}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {format(new Date(date + "T00:00:00"), "EEEE, MMMM d, yyyy")}
                      </CardTitle>
                      <span className="text-sm text-muted-foreground">{items.length} attendees</span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {items
                        .sort((a, b) => new Date(a.checkinAt).getTime() - new Date(b.checkinAt).getTime())
                        .map((c) => (
                          <div key={c.id} className="px-5 py-2.5 flex items-center justify-between gap-4">
                            <p className="font-medium text-sm">{c.childFirstName} {c.childLastName}</p>
                            <p className="text-xs text-muted-foreground">In: {format(new Date(c.checkinAt), "h:mm a")}</p>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Section: Public Form ──────────────────────────────────────────────────────

function RegistrationFormSection({ event, eventId }: { event: EventWithForm; eventId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isChildCheckin = !event.registrationType || event.registrationType === "child_checkin";

  const registrationUrl = event.formEmbedSlug
    ? `${window.location.origin}/register/${event.formEmbedSlug}`
    : null;

  const embedCode = registrationUrl
    ? `<iframe src="${registrationUrl}" width="100%" height="800" frameborder="0" style="border:none;"></iframe>`
    : null;

  const copyUrl = () => {
    if (!registrationUrl) return;
    navigator.clipboard.writeText(registrationUrl);
    toast({ title: "Form URL copied!" });
  };

  const copyEmbed = () => {
    if (!embedCode) return;
    navigator.clipboard.writeText(embedCode);
    toast({ title: "Embed code copied!" });
  };

  const [formSettings, setFormSettings] = useState({
    title: event.form?.title ?? event.formTitle ?? "",
    description: event.form?.description ?? "",
    isActive: event.form?.isActive ?? true,
    isPublic: event.form?.isPublic ?? false,
  });

  const updateForm = useUpdateForm({
    mutation: {
      onSuccess: () => {
        if (event.formId) {
          queryClient.invalidateQueries({ queryKey: getGetFormQueryKey(event.formId) });
          queryClient.invalidateQueries({ queryKey: getGetEventQueryKey(eventId) });
        }
        toast({ title: "Form settings saved" });
      },
      onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
    },
  });

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto w-full space-y-5">
      <div>
        <h1 className="text-2xl font-serif font-bold">Registration Form</h1>
        <p className="text-muted-foreground mt-1">Build your form, share it, and configure settings.</p>
      </div>

      <Tabs defaultValue="build">
        <TabsList>
          <TabsTrigger value="build">Build Form</TabsTrigger>
          <TabsTrigger value="share">Share Form</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="build" className="mt-5">
          {event.formId ? (
            <FormBuilderPanel formId={event.formId} eventId={eventId} hideAdditionalPeople={isChildCheckin} hideSettings />
          ) : (
            <Card>
              <CardContent className="p-10 text-center text-muted-foreground">
                No registration form is linked to this event.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="share" className="mt-5">
          {!registrationUrl ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground">
                <FileEdit className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No registration form is linked to this event.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-5 max-w-3xl">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Direct Link</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg font-mono text-sm break-all">
                    {registrationUrl}
                  </div>
                  <div className="flex gap-2">
                    <a href={registrationUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="gap-2">
                        <ExternalLink className="w-3.5 h-3.5" /> Open Form
                      </Button>
                    </a>
                    <Button variant="outline" size="sm" className="gap-2" onClick={copyUrl}>
                      <Copy className="w-3.5 h-3.5" /> Copy URL
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Embed Code</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Paste this into your website to embed the registration form directly.
                  </p>
                  <div className="p-3 bg-muted rounded-lg font-mono text-xs break-all">
                    {embedCode}
                  </div>
                  <Button variant="outline" size="sm" className="gap-2" onClick={copyEmbed}>
                    <Copy className="w-3.5 h-3.5" /> Copy Embed Code
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="mt-5">
          <div className="space-y-5 max-w-2xl">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Form Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Form Title</Label>
                  <Input
                    value={formSettings.title}
                    onChange={(e) => setFormSettings((p) => ({ ...p, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Header Text</Label>
                  <Textarea
                    rows={2}
                    placeholder="Optional intro shown at the top of the form"
                    value={formSettings.description}
                    onChange={(e) => setFormSettings((p) => ({ ...p, description: e.target.value }))}
                  />
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <div>
                    <Label className="text-sm font-medium">Form is active</Label>
                    <p className="text-xs text-muted-foreground">Accepting new registrations</p>
                  </div>
                  <Switch
                    checked={formSettings.isActive}
                    onCheckedChange={(v) => setFormSettings((p) => ({ ...p, isActive: v }))}
                  />
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <div>
                    <Label className="text-sm font-medium">Form is public</Label>
                    <p className="text-xs text-muted-foreground">Visible via the public registration link</p>
                  </div>
                  <Switch
                    checked={formSettings.isPublic}
                    onCheckedChange={(v) => setFormSettings((p) => ({ ...p, isPublic: v }))}
                  />
                </div>
              </CardContent>
              <CardFooter className="border-t border-border pt-4">
                <Button
                  disabled={updateForm.isPending || !event.formId}
                  onClick={() => {
                    if (event.formId) updateForm.mutate({ formId: event.formId, data: formSettings });
                  }}
                >
                  {updateForm.isPending ? "Saving…" : "Save Settings"}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Section: Reports ──────────────────────────────────────────────────────────

function ReportsSection({
  checkins,
  checkedIn,
  checkedOut,
  attendanceSessions,
  trackAttendance,
  requireCheckout,
}: {
  checkins: EventCheckin[] | undefined;
  checkedIn: EventCheckin[];
  checkedOut: EventCheckin[];
  attendanceSessions: Array<{ date: string; items: EventCheckin[] }>;
  trackAttendance: boolean;
  requireCheckout: boolean;
}) {
  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto w-full space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold">Reports</h1>
        <p className="text-muted-foreground mt-1">View attendance history and check-in summaries.</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total Check-ins</p>
            <p className="text-3xl font-bold font-serif mt-1">{checkins?.length ?? 0}</p>
          </CardContent>
        </Card>
        {trackAttendance && (
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Currently In</p>
              <p className="text-3xl font-bold font-serif mt-1 text-green-700">{checkedIn.length}</p>
            </CardContent>
          </Card>
        )}
        {requireCheckout && (
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Checked Out</p>
              <p className="text-3xl font-bold font-serif mt-1 text-amber-700">{checkedOut.length}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Attendance sessions */}
      {!attendanceSessions.length ? (
        <div className="space-y-4">
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground">
              <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No attendance recorded yet.</p>
              <p className="text-sm mt-1">Once check-ins begin, attendance summaries will appear here.</p>
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {([
              { title: "Attendance by Date", desc: "Available after check-ins begin." },
              { title: "Room Attendance", desc: "Available after check-ins begin." },
              { title: "Registrant Attendance", desc: "Available after check-ins begin." },
            ] as const).map(({ title, desc }) => (
              <Card key={title} className="border-border/60">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-medium text-foreground">{title}</p>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wide shrink-0">
                      No data yet
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {attendanceSessions.length} session{attendanceSessions.length !== 1 ? "s" : ""} · {checkins?.length ?? 0} total check-ins
          </p>
          {attendanceSessions.map(({ date, items }) => (
            <Card key={date}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {format(new Date(date + "T00:00:00"), "EEEE, MMMM d, yyyy")}
                  </CardTitle>
                  <div className="flex flex-wrap justify-end gap-2 text-xs text-muted-foreground">
                    <span>Total check-ins: {items.length}</span>
                    <span>Currently in: {items.filter((item) => !item.checkoutAt).length}</span>
                    <span>Checked out: {items.filter((item) => !!item.checkoutAt).length}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {[...items]
                    .sort((a, b) => new Date(a.checkinAt).getTime() - new Date(b.checkinAt).getTime())
                    .map((c) => (
                      <div key={c.id} className="px-5 py-2.5 flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-sm">{c.childFirstName} {c.childLastName}</p>
                          {c.room && <p className="text-xs text-muted-foreground">{c.room}</p>}
                        </div>
                        <div className="text-right text-xs text-muted-foreground flex-shrink-0">
                          <p>In: {format(new Date(c.checkinAt), "h:mm a")}</p>
                          {c.checkoutAt && (
                            <p className="text-amber-700">Out: {format(new Date(c.checkoutAt), "h:mm a")}</p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section: Labels ───────────────────────────────────────────────────────────

// ─── Section: Event Settings ───────────────────────────────────────────────────

function EventSettingsSection({
  event,
  eventId,
}: {
  event: EventWithForm;
  eventId: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const { data: categories = [] } = useListEventCategories();
  const [createCatOpen, setCreateCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const createCategory = useCreateEventCategory({
    mutation: {
      onSuccess: (cat) => {
        queryClient.invalidateQueries({ queryKey: getListEventCategoriesQueryKey() });
        set("eventType")(cat.slug);
        setCreateCatOpen(false);
        setNewCatName("");
        toast({ title: `Category "${cat.name}" created` });
      },
      onError: () => toast({ title: "Failed to create category", variant: "destructive" }),
    },
  });

  const isChildCheckin = !event.registrationType || event.registrationType === "child_checkin";
  const scheduleType =
    (event.scheduleType === "repeating" || event.repeatDayOfWeek != null) ? "repeating"
    : (event.scheduleType === "multi_day" || (event.endDate && event.startDate && event.endDate !== event.startDate)) ? "multi_day"
    : "one_time";

  const [form, setForm] = useState({
    name: event.name,
    description: event.description ?? "",
    eventType: event.eventType,
    startDate: event.startDate ?? "",
    endDate: event.endDate ?? "",
    trackAttendance: event.trackAttendance ?? isChildCheckin,
  });

  const [labelSettings, setLabelSettings] = useState({
    printLabels: event.printLabels ?? isChildCheckin,
    labelType: event.labelType ?? (isChildCheckin ? "child_security" : "simple_name_tag"),
    requireCheckout: event.requireCheckout ?? isChildCheckin,
  });

  const [roomMode, setRoomMode] = useState(event.roomAssignmentMode ?? "manual");

  const updateRoomMode = useUpdateEvent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetEventQueryKey(eventId) });
        toast({ title: "Room settings saved" });
      },
      onError: () => toast({ title: "Failed to save room settings", variant: "destructive" }),
    },
  });

  const updateEvent = useUpdateEvent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetEventQueryKey(eventId) });
        toast({ title: "Settings saved" });
      },
      onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
    },
  });

  const updateLabels = useUpdateEvent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetEventQueryKey(eventId) });
        toast({ title: "Label settings saved" });
      },
      onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
    },
  });

  const set = <K extends keyof typeof form>(key: K) => (value: (typeof form)[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const deleteEvent = useDeleteEvent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
        toast({ title: "Event deleted" });
        navigate("/events");
      },
      onError: () => toast({ title: "Failed to delete event", variant: "destructive" }),
    },
  });

  return (
    <div className="p-6 md:p-8 max-w-[800px] mx-auto w-full space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold">Event Settings</h1>
        <p className="text-muted-foreground mt-1">Edit event details and check-in configuration.</p>
      </div>

      {/* Basic info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Event Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Event Name</Label>
            <Input value={form.name} onChange={(e) => set("name")(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Event Category</Label>
            <Select value={form.eventType} onValueChange={set("eventType")}>
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
            <Textarea rows={2} value={form.description} onChange={(e) => set("description")(e.target.value)} />
          </div>
          {/* Schedule display — varies by type */}
          {scheduleType === "repeating" ? (
            <div className="rounded-lg border border-border bg-muted/30 p-3.5 space-y-2">
              <div className="flex items-center gap-2">
                <Repeat className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold">Repeating Schedule</p>
              </div>
              <div className="text-sm space-y-1 pl-6">
                {event.repeatDayOfWeek != null && (
                  <p className="text-foreground">
                    Every <span className="font-medium">{["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][event.repeatDayOfWeek]}</span>
                    {event.repeatFrequency ? ` (${event.repeatFrequency})` : ""}
                  </p>
                )}
                {event.startDate && event.endDate && (
                  <p className="text-muted-foreground">
                    {format(new Date(event.startDate + "T00:00:00"), "MMM d, yyyy")} – {format(new Date(event.endDate + "T00:00:00"), "MMM d, yyyy")}
                  </p>
                )}
                {event.sessionCount != null && (
                  <p className="text-muted-foreground">{event.sessionCount} sessions scheduled</p>
                )}
                {event.nextSessionDate && (
                  <p className="text-muted-foreground">Next: {format(new Date(event.nextSessionDate + "T00:00:00"), "EEEE, MMM d, yyyy")}</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground pl-6">To change the schedule, create a new event.</p>
            </div>
          ) : scheduleType === "multi_day" ? (
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
                  onChange={(e) => set("endDate")(e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.startDate} onChange={(e) => set("startDate")(e.target.value)} />
            </div>
          )}
        </CardContent>
        <CardFooter className="border-t border-border pt-4">
          <Button
            className="w-full"
            disabled={updateEvent.isPending}
            onClick={() => updateEvent.mutate({ eventId, data: form })}
          >
            {updateEvent.isPending ? "Saving…" : "Save Event Details"}
          </Button>
        </CardFooter>
      </Card>

      {/* Attendance */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-primary" /> Attendance &amp; Check-In
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-0.5">
            <div>
              <Label className="text-sm font-medium">Track attendance with check-ins</Label>
              <p className="text-xs text-muted-foreground">Enable the check-in kiosk for this event</p>
            </div>
            <Switch
              checked={form.trackAttendance}
              onCheckedChange={set("trackAttendance")}
            />
          </div>
        </CardContent>
        <CardFooter className="border-t border-border pt-4">
          <Button
            className="w-full"
            disabled={updateEvent.isPending}
            onClick={() => updateEvent.mutate({ eventId, data: form })}
          >
            {updateEvent.isPending ? "Saving…" : "Save Settings"}
          </Button>
        </CardFooter>
      </Card>

      {/* Check-In & Labels */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="w-4 h-4 text-primary" /> Check-In &amp; Labels
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Print labels at check-in</Label>
              <p className="text-xs text-muted-foreground">Print a label for each person when they check in.</p>
            </div>
            <Switch
              checked={labelSettings.printLabels}
              onCheckedChange={(v) => setLabelSettings((p) => ({ ...p, printLabels: v }))}
            />
          </div>

          {labelSettings.printLabels && (
            <div className="space-y-2 pl-3 border-l-2 border-border">
              <Label className="text-sm text-muted-foreground">Label type</Label>
              <Select
                value={labelSettings.labelType}
                onValueChange={(v) => setLabelSettings((p) => ({ ...p, labelType: v }))}
              >
                <SelectTrigger>
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
              <div className="pt-1 text-xs text-muted-foreground">
                {labelSettings.labelType === "simple_name_tag" && (
                  <p>Prints only the person's name on a 2″×4″ label.</p>
                )}
                {labelSettings.labelType === "simple_name" && (
                  <p>Prints the child's name, guardian, room, and allergies on a 2″×4″ label.</p>
                )}
                {labelSettings.labelType === "child_security" && (
                  <p>Prints child name, guardian, allergies, room, and a unique pickup security code.</p>
                )}
              </div>
            </div>
          )}

          {labelSettings.printLabels && isChildCheckin && (
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Require check-out</Label>
                <p className="text-xs text-muted-foreground">Staff must scan the security code at pickup.</p>
              </div>
              <Switch
                checked={labelSettings.requireCheckout}
                onCheckedChange={(v) => setLabelSettings((p) => ({ ...p, requireCheckout: v }))}
              />
            </div>
          )}
        </CardContent>
        <CardFooter className="border-t border-border pt-4">
          <Button
            className="w-full"
            disabled={updateLabels.isPending}
            onClick={() => updateLabels.mutate({ eventId, data: labelSettings })}
          >
            {updateLabels.isPending ? "Saving…" : "Save Label Settings"}
          </Button>
        </CardFooter>
      </Card>

      {/* Room Assignment */}
      {isChildCheckin && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DoorOpen className="w-4 h-4 text-primary" /> Room Assignment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Assignment mode</Label>
              <Select value={roomMode} onValueChange={setRoomMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual — staff assigns rooms</SelectItem>
                  <SelectItem value="registrant_chooses">Registrant chooses — shown on registration form</SelectItem>
                  <SelectItem value="auto_assign">Auto-assign — not yet implemented</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {roomMode === "manual" && "Admins and staff assign rooms to each child individually."}
                {roomMode === "registrant_chooses" && "Families pick a room when registering. A room selector will appear on the public registration form."}
                {roomMode === "auto_assign" && "Rooms will be assigned automatically based on age or grade when a registration is submitted."}
              </p>
            </div>
          </CardContent>
          <CardFooter className="border-t border-border pt-4">
            <Button
              className="w-full"
              disabled={updateRoomMode.isPending}
              onClick={() => updateRoomMode.mutate({ eventId, data: { roomAssignmentMode: roomMode } })}
            >
              {updateRoomMode.isPending ? "Saving…" : "Save Room Settings"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Danger Zone */}
      <Card className="border-destructive/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-4 h-4" /> Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div>
              <p className="font-medium text-sm">Delete this event</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Permanently removes this event. The linked registration form and its registrations will not be deleted.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="flex-shrink-0 gap-1.5"
              onClick={() => { setDeleteConfirmText(""); setDeleteDialogOpen(true); }}
            >
              <Trash2 className="w-4 h-4" />
              Delete Event
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) setDeleteConfirmText(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <DialogTitle className="text-destructive">Delete "{event.name}"?</DialogTitle>
            </div>
            <DialogDescription className="pt-1">
              This will permanently delete this event. The linked registration form and its registrations will not be deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="delete-event-confirm" className="text-sm">
              Type <span className="font-mono font-bold text-destructive">DELETE</span> to confirm
            </Label>
            <Input
              id="delete-event-confirm"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="font-mono"
              autoComplete="off"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => { setDeleteDialogOpen(false); setDeleteConfirmText(""); }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmText !== "DELETE" || deleteEvent.isPending}
              onClick={() => deleteEvent.mutate({ eventId })}
              className="gap-1.5"
            >
              {deleteEvent.isPending ? "Deleting…" : <><Trash2 className="w-4 h-4" /> Delete Event</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Workspace ─────────────────────────────────────────────────────────────

export default function EventWorkspace() {
  const params = useParams<{ id: string }>();
  const eventId = parseInt(params.id || "0", 10);
  const [location] = useLocation();
  const sectionMatch = location.match(/^\/events\/\d+\/?(.*)$/);
  const section = sectionMatch?.[1]?.split("?")[0] || "";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isExporting, setIsExporting] = useState(false);
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
  const { data: eventSessions } = useListEventSessions(eventId, {
    query: { enabled: !!eventId, queryKey: getListEventSessionsQueryKey(eventId) },
  });

  const todayStr = getLocalDateKey();
  const eventStartDate = event?.startDate ?? null;
  const eventEndDate = event?.endDate || event?.startDate || null;
  const eventSessionsInRange = useMemo(() => {
    if (!eventSessions?.length || !eventStartDate) return eventSessions ?? [];
    const endDate = eventEndDate || eventStartDate;
    return eventSessions
      .filter((session) => {
        if (session.sessionDate < eventStartDate || session.sessionDate > endDate) return false;
        if (event?.scheduleType === "repeating" && event.repeatDayOfWeek != null) {
          return getLocalDateDayOfWeek(session.sessionDate) === event.repeatDayOfWeek;
        }
        return true;
      })
      .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
  }, [eventSessions, eventStartDate, eventEndDate, event?.scheduleType, event?.repeatDayOfWeek]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null | undefined>(undefined);
  const defaultSessionId = useMemo(() => {
    if (!eventSessionsInRange.length) return null;
    // Exact match for today
    const todaySession = eventSessionsInRange.find((s) => s.sessionDate === todayStr);
    if (todaySession) return todaySession.id;
    // Next upcoming session (first date strictly after today)
    const nextSession = eventSessionsInRange.find((s) => s.sessionDate > todayStr);
    if (nextSession) return nextSession.id;
    // All sessions are in the past — use the most recent one
    return eventSessionsInRange[eventSessionsInRange.length - 1]?.id ?? null;
  }, [eventSessionsInRange, todayStr]);
  const resolvedSessionId = selectedSessionId === undefined ? defaultSessionId : selectedSessionId;
  const previousSectionRef = useRef(section);

  useEffect(() => {
    if (selectedSessionId === undefined && defaultSessionId != null) {
      setSelectedSessionId(defaultSessionId);
      return;
    }
    if (
      selectedSessionId != null &&
      eventSessionsInRange.length > 0 &&
      !eventSessionsInRange.some((session) => session.id === selectedSessionId) &&
      defaultSessionId != null
    ) {
      setSelectedSessionId(defaultSessionId);
    }
  }, [defaultSessionId, eventSessionsInRange, selectedSessionId]);

  useEffect(() => {
    const previousSection = previousSectionRef.current;
    previousSectionRef.current = section;
    if (section === "checkin" && previousSection !== "checkin" && defaultSessionId != null) {
      setSelectedSessionId(defaultSessionId);
    }
  }, [defaultSessionId, section]);

  const attendanceSessions = useMemo(() => {
    if (!checkins?.length && !eventSessionsInRange.length) return [];
    const sessionDateById = new Map(eventSessionsInRange.map((session) => [session.id, session.sessionDate]));
    const byDate = new Map<string, EventCheckin[]>();
    for (const c of checkins ?? []) {
      const dateKey = c.sessionId != null
        ? (sessionDateById.get(c.sessionId) ?? format(new Date(c.checkinAt), "yyyy-MM-dd"))
        : format(new Date(c.checkinAt), "yyyy-MM-dd");
      if (!byDate.has(dateKey)) byDate.set(dateKey, []);
      byDate.get(dateKey)!.push(c);
    }
    for (const session of eventSessionsInRange) {
      if (!byDate.has(session.sessionDate)) byDate.set(session.sessionDate, []);
    }
    return [...byDate.entries()]
      .map(([date, items]) => ({ date, items }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [checkins, eventSessionsInRange]);

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const res = await fetch(`/api/events/${eventId}/registrations/export`);
      if (!res.ok) throw new Error("Export failed");
      const data = await res.json() as {
        eventName: string;
        rows: Array<{
          id: number;
          submittedAt: string;
          firstName: string;
          lastName: string;
          fullName: string;
          guardianName: string;
          guardianPhone: string;
          guardianEmail: string;
          secondaryGuardianFirstName: string;
          secondaryGuardianLastName: string;
          secondaryGuardianPhone: string;
          secondaryGuardianEmail: string;
          secondaryGuardianRelationship: string;
          allergies: string;
          specialNeeds: string;
          room: string;
          checkinStatus: string;
          checkedInAt: string;
          checkedOutAt: string;
          customAnswers: Record<string, string>;
        }>;
        customColumns: string[];
      };

      const cell = (v: string | number | null | undefined): string => {
        const s = String(v ?? "");
        return /[,"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };

      const fixedHeaders = [
        "Registration ID", "Submitted At",
        "First Name", "Last Name", "Full Name",
        "Guardian Name", "Guardian Phone", "Guardian Email",
        "Secondary Guardian First Name", "Secondary Guardian Last Name",
        "Secondary Guardian Phone", "Secondary Guardian Email", "Secondary Guardian Relationship",
        "Allergies", "Special Needs", "Room",
        "Check-In Status", "Checked In At", "Checked Out At",
      ];
      const allHeaders = [...fixedHeaders, ...data.customColumns];

      const dataRows = data.rows.map((row) =>
        [
          cell(row.id), cell(row.submittedAt),
          cell(row.firstName), cell(row.lastName), cell(row.fullName),
          cell(row.guardianName), cell(row.guardianPhone), cell(row.guardianEmail),
          cell(row.secondaryGuardianFirstName), cell(row.secondaryGuardianLastName),
          cell(row.secondaryGuardianPhone), cell(row.secondaryGuardianEmail), cell(row.secondaryGuardianRelationship),
          cell(row.allergies), cell(row.specialNeeds), cell(row.room),
          cell(row.checkinStatus), cell(row.checkedInAt), cell(row.checkedOutAt),
          ...data.customColumns.map((col) => cell(row.customAnswers[col] ?? "")),
        ].join(",")
      );

      const csv = "﻿" + [allHeaders.map(cell).join(","), ...dataRows].join("\r\n");
      const slug = data.eventName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${slug}-registrations.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Export failed. Please try again.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
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
        <Button asChild variant="link" className="mt-2"><Link href="/">Back to Events</Link></Button>
      </div>
    );
  }

  const checkedIn = checkins?.filter((c) => !c.checkoutAt) ?? [];
  const checkedOut = checkins?.filter((c) => !!c.checkoutAt) ?? [];

  const isChildCheckin = !event.registrationType || event.registrationType === "child_checkin";
  const trackAttendance = event.trackAttendance ?? isChildCheckin;
  const requireCheckout = event.requireCheckout ?? (isChildCheckin && trackAttendance);
  const labelType = event.labelType ?? (requireCheckout ? "child_security" : "simple_name_tag");

  // ── Check-In Desk ──
  if (section === "checkin") {
    return (
      <div className="p-6 md:p-8 max-w-[1200px] mx-auto w-full space-y-5">
        <CheckInDeskContent
          eventId={eventId}
          eventName={event.name}
          formId={event.formId}
          embedSlug={event.formEmbedSlug}
          registrations={registrations}
          checkins={checkins}
          regsLoading={regsLoading}
          checkinsLoading={checkinsLoading}
          labelType={labelType}
          requireCheckout={requireCheckout}
          isChildEvent={isChildCheckin}
          attendanceSessions={attendanceSessions}
          onExportCsv={handleExportCsv}
          isExporting={isExporting}
          sessions={eventSessionsInRange}
          selectedSessionId={resolvedSessionId}
          onSessionChange={setSelectedSessionId}
          initialPrintLabels={event.printLabels ?? isChildCheckin}
        />
      </div>
    );
  }

  // ── Registrations ──
  if (section === "registrations") {
    return (
      <div className="p-6 md:p-8 max-w-[1200px] mx-auto w-full space-y-5">
        <ChildrenTabContent
          eventId={eventId}
          formId={event.formId}
          embedSlug={event.formEmbedSlug}
          isChildCheckin={isChildCheckin}
          onExportCsv={handleExportCsv}
          isExporting={isExporting}
        />
      </div>
    );
  }

  // ── Groups (family/group events) ──
  if (section === "groups") {
    return (
      <div className="p-6 md:p-8 max-w-[1200px] mx-auto w-full space-y-5">
        <div>
          <h1 className="text-2xl font-serif font-bold">Groups</h1>
          <p className="text-muted-foreground mt-1">View and manage family and group registrations.</p>
        </div>
        <FamiliesTabContent eventId={eventId} />
      </div>
    );
  }

  // ── Rooms ──
  if (section === "rooms") {
    return (
      <div className="p-6 md:p-8 max-w-[1200px] mx-auto w-full space-y-5">
        <div>
          <h1 className="text-2xl font-serif font-bold">Rooms</h1>
          <p className="text-muted-foreground mt-1">Create rooms or groups and assign registrants.</p>
        </div>
        <RoomsTabContent eventId={eventId} formId={event.formId} roomAssignmentMode={event.roomAssignmentMode} />
      </div>
    );
  }

  // ── Registration Form (Build / Share / Settings tabs) ──
  if (section === "form") {
    return <RegistrationFormSection event={event} eventId={eventId} />;
  }

  // ── Reports ──
  if (section === "reports") {
    return (
      <ReportsSection
        checkins={checkins}
        checkedIn={checkedIn}
        checkedOut={checkedOut}
        attendanceSessions={attendanceSessions}
        trackAttendance={trackAttendance}
        requireCheckout={requireCheckout}
      />
    );
  }

  // ── Event Settings ──
  if (section === "settings") {
    return <EventSettingsSection event={event} eventId={eventId} />;
  }

  // ── Dashboard (default) ──
  return (
    <EventDashboardSection
      event={event}
      eventId={eventId}
      registrations={registrations}
      checkins={checkins}
      checkedIn={checkedIn}
      checkedOut={checkedOut}
      isChildCheckin={isChildCheckin}
      trackAttendance={trackAttendance}
      requireCheckout={requireCheckout}
      onExportCsv={handleExportCsv}
      isExporting={isExporting}
    />
  );
}
