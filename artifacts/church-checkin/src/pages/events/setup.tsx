import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useCreateEvent,
  useCreateRoom,
  getListEventsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Baby,
  Users,
  User,
  ArrowLeft,
  Check,
  Plus,
  Trash2,
  DoorOpen,
  FileText,
  CheckSquare,
  ChevronRight,
  Church,
  Pencil,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const EVENT_TYPES = [
  { value: "vbs", label: "Vacation Bible School (VBS)" },
  { value: "awana", label: "AWANA" },
  { value: "sunday_school", label: "Sunday School" },
  { value: "youth_group", label: "Youth Group" },
  { value: "camp", label: "Camp" },
  { value: "special_event", label: "Special Event" },
  { value: "general", label: "General / Other" },
];

const REGISTRATION_TYPES = [
  {
    value: "child_checkin",
    label: "Child Check-In",
    Icon: Baby,
    description: "For kids programs where parents register children and staff check children in and out securely.",
    features: ["Child profiles", "Guardian and pickup info", "Check-in / check-out"],
  },
  {
    value: "family_group",
    label: "Family or Group",
    Icon: Users,
    description: "For events where one person registers multiple people, such as a family, couple, team, or group.",
    features: ["Primary contact", "Add additional people", "Grouped registration"],
  },
  {
    value: "individual",
    label: "Individual",
    Icon: User,
    description: "For events where each person signs up for themselves.",
    features: ["Simple signup", "One person per registration", "Optional attendance tracking"],
  },
];

const TEMPLATE_FIELDS: Record<string, { label: string; required: boolean }[]> = {
  child_checkin: [
    { label: "Child First Name", required: true },
    { label: "Child Last Name", required: true },
    { label: "Date of Birth", required: true },
    { label: "Parent/Guardian First Name", required: true },
    { label: "Parent/Guardian Last Name", required: true },
    { label: "Parent/Guardian Phone", required: true },
    { label: "Emergency Contact Name", required: true },
    { label: "Emergency Contact Phone", required: true },
    { label: "Parent/Guardian Email", required: false },
    { label: "Allergies", required: false },
    { label: "Medical Notes", required: false },
    { label: "Special Needs / Accommodations", required: false },
    { label: "Authorized Pickup Names", required: false },
    { label: "Photo Permission", required: false },
    { label: "Medical Permission", required: false },
  ],
  family_group: [
    { label: "First Name", required: true },
    { label: "Last Name", required: true },
    { label: "Email", required: true },
    { label: "Phone", required: true },
    { label: "Dietary Restrictions", required: false },
    { label: "Accessibility Needs", required: false },
    { label: "Notes", required: false },
  ],
  individual: [
    { label: "First Name", required: true },
    { label: "Last Name", required: true },
    { label: "Email", required: true },
    { label: "Phone", required: true },
    { label: "Dietary Restrictions", required: false },
    { label: "Accessibility Needs", required: false },
  ],
};

interface RoomDraft {
  clientId: string;
  name: string;
  description: string;
  capacity: string;
  isActive: boolean;
  sortOrder: number;
}

interface WizardState {
  registrationType: string;
  name: string;
  description: string;
  eventType: string;
  isMultiDay: boolean;
  startDate: string;
  endDate: string;
  useRooms: boolean | null;
  rooms: RoomDraft[];
  roomAssignmentMode: string;
  formTitle: string;
  formDescription: string;
  addDefaultQuestions: boolean;
  trackAttendance: boolean;
  requireCheckout: boolean;
  printLabels: boolean;
  labelType: string;
}

const DEFAULTS: WizardState = {
  registrationType: "",
  name: "",
  description: "",
  eventType: "general",
  isMultiDay: false,
  startDate: "",
  endDate: "",
  useRooms: null,
  rooms: [],
  roomAssignmentMode: "manual",
  formTitle: "",
  formDescription: "",
  addDefaultQuestions: true,
  trackAttendance: false,
  requireCheckout: false,
  printLabels: false,
  labelType: "simple_name",
};

const STEP_TITLES = ["Event Details", "Rooms / Groups", "Registration Form", "Review & Finish"];

// ─── Step 1: Event Details ────────────────────────────────────────────────────

