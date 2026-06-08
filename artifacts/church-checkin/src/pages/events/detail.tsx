import { Link, useParams, useSearch } from "wouter";
import { useState, useEffect, useMemo } from "react";
import {
  useGetEvent,
  useUpdateEvent,
  useListRegistrations,
  useListEventCheckins,
  useCheckoutChild,
  useDeleteCheckin,
  useUndoCheckout,
  useListChildren,
  useUpdateRegistration,
  useListRooms,
  useCreateRoom,
  useUpdateRoom,
  useDeleteRoom,
  getGetEventQueryKey,
  getListRegistrationsQueryKey,
  getListEventCheckinsQueryKey,
  getListChildrenQueryKey,
  getListRoomsQueryKey,
  type Child,
  type Room,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  FileEdit,
  Download,
  BarChart2,
  DoorOpen,
  Plus,
  Pencil,
  Trash2,
  Search,
  Baby,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { FormBuilderPanel } from "@/components/forms/FormBuilderPanel";

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

// ─── Rooms tab ─────────────────────────────────────────────────────────────────

function EventRoomFormDialog({ room, open, onOpenChange }: { room?: Room; open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!room;
  const [name, setName] = useState(room?.name ?? "");
  const [capacity, setCapacity] = useState(room?.capacity != null ? String(room.capacity) : "");

  const createRoom = useCreateRoom({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey() }); toast({ title: "Room created" }); onOpenChange(false); }, onError: () => toast({ title: "Failed to create room", variant: "destructive" }) } });
  const updateRoom = useUpdateRoom({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey() }); toast({ title: "Room updated" }); onOpenChange(false); }, onError: () => toast({ title: "Failed to update room", variant: "destructive" }) } });
  const isPending = createRoom.isPending || updateRoom.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const cap = capacity ? parseInt(capacity, 10) : undefined;
    if (isEdit) updateRoom.mutate({ roomId: room!.id, data: { name: name.trim(), capacity: cap } });
    else createRoom.mutate({ data: { name: name.trim(), capacity: cap } });
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

function RoomsTabContent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: rooms, isLoading } = useListRooms();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const deleteRoom = useDeleteRoom({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey() }); toast({ title: "Room deleted" }); setDeletingId(null); },
      onError: () => { toast({ title: "Failed to delete room", variant: "destructive" }); setDeletingId(null); },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{rooms?.length ?? 0} room{rooms?.length === 1 ? "" : "s"}</p>
        <Button size="sm" className="gap-1.5" onClick={() => { setEditingRoom(undefined); setDialogOpen(true); }}>
          <Plus className="w-3.5 h-3.5" /> Add Room
        </Button>
      </div>

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
          {rooms.map((room) => (
            <Card key={room.id}>
              <CardContent className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <DoorOpen className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{room.name}</p>
                    {room.capacity != null && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" /> Capacity: {room.capacity}
                      </p>
                    )}
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
                    onClick={() => { setDeletingId(room.id); deleteRoom.mutate({ roomId: room.id }); }}
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
  const { data: rooms } = useListRooms();

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
    specialNeeds: child.specialNeeds ?? "",
    room: child.room ?? "",
  });

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, [field]: e.target.value }));

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
        allergies: form.allergies.trim() || undefined,
        specialNeeds: form.specialNeeds.trim() || undefined,
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
            <div className="space-y-1.5"><Label>Allergies</Label><Input value={form.allergies} onChange={set("allergies")} placeholder="e.g. peanuts, latex" /></div>
            <div className="space-y-1.5"><Label>Special Needs / Notes</Label><Input value={form.specialNeeds} onChange={set("specialNeeds")} /></div>
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