function Step1({
  state,
  update,
}: {
  state: WizardState;
  update: (k: keyof WizardState, v: unknown) => void;
}) {
  const setRegType = (type: string) => {
    const isChild = type === "child_checkin";
    update("registrationType", type);
    update("trackAttendance", isChild);
    update("requireCheckout", isChild);
    update("printLabels", isChild);
    update("labelType", isChild ? "child_security" : "simple_name");
  };

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-base font-semibold">
          Registration Type <span className="text-destructive">*</span>
        </Label>
        <p className="text-sm text-muted-foreground mb-3">
          Choose the setup that best matches this event.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {REGISTRATION_TYPES.map(({ value, label, Icon, description, features }) => (
            <button
              key={value}
              type="button"
              onClick={() => setRegType(value)}
              className={`group text-left rounded-xl border-2 p-4 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                state.registrationType === value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/40"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-colors ${
                  state.registrationType === value
                    ? "bg-primary/20"
                    : "bg-primary/10 group-hover:bg-primary/20"
                }`}
              >
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <p className="font-semibold text-sm mb-1">{label}</p>
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>
            Event Name <span className="text-destructive">*</span>
          </Label>
          <Input
            placeholder="e.g. VBS Summer 2025"
            value={state.name}
            onChange={(e) => update("name", e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Event Category</Label>
          <Select value={state.eventType} onValueChange={(v) => update("eventType", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 flex flex-col justify-end pb-0.5">
          <div className="flex items-center gap-2 py-2">
            <Switch
              id="multiday"
              checked={state.isMultiDay}
              onCheckedChange={(v) => {
                update("isMultiDay", v);
                if (!v) update("endDate", "");
              }}
            />
            <label htmlFor="multiday" className="text-sm cursor-pointer">
              Multi-day event
            </label>
          </div>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label>Description</Label>
          <Textarea
            placeholder="Optional description..."
            rows={2}
            value={state.description}
            onChange={(e) => update("description", e.target.value)}
          />
        </div>

        {state.isMultiDay ? (
          <>
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
          </>
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
      </div>
    </div>
  );
}

// ─── Step 2: Rooms / Groups ───────────────────────────────────────────────────

function Step2({
  state,
  setState,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  const update = (k: keyof WizardState, v: unknown) =>
    setState((p) => ({ ...p, [k]: v }));

  const isChild = !state.registrationType || state.registrationType === "child_checkin";
  const entityName = isChild ? "room" : "group";
  const entityNamePlural = isChild ? "rooms" : "groups";
  const entityNameCap = isChild ? "Room" : "Group";

  const helperText = isChild
    ? "Rooms are useful for groups like Nursery, Cubbies, Sparks, T&T, classrooms, or age groups. You can skip this and add rooms later."
    : "Groups are useful for sessions, teams, tables, or breakout groups. You can skip this and add groups later.";

  const [showAddForm, setShowAddForm] = useState(false);
  const [editRoomId, setEditRoomId] = useState<string | null>(null);
  const [roomForm, setRoomForm] = useState({
    name: "",
    description: "",
    capacity: "",
    isActive: true,
  });

  const resetRoomForm = () => {
    setRoomForm({ name: "", description: "", capacity: "", isActive: true });
    setShowAddForm(false);
    setEditRoomId(null);
  };

  const addRoom = () => {
    if (!roomForm.name.trim()) return;
    const newRoom: RoomDraft = {
      clientId: `r_${Date.now()}_${Math.random()}`,
      name: roomForm.name.trim(),
      description: roomForm.description.trim(),
      capacity: roomForm.capacity,
      isActive: roomForm.isActive,
      sortOrder: state.rooms.length,
    };
    setState((p) => ({ ...p, rooms: [...p.rooms, newRoom] }));
    resetRoomForm();
  };

  const startEditRoom = (room: RoomDraft) => {
    setEditRoomId(room.clientId);
    setRoomForm({
      name: room.name,
      description: room.description,
      capacity: room.capacity,
      isActive: room.isActive,
    });
    setShowAddForm(false);
  };

  const saveEditRoom = () => {
    if (!roomForm.name.trim()) return;
    setState((p) => ({
      ...p,
      rooms: p.rooms.map((r) =>
        r.clientId === editRoomId
          ? {
              ...r,
              name: roomForm.name.trim(),
              description: roomForm.description.trim(),
              capacity: roomForm.capacity,
              isActive: roomForm.isActive,
            }
          : r
      ),
    }));
    resetRoomForm();
  };

  const removeRoom = (clientId: string) => {
    setState((p) => ({
      ...p,
      rooms: p.rooms
        .filter((r) => r.clientId !== clientId)
        .map((r, i) => ({ ...r, sortOrder: i })),
    }));
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">{helperText}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => update("useRooms", true)}
          className={`text-left rounded-xl border-2 p-4 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            state.useRooms === true
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/40"
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <DoorOpen className="w-5 h-5 text-primary" />
            <p className="font-semibold text-sm">
              Yes, create {entityNamePlural}
            </p>
            {state.useRooms === true && (
              <Check className="w-4 h-4 text-primary ml-auto" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Set up {entityNamePlural} now to assign attendees during
            registration or check-in.
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            update("useRooms", false);
            setState((p) => ({ ...p, rooms: [] }));
          }}
          className={`text-left rounded-xl border-2 p-4 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            state.useRooms === false
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/40"
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Check
              className={`w-5 h-5 ${state.useRooms === false ? "text-primary" : "text-muted-foreground"}`}
            />
            <p className="font-semibold text-sm">
              No {entityNamePlural} needed
            </p>
            {state.useRooms === false && (
              <Check className="w-4 h-4 text-primary ml-auto" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            This event doesn't need {entityNamePlural}. You can still add them
            later from Event Settings.
          </p>
        </button>
      </div>

      {state.useRooms === true && (
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>{entityNameCap} Assignment Mode</Label>
            <Select
              value={state.roomAssignmentMode}
              onValueChange={(v) => update("roomAssignmentMode", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">
                  Manual assignment — staff assigns {entityNamePlural}
                </SelectItem>
                <SelectItem value="registrant_chooses">
                  Registrant chooses during registration
                </SelectItem>
                <SelectItem value="auto_assign">
                  Auto-assign based on rules
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {state.rooms.length > 0 && (
            <div className="space-y-2">
              <Label>
                {entityNameCap}s added ({state.rooms.length})
              </Label>
              <div className="space-y-2">
                {state.rooms.map((room) =>
                  editRoomId === room.clientId ? (
                    <div
                      key={room.clientId}
                      className="p-3 rounded-lg border border-primary/50 bg-primary/5 space-y-3"
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">
                            {entityNameCap} Name{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            value={roomForm.name}
                            onChange={(e) =>
                              setRoomForm((p) => ({ ...p, name: e.target.value }))
                            }
                            className="h-8 text-sm"
                            autoFocus
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Description</Label>
                          <Input
                            value={roomForm.description}
                            onChange={(e) =>
                              setRoomForm((p) => ({
                                ...p,
                                description: e.target.value,
                              }))
                            }
                            placeholder="Optional"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Capacity</Label>
                          <Input
                            type="number"
                            min="0"
                            value={roomForm.capacity}
                            onChange={(e) =>
                              setRoomForm((p) => ({
                                ...p,
                                capacity: e.target.value,
                              }))
                            }
                            placeholder="No limit"
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`edit-active-${room.clientId}`}
                          checked={roomForm.isActive}
                          onCheckedChange={(v) =>
                            setRoomForm((p) => ({ ...p, isActive: v }))
                          }
                        />
                        <label
                          htmlFor={`edit-active-${room.clientId}`}
                          className="text-xs cursor-pointer"
                        >
                          Active
                        </label>
                        <div className="ml-auto flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={resetRoomForm}
                            className="h-7 text-xs"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={saveEditRoom}
                            disabled={!roomForm.name.trim()}
                            className="h-7 text-xs"
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={room.clientId}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background"
                    >
                      <DoorOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{room.name}</p>
                        {room.description && (
                          <p className="text-xs text-muted-foreground">
                            {room.description}
                          </p>
                        )}
                      </div>
                      {room.capacity && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          Cap: {room.capacity}
                        </span>
                      )}
                      {!room.isActive && (
                        <span className="text-xs text-muted-foreground italic shrink-0">
                          Inactive
                        </span>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground shrink-0"
                        onClick={() => startEditRoom(room)}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive/70 hover:text-destructive shrink-0"
                        onClick={() => removeRoom(room.clientId)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {showAddForm && editRoomId === null ? (
            <div className="p-3 rounded-lg border border-primary/50 bg-primary/5 space-y-3">
              <p className="text-sm font-medium">Add {entityNameCap}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">
                    {entityNameCap} Name{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={roomForm.name}
                    onChange={(e) =>
                      setRoomForm((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder={
                      isChild
                        ? "e.g. Nursery, Cubbies, Sparks..."
                        : "e.g. Table A, Team 1, Session 1..."
                    }
                    className="h-8 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addRoom();
                      if (e.key === "Escape") resetRoomForm();
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={roomForm.description}
                    onChange={(e) =>
                      setRoomForm((p) => ({ ...p, description: e.target.value }))
                    }
                    placeholder="Optional"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Capacity</Label>
                  <Input
                    type="number"
                    min="0"
                    value={roomForm.capacity}
                    onChange={(e) =>
                      setRoomForm((p) => ({ ...p, capacity: e.target.value }))
                    }
                    placeholder="No limit"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="new-room-active"
                  checked={roomForm.isActive}
                  onCheckedChange={(v) =>
                    setRoomForm((p) => ({ ...p, isActive: v }))
                  }
                />
                <label htmlFor="new-room-active" className="text-xs cursor-pointer">
                  Active
                </label>
                <div className="ml-auto flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={resetRoomForm}
                    className="h-7 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={addRoom}
                    disabled={!roomForm.name.trim()}
                    className="h-7 text-xs"
                  >
                    Add {entityNameCap}
                  </Button>
                </div>
              </div>
            </div>
          ) : editRoomId === null ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAddForm(true);
                setRoomForm({ name: "", description: "", capacity: "", isActive: true });
              }}
              className="w-full border-dashed"
            >
              <Plus className="w-4 h-4 mr-1" /> Add {entityNameCap}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─── Step 3: Registration Form ────────────────────────────────────────────────

function Step3({
  state,
  update,
}: {
  state: WizardState;
  update: (k: keyof WizardState, v: unknown) => void;
}) {
  const regType = (state.registrationType || "child_checkin") as keyof typeof TEMPLATE_FIELDS;
  const fields = TEMPLATE_FIELDS[regType] ?? TEMPLATE_FIELDS.child_checkin;
  const requiredFields = fields.filter((f) => f.required);
  const optionalFields = fields.filter((f) => !f.required);
  const regTypeLabel =
    regType === "child_checkin"
      ? "child check-in"
      : regType === "family_group"
      ? "family/group registration"
      : "individual registration";

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>
          Form Title <span className="text-destructive">*</span>
        </Label>
        <Input
          value={state.formTitle}
          onChange={(e) => update("formTitle", e.target.value)}
          placeholder={`${state.name || "Event"} Registration`}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Form Description</Label>
        <Textarea
          rows={2}
          value={state.formDescription}
          onChange={(e) => update("formDescription", e.target.value)}
          placeholder="What registrants will see at the top of the form..."
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Starting Fields</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => update("addDefaultQuestions", true)}
            className={`text-left rounded-xl border-2 p-4 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              state.addDefaultQuestions
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/40"
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <CheckSquare className="w-4 h-4 text-primary" />
              <p className="font-semibold text-sm">Use recommended template</p>
              {state.addDefaultQuestions && (
                <Check className="w-4 h-4 text-primary ml-auto" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {fields.length} fields pre-configured for {regTypeLabel}.
            </p>
          </button>

          <button
            type="button"
            onClick={() => update("addDefaultQuestions", false)}
            className={`text-left rounded-xl border-2 p-4 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              !state.addDefaultQuestions
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/40"
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <p className="font-semibold text-sm">Start with blank form</p>
              {!state.addDefaultQuestions && (
                <Check className="w-4 h-4 text-primary ml-auto" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Start with an empty form and add fields manually in the form builder.
            </p>
          </button>
        </div>

        {state.addDefaultQuestions && (
          <div className="mt-2 p-3 rounded-lg border border-border bg-muted/30 space-y-2">
            <p className="text-xs font-medium text-foreground">Fields included:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5">
              {requiredFields.map((f) => (
                <div
                  key={f.label}
                  className="flex items-center gap-1.5 text-xs text-foreground"
                >
                  <Check className="w-3 h-3 text-primary flex-shrink-0" />
                  {f.label}
                </div>
              ))}
              {optionalFields.map((f) => (
                <div
                  key={f.label}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <Check className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  {f.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2 pt-1 border-t border-border">
        <Label className="text-sm font-medium">Attendance &amp; Check-In</Label>
        <div className="space-y-2">
          <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background">
            <Switch
              id="track-attendance"
              checked={state.trackAttendance}
              onCheckedChange={(v) => {
                update("trackAttendance", v);
                if (!v) {
                  update("requireCheckout", false);
                  update("printLabels", false);
                }
              }}
            />
            <div>
              <Label
                htmlFor="track-attendance"
                className="cursor-pointer font-medium text-sm"
              >
                Track attendance with check-ins
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Staff can check attendees in at the kiosk.
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
                <Label
                  htmlFor="require-checkout"
                  className="cursor-pointer font-medium text-sm"
                >
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
                <Label
                  htmlFor="print-labels"
                  className="cursor-pointer font-medium text-sm"
                >
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
                        <SelectItem
                          value="child_security"
                          disabled={state.registrationType !== "child_checkin"}
                        >
                          Child security label{" "}
                          {state.registrationType !== "child_checkin"
                            ? "(kids events only)"
                            : ""}
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
  );
}

// ─── Step 4: Review & Finish ──────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-4 text-sm">
      <span className="text-muted-foreground w-40 shrink-0">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Step4({ state }: { state: WizardState }) {
  const isChild = !state.registrationType || state.registrationType === "child_checkin";
  const regTypeLabel =
    ({
      child_checkin: "Child Check-In",
      family_group: "Family / Group",
      individual: "Individual",
    } as Record<string, string>)[state.registrationType] ?? state.registrationType;

  const assignmentModeLabel =
    ({
      manual: "Manual (staff assigns)",
      registrant_chooses: "Registrant chooses during registration",
      auto_assign: "Auto-assign based on rules",
    } as Record<string, string>)[state.roomAssignmentMode] ?? state.roomAssignmentMode;

  const regType = (state.registrationType || "child_checkin") as keyof typeof TEMPLATE_FIELDS;
  const templateFieldCount = (TEMPLATE_FIELDS[regType] ?? TEMPLATE_FIELDS.child_checkin).length;
  const fieldCount = state.addDefaultQuestions ? templateFieldCount : 0;
  const resolvedFormTitle = state.formTitle.trim() || `${state.name} Registration`;

  const entityPlural = isChild ? "rooms" : "groups";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Review your setup before finishing. You can go back to change anything.
      </p>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-2.5 bg-muted/40 border-b border-border">
          <p className="text-sm font-semibold">Event</p>
        </div>
        <div className="p-4 space-y-2.5">
          <ReviewRow label="Name" value={state.name} />
          <ReviewRow label="Registration Type" value={regTypeLabel} />
          <ReviewRow
            label="Category"
            value={EVENT_TYPES.find((t) => t.value === state.eventType)?.label ?? state.eventType}
          />
          {state.startDate && (
            <ReviewRow
              label="Date"
              value={
                state.isMultiDay && state.endDate
                  ? `${state.startDate} – ${state.endDate}`
                  : state.startDate
              }
            />
          )}
          {state.description && (
            <ReviewRow label="Description" value={state.description} />
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-2.5 bg-muted/40 border-b border-border">
          <p className="text-sm font-semibold">{isChild ? "Rooms" : "Groups"}</p>
        </div>
        <div className="p-4 space-y-2.5">
          {state.useRooms === false ? (
            <p className="text-sm text-muted-foreground">
              No {entityPlural} — skipped
            </p>
          ) : state.useRooms === true ? (
            <>
              <ReviewRow
                label="Count"
                value={`${state.rooms.length} ${isChild ? "room" : "group"}${state.rooms.length !== 1 ? "s" : ""}`}
              />
              {state.rooms.length > 0 && (
                <ReviewRow
                  label="Names"
                  value={state.rooms.map((r) => r.name).join(", ")}
                />
              )}
              <ReviewRow label="Assignment Mode" value={assignmentModeLabel} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Not configured</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-2.5 bg-muted/40 border-b border-border">
          <p className="text-sm font-semibold">Registration Form</p>
        </div>
        <div className="p-4 space-y-2.5">
          <ReviewRow label="Title" value={resolvedFormTitle} />
          <ReviewRow
            label="Starting Fields"
            value={
              state.addDefaultQuestions
                ? `Recommended template (${fieldCount} fields)`
                : "Blank form (0 fields)"
            }
          />
          <ReviewRow
            label="Check-In"
            value={state.trackAttendance ? "Enabled" : "Not enabled"}
          />
          {state.trackAttendance && state.registrationType === "child_checkin" && (
            <ReviewRow
              label="Require Check-Out"
              value={state.requireCheckout ? "Yes" : "No"}
            />
          )}
          {state.trackAttendance && (
            <ReviewRow
              label="Print Labels"
              value={
                state.printLabels
                  ? state.labelType === "child_security"
                    ? "Child security label"
                    : "Simple name label"
                  : "No"
              }
            />
          )}
          <ReviewRow label="Public Form" value="Active (accessible via embed link)" />
        </div>
      </div>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function EventSetupWizard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createEvent = useCreateEvent();
  const createRoom = useCreateRoom();

  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(DEFAULTS);

  const update = (k: keyof WizardState, v: unknown) =>
    setState((prev) => ({ ...prev, [k]: v }));

  const canProceed = () => {
    if (step === 1) return !!state.registrationType && !!state.name.trim();
    if (step === 2) return state.useRooms !== null;
    if (step === 3) return true;
    return true;
  };

  const handleNext = () => {
    if (step === 2 && !state.formTitle.trim()) {
      setState((prev) => ({ ...prev, formTitle: `${state.name} Registration` }));
    }
    setStep((s) => s + 1);
  };

  const isBusy = createEvent.isPending || createRoom.isPending;

  const handleFinish = async () => {
    const formTitle = state.formTitle.trim() || `${state.name} Registration`;

    try {
      const event = await createEvent.mutateAsync({
        data: {
          name: state.name,
          description: state.description || undefined,
          eventType: state.eventType,
          registrationType: state.registrationType || undefined,
          startDate: state.startDate || undefined,
          endDate: state.endDate || undefined,
          formTitle,
          formDescription: state.formDescription || undefined,
          addDefaultQuestions: state.addDefaultQuestions,
          trackAttendance: state.trackAttendance,
          requireCheckout: state.requireCheckout,
          printLabels: state.printLabels,
          labelType: state.labelType,
          roomAssignmentMode: state.useRooms ? state.roomAssignmentMode : undefined,
        },
      });

      if (state.useRooms && state.rooms.length > 0) {
        for (const room of state.rooms) {
          await createRoom.mutateAsync({
            eventId: event.id,
            data: {
              name: room.name,
              description: room.description || undefined,
              capacity: room.capacity ? parseInt(room.capacity, 10) : undefined,
              isActive: room.isActive,
              sortOrder: room.sortOrder,
            },
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
      toast({ title: `"${state.name}" is ready!` });
      navigate(`/events/${event.id}`);
    } catch {
      toast({ title: "Failed to create event. Please try again.", variant: "destructive" });
    }
  };

  const progressPct = ((step - 1) / (STEP_TITLES.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/events">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Events
            </Button>
          </Link>
          <div className="flex items-center gap-2 flex-1 justify-center">
            <Church className="w-4 h-4 text-primary" />
            <span className="font-serif font-bold text-sm">New Event Setup</span>
          </div>
          <span className="text-xs text-muted-foreground w-16 text-right">
            Step {step} of {STEP_TITLES.length}
          </span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Step indicators */}
        <div className="mb-8 space-y-4">
          <div className="flex items-start justify-between gap-2">
            {STEP_TITLES.map((title, i) => {
              const n = i + 1;
              const isDone = n < step;
              const isCurrent = n === step;
              return (
                <div key={n} className="flex flex-col items-center gap-1.5 flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                      isDone
                        ? "bg-primary text-primary-foreground"
                        : isCurrent
                        ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isDone ? <Check className="w-4 h-4" /> : n}
                  </div>
                  <span
                    className={`text-xs text-center leading-tight hidden sm:block ${
                      isCurrent ? "text-foreground font-medium" : "text-muted-foreground"
                    }`}
                  >
                    {title}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300 ease-in-out"
              style={{ width: `${progressPct + 12.5}%` }}
            />
          </div>
        </div>

        {/* Step content */}
        <div className="mb-2">
          <h1 className="text-2xl font-serif font-bold mb-1">{STEP_TITLES[step - 1]}</h1>
          <p className="text-sm text-muted-foreground">
            {step === 1 && "Set up the basic details for your event."}
            {step === 2 && "Configure rooms or groups for this event. You can skip this step and add them later."}
            {step === 3 && "Set up the registration form attendees will fill out."}
            {step === 4 && "Review your event setup before creating it."}
          </p>
        </div>

        <div className="mt-6 mb-10">
          {step === 1 && <Step1 state={state} update={update} />}
          {step === 2 && <Step2 state={state} setState={setState} />}
          {step === 3 && <Step3 state={state} update={update} />}
          {step === 4 && <Step4 state={state} />}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          {step > 1 ? (
            <Button
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
              disabled={isBusy}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          ) : (
            <div />
          )}

          {step < STEP_TITLES.length ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleFinish}
              disabled={isBusy}
              size="lg"
              className="px-8"
            >
              {isBusy ? "Creating..." : "Finish Setup"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