function ChildrenTabContent({
  eventId,
  searchPlaceholder = "Search children…",
  emptyMessage = "No children registered for this event yet.",
  emptyIcon: EmptyIcon = Baby,
}: {
  eventId: number;
  searchPlaceholder?: string;
  emptyMessage?: string;
  emptyIcon?: React.ComponentType<{ className?: string }>;
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [editingChild, setEditingChild] = useState<Child | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: children, isLoading } = useListChildren({ eventId, search: debouncedSearch || undefined });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder={searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <p className="text-sm text-muted-foreground shrink-0">
          {children?.length ?? 0} registered
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : !children?.length ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <EmptyIcon className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p>{search ? `No results matching "${search}"` : emptyMessage}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {children.map((child) => (
            <Card key={child.id} className="group">
              <CardContent className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-serif font-bold text-primary text-sm flex-shrink-0">
                    {child.firstName[0]}{child.lastName[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium">{child.firstName} {child.lastName}</p>
                    <p className="text-xs text-muted-foreground">
                      {child.guardianName}{child.room ? ` · ${child.room}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {child.allergies && (
                    <Badge className="text-[10px] bg-red-100 text-red-800 hover:bg-red-100 border-none">Allergy</Badge>
                  )}
                  <Button
                    variant="ghost" size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setEditingChild(child)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editingChild && (
        <EventEditChildDialog
          key={editingChild.id}
          child={editingChild}
          open={!!editingChild}
          onOpenChange={(v) => { if (!v) setEditingChild(null); }}
        />
      )}
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

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function EventDetail() {
  const params = useParams<{ id: string }>();
  const eventId = parseInt(params.id || "0", 10);
  const search = useSearch();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const initialTab = new URLSearchParams(search).get("tab") ?? "registrations";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [view, setView] = useState<"activity" | "manage">("activity");
  const [manageTab, setManageTab] = useState("children");

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

  const updateEvent = useUpdateEvent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetEventQueryKey(eventId) });
        toast({ title: "Settings saved" });
      },
      onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
    },
  });

  const [checkinSettings, setCheckinSettings] = useState({
    trackAttendance: false,
    requireCheckout: false,
    printLabels: false,
    labelType: "simple_name",
  });

  useEffect(() => {
    if (!event) return;
    const type = event.registrationType;
    const isChild = !type || type === "child_checkin";
    setManageTab(isChild ? "children" : type === "individual" ? "registrants" : "registrations");
    setCheckinSettings({
      trackAttendance: event.trackAttendance ?? isChild,
      requireCheckout: event.requireCheckout ?? isChild,
      printLabels: event.printLabels ?? isChild,
      labelType: event.labelType ?? (isChild ? "child_security" : "simple_name"),
    });
  }, [event?.id]);

  const attendanceSessions = useMemo(() => {
    if (!checkins?.length) return [];
    const byDate = new Map<string, typeof checkins>();
    for (const c of checkins) {
      const dateKey = format(new Date(c.checkinAt), "yyyy-MM-dd");
      if (!byDate.has(dateKey)) byDate.set(dateKey, []);
      byDate.get(dateKey)!.push(c);
    }
    return [...byDate.entries()]
      .map(([date, items]) => ({ date, items }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [checkins]);

  const copyEmbedCode = () => {
    if (!event?.formEmbedSlug) return;
    const url = `${window.location.origin}/register/${event.formEmbedSlug}`;
    const code = `<iframe src="${url}" width="100%" height="800" frameborder="0" style="border:none;"></iframe>`;
    navigator.clipboard.writeText(code);
    toast({ title: "Embed code copied!" });
  };

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
        "Allergies", "Special Needs", "Room",
        "Check-In Status", "Checked In At", "Checked Out At",
      ];
      const allHeaders = [...fixedHeaders, ...data.customColumns];

      const dataRows = data.rows.map((row) =>
        [
          cell(row.id), cell(row.submittedAt),
          cell(row.firstName), cell(row.lastName), cell(row.fullName),
          cell(row.guardianName), cell(row.guardianPhone), cell(row.guardianEmail),
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
        <Button asChild variant="link" className="mt-2"><Link href="/events">Back to Events</Link></Button>
      </div>
    );
  }

  const registrationUrl = event.formEmbedSlug
    ? `${window.location.origin}/register/${event.formEmbedSlug}`
    : null;

  const checkedIn = checkins?.filter((c) => !c.checkoutAt) ?? [];
  const checkedOut = checkins?.filter((c) => !!c.checkoutAt) ?? [];

  const isChildCheckin = !event.registrationType || event.registrationType === "child_checkin";
  const isFamilyGroup = event.registrationType === "family_group";
  const isIndividual = event.registrationType === "individual";
  const trackAttendance = event.trackAttendance ?? isChildCheckin;
  const requireCheckout = event.requireCheckout ?? (isChildCheckin && trackAttendance);
  const labelType = event.labelType ?? (requireCheckout ? "child_security" : "simple_name");

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
        {trackAttendance && (
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
        )}
        {requireCheckout && (
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
        )}
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

      {/* ── View toggle ── */}
      <div className="flex items-center justify-center">
        <div className="inline-flex rounded-lg border border-border bg-muted p-1 gap-1">
          <button
            type="button"
            onClick={() => setView("activity")}
            className={`px-5 py-1.5 rounded-md text-sm font-medium transition-all ${
              view === "activity"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Activity
          </button>
          <button
            type="button"
            onClick={() => setView("manage")}
            className={`px-5 py-1.5 rounded-md text-sm font-medium transition-all ${
              view === "manage"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Manage
          </button>
        </div>
      </div>

      {/* ── Activity section ── */}
      {view === "activity" && (
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="sr-only" />
        <TabsList className="w-full flex flex-wrap h-auto gap-1 mb-4">
          <TabsTrigger value="registrations" className="gap-1.5 text-xs sm:text-sm flex-1">
            <ClipboardList className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Registrations</span>
            <Badge variant="secondary" className="text-xs ml-1">{registrations?.length ?? 0}</Badge>
          </TabsTrigger>
          {trackAttendance && (
            <TabsTrigger value="checked-in" className="gap-1.5 text-xs sm:text-sm flex-1">
              <LogIn className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Checked In</span>
              <Badge variant="secondary" className="text-xs ml-1">{checkedIn.length}</Badge>
            </TabsTrigger>
          )}
          {requireCheckout && (
            <TabsTrigger value="checked-out" className="gap-1.5 text-xs sm:text-sm flex-1">
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Checked Out</span>
              <Badge variant="secondary" className="text-xs ml-1">{checkedOut.length}</Badge>
            </TabsTrigger>
          )}
          {trackAttendance && (
            <TabsTrigger value="attendance" className="gap-1.5 text-xs sm:text-sm flex-1">
              <BarChart2 className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Attendance</span>
            </TabsTrigger>
          )}
        </TabsList>

        <div>

            {/* ── Registrations ── */}
            <TabsContent value="registrations">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">
                  {registrations?.length ?? 0} registration{registrations?.length === 1 ? "" : "s"}
                </p>
                <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={isExporting}>
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
                              {labelType === "child_security" && c.labelCode && (
                                <p className="font-mono font-bold text-sm text-green-700 bg-green-50 px-2 py-0.5 rounded">{c.labelCode}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(c.checkinAt), "h:mm a")}</p>
                            </div>
                            <div className="flex flex-col gap-1 items-end">
                              {requireCheckout && (
                                <Button
                                  variant="outline" size="sm"
                                  className="text-muted-foreground hover:text-destructive hover:border-destructive gap-1"
                                  disabled={loadingId === c.id}
                                  onClick={() => { setLoadingId(c.id); checkoutChild.mutate({ checkinId: c.id }); }}
                                >
                                  {loadingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                                  Check Out
                                </Button>
                              )}
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
                            <Button
                              variant="outline" size="sm"
                              className="gap-1 text-muted-foreground hover:text-primary hover:border-primary"
                              disabled={loadingId === c.id}
                              onClick={() => { setLoadingId(c.id); undoCheckout.mutate({ checkinId: c.id }); }}
                            >
                              {loadingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
                              Undo Checkout
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Attendance History ── */}
            <TabsContent value="attendance">
              {checkinsLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading...</div>
              ) : !attendanceSessions.length ? (
                <div className="p-10 text-center text-muted-foreground">
                  <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No attendance recorded yet.</p>
                  <p className="text-sm mt-1">Check-ins will appear here grouped by date.</p>
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
                          <span className="text-sm font-medium text-muted-foreground">
                            {items.length} {items.length === 1 ? "child" : "children"}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="divide-y divide-border">
                          {items
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
            </TabsContent>
        </div>
      </Tabs>
      )}

      {/* ── Manage section ── */}
      {view === "manage" && (
      <Tabs value={manageTab} onValueChange={setManageTab}>
        <div className="sr-only" />

        {/* Tabs vary by registration type */}
        {isChildCheckin ? (
          <TabsList className="w-full grid grid-cols-3 mb-4">
            <TabsTrigger value="children" className="gap-1.5 text-xs sm:text-sm">
              <Baby className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Children</span>
            </TabsTrigger>
            <TabsTrigger value="rooms" className="gap-1.5 text-xs sm:text-sm">
              <DoorOpen className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Rooms</span>
            </TabsTrigger>
            <TabsTrigger value="form" className="gap-1.5 text-xs sm:text-sm">
              <FileEdit className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Form Builder</span>
            </TabsTrigger>
          </TabsList>
        ) : isFamilyGroup ? (
          <TabsList className="w-full grid grid-cols-3 mb-4">
            <TabsTrigger value="registrations" className="gap-1.5 text-xs sm:text-sm">
              <ClipboardList className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Registrations</span>
            </TabsTrigger>
            <TabsTrigger value="families" className="gap-1.5 text-xs sm:text-sm">
              <Users className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Families/Groups</span>
            </TabsTrigger>
            <TabsTrigger value="form" className="gap-1.5 text-xs sm:text-sm">
              <FileEdit className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Form Builder</span>
            </TabsTrigger>
          </TabsList>
        ) : (
          <TabsList className="w-full grid grid-cols-2 mb-4">
            <TabsTrigger value="registrants" className="gap-1.5 text-xs sm:text-sm">
              <ClipboardList className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Registrants</span>
            </TabsTrigger>
            <TabsTrigger value="form" className="gap-1.5 text-xs sm:text-sm">
              <FileEdit className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Form Builder</span>
            </TabsTrigger>
          </TabsList>
        )}

        <div className={`grid grid-cols-1 gap-8 ${manageTab !== "form" ? "md:grid-cols-3" : ""}`}>
          <div className={manageTab !== "form" ? "md:col-span-2" : ""}>
            {/* Child check-in tabs */}
            <TabsContent value="children">
              <ChildrenTabContent eventId={eventId} />
            </TabsContent>
            <TabsContent value="rooms">
              <RoomsTabContent />
            </TabsContent>

            {/* Family / Group tabs */}
            <TabsContent value="registrations">
              <ChildrenTabContent
                eventId={eventId}
                searchPlaceholder="Search registrants…"
                emptyMessage="No registrants yet."
                emptyIcon={Users}
              />
            </TabsContent>
            <TabsContent value="families">
              <FamiliesTabContent eventId={eventId} />
            </TabsContent>

            {/* Individual tab */}
            <TabsContent value="registrants">
              <ChildrenTabContent
                eventId={eventId}
                searchPlaceholder="Search registrants…"
                emptyMessage="No registrants yet."
                emptyIcon={Users}
              />
            </TabsContent>

            {/* Shared Form Builder tab */}
            <TabsContent value="form">
              {event.formId ? (
                <FormBuilderPanel formId={event.formId} hideAdditionalPeople={event.registrationType === "child_checkin"} />
              ) : (
                <Card>
                  <CardContent className="p-10 text-center text-muted-foreground">
                    No registration form is linked to this event.
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </div>

          {/* Sidebar — shown alongside Children and Rooms, hidden for Form Builder */}
          {manageTab !== "form" && (
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

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-primary" /> Check-In &amp; Labels
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between py-0.5">
                    <div>
                      <Label className="text-sm font-medium">Track attendance</Label>
                      <p className="text-xs text-muted-foreground">Enable check-in kiosk</p>
                    </div>
                    <Switch
                      checked={checkinSettings.trackAttendance}
                      onCheckedChange={(v) => setCheckinSettings((p) => ({
                        ...p,
                        trackAttendance: v,
                        requireCheckout: v ? p.requireCheckout : false,
                        printLabels: v ? p.printLabels : false,
                      }))}
                    />
                  </div>
                  {checkinSettings.trackAttendance && isChildCheckin && (
                    <div className="flex items-center justify-between py-0.5 ml-2 border-l-2 border-border pl-3">
                      <div>
                        <Label className="text-sm font-medium">Require check-out</Label>
                        <p className="text-xs text-muted-foreground">Security codes at pickup</p>
                      </div>
                      <Switch
                        checked={checkinSettings.requireCheckout}
                        onCheckedChange={(v) => setCheckinSettings((p) => ({ ...p, requireCheckout: v }))}
                      />
                    </div>
                  )}
                  {checkinSettings.trackAttendance && (
                    <div className="flex items-center justify-between py-0.5 ml-2 border-l-2 border-border pl-3">
                      <div>
                        <Label className="text-sm font-medium">Print labels</Label>
                        <p className="text-xs text-muted-foreground">Label at check-in</p>
                      </div>
                      <Switch
                        checked={checkinSettings.printLabels}
                        onCheckedChange={(v) => setCheckinSettings((p) => ({ ...p, printLabels: v }))}
                      />
                    </div>
                  )}
                  {checkinSettings.trackAttendance && checkinSettings.printLabels && (
                    <div className="ml-2 pl-3 border-l-2 border-border">
                      <Label className="text-xs text-muted-foreground mb-1 block">Label type</Label>
                      <Select
                        value={checkinSettings.labelType}
                        onValueChange={(v) => setCheckinSettings((p) => ({ ...p, labelType: v }))}
                      >
                        <SelectTrigger className="h-8 text-xs">
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
                </CardContent>
                <CardFooter className="pt-0">
                  <Button
                    size="sm" className="w-full"
                    disabled={updateEvent.isPending}
                    onClick={() => updateEvent.mutate({ eventId, data: checkinSettings })}
                  >
                    {updateEvent.isPending ? "Saving…" : "Save Settings"}
                  </Button>
                </CardFooter>
              </Card>

              {checkinSettings.trackAttendance && (
                <Button asChild className="w-full">
                  <Link href="/checkin">
                    <CheckSquare className="w-4 h-4 mr-2" /> Go to Check-In Kiosk
                  </Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </Tabs>
      )}
    </div>
  );
}
