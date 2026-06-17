import { useState, useRef } from "react";
import anchorLogo from "@assets/ChatGPT_Image_Jun_10,_2026,_01_32_42_PM_1781112954294.png";
import { Link, useLocation } from "wouter";
import {
  useCreateEvent,
  useCreateRoom,
  useUpdateForm,
  useCreateFormField,
  useListEventCategories,
  useCreateEventCategory,
  useGetOrganization,
  getListEventsQueryKey,
  getListEventCategoriesQueryKey,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Calendar,
  CalendarRange,
  Repeat,
  Clock,
  Globe,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  Phone,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SYSTEM_FIELDS, SYSTEM_FIELD_CATEGORIES, type SystemFieldDef } from "@/lib/systemFields";

// ─── Draft Field Types ────────────────────────────────────────────────────────

interface DraftFieldSpec {
  clientId: string;
  fieldKind: "system" | "custom";
  systemKey: string | null;
  label: string;
  fieldType: string;
  required: boolean;
  sortOrder: number;
  placeholder: string;
  options: string;
  sectionKey: string | null;
}

// ─── Registration Type Definitions ───────────────────────────────────────────

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

// Preview-only field list for Step 3 (template selection UI)
const TEMPLATE_FIELDS: Record<string, { label: string; required: boolean }[]> = {
  child_checkin: [
    { label: "Parent/Guardian First Name", required: true },
    { label: "Parent/Guardian Last Name", required: true },
    { label: "Parent/Guardian Phone", required: true },
    { label: "Parent/Guardian Email", required: true },
    { label: "Child First Name", required: true },
    { label: "Child Last Name", required: true },
    { label: "Date of Birth", required: true },
    { label: "Allergies", required: false },
    { label: "Medical Notes", required: false },
    { label: "Emergency Contact Name", required: true },
    { label: "Emergency Contact Phone", required: true },
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

// Full field specs that mirror the server-side templates exactly.
// Must stay in sync with TEMPLATE_CHILD_CHECKIN / TEMPLATE_FAMILY_GROUP / TEMPLATE_INDIVIDUAL
// in artifacts/api-server/src/routes/events.ts.
type TemplateFieldSpec = Omit<DraftFieldSpec, "clientId" | "sortOrder">;

const FULL_TEMPLATE_FIELDS: Record<string, TemplateFieldSpec[]> = {
  child_checkin: [
    { fieldKind: "system", systemKey: "child_first_name",        label: "Child First Name",               fieldType: "text",     required: true,  placeholder: "Enter first name",    options: "", sectionKey: null },
    { fieldKind: "system", systemKey: "child_last_name",         label: "Child Last Name",                fieldType: "text",     required: true,  placeholder: "Enter last name",     options: "", sectionKey: null },
    { fieldKind: "system", systemKey: "date_of_birth",           label: "Date of Birth",                  fieldType: "date",     required: true,  placeholder: "",                    options: "", sectionKey: null },
    { fieldKind: "system", systemKey: "guardian_first_name",     label: "Parent / Guardian First Name",   fieldType: "text",     required: true,  placeholder: "First name",          options: "", sectionKey: null },
    { fieldKind: "system", systemKey: "guardian_last_name",      label: "Parent / Guardian Last Name",    fieldType: "text",     required: true,  placeholder: "Last name",           options: "", sectionKey: null },
    { fieldKind: "system", systemKey: "guardian_phone",          label: "Parent / Guardian Phone",        fieldType: "phone",    required: true,  placeholder: "(555) 000-0000",      options: "", sectionKey: null },
    { fieldKind: "system", systemKey: "guardian_email",          label: "Parent / Guardian Email",        fieldType: "email",    required: true,  placeholder: "email@example.com",   options: "", sectionKey: null },
    { fieldKind: "system", systemKey: "allergies",               label: "Allergies",                      fieldType: "textarea", required: false, placeholder: "List any food, medication, or environmental allergies…", options: "", sectionKey: null },
    { fieldKind: "system", systemKey: "medical_notes",           label: "Medical Notes",                  fieldType: "textarea", required: false, placeholder: "Any diagnoses, medications, or medical considerations…",  options: "", sectionKey: null },
    { fieldKind: "system", systemKey: "emergency_contact_name",  label: "Emergency Contact Name",         fieldType: "text",     required: true,  placeholder: "Full name",           options: "", sectionKey: "additional_questions" },
    { fieldKind: "system", systemKey: "emergency_contact_phone", label: "Emergency Contact Phone",        fieldType: "phone",    required: true,  placeholder: "(555) 000-0000",      options: "", sectionKey: "additional_questions" },
  ],
  family_group: [
    { fieldKind: "system", systemKey: "participant_first_name",  label: "First Name",               fieldType: "text",     required: true,  placeholder: "Enter first name",    options: "", sectionKey: null },
    { fieldKind: "system", systemKey: "participant_last_name",   label: "Last Name",                fieldType: "text",     required: true,  placeholder: "Enter last name",     options: "", sectionKey: null },
    { fieldKind: "system", systemKey: "participant_email",       label: "Email",                    fieldType: "email",    required: true,  placeholder: "email@example.com",   options: "", sectionKey: null },
    { fieldKind: "system", systemKey: "participant_phone",       label: "Phone",                    fieldType: "phone",    required: true,  placeholder: "(555) 000-0000",      options: "", sectionKey: null },
    { fieldKind: "system", systemKey: "dietary_restrictions",    label: "Dietary Restrictions",     fieldType: "textarea", required: false, placeholder: "List any dietary restrictions or food allergies…", options: "", sectionKey: null },
    { fieldKind: "system", systemKey: "accessibility_needs",     label: "Accessibility Needs",      fieldType: "textarea", required: false, placeholder: "Describe any accessibility requirements…",        options: "", sectionKey: null },
    { fieldKind: "custom", systemKey: null,                      label: "Notes",                    fieldType: "textarea", required: false, placeholder: "Anything else we should know…",                  options: "", sectionKey: null },
  ],
  individual: [
    { fieldKind: "system", systemKey: "participant_first_name",  label: "First Name",               fieldType: "text",     required: true,  placeholder: "Enter first name",    options: "", sectionKey: null },
    { fieldKind: "system", systemKey: "participant_last_name",   label: "Last Name",                fieldType: "text",     required: true,  placeholder: "Enter last name",     options: "", sectionKey: null },
    { fieldKind: "system", systemKey: "participant_email",       label: "Email",                    fieldType: "email",    required: true,  placeholder: "email@example.com",   options: "", sectionKey: null },
    { fieldKind: "system", systemKey: "participant_phone",       label: "Phone",                    fieldType: "phone",    required: true,  placeholder: "(555) 000-0000",      options: "", sectionKey: null },
    { fieldKind: "system", systemKey: "dietary_restrictions",    label: "Dietary Restrictions",     fieldType: "textarea", required: false, placeholder: "List any dietary restrictions or food allergies…", options: "", sectionKey: null },
    { fieldKind: "system", systemKey: "accessibility_needs",     label: "Accessibility Needs",      fieldType: "textarea", required: false, placeholder: "Describe any accessibility requirements…",        options: "", sectionKey: null },
  ],
};

function buildTemplateDraftFields(registrationType: string, includeRoomField: boolean): DraftFieldSpec[] {
  const type =
    registrationType === "family_group"
      ? "family_group"
      : registrationType === "individual"
      ? "individual"
      : "child_checkin";
  const specs = FULL_TEMPLATE_FIELDS[type];
  const fields: DraftFieldSpec[] = specs.map((f, i) => ({
    ...f,
    clientId: `draft_${i}_${f.systemKey ?? "custom"}`,
    sortOrder: i,
  }));
  if (includeRoomField && type === "child_checkin") {
    fields.push({
      clientId: "draft_room",
      fieldKind: "system",
      systemKey: "room_assignment",
      label: "Room / Group",
      fieldType: "select",
      required: true,
      sortOrder: fields.length,
      placeholder: "Select a room or group",
      options: "",
      sectionKey: "child_info",
    });
  }
  return fields;
}

// ─── Wizard State ─────────────────────────────────────────────────────────────

interface RoomDraft {
  clientId: string;
  name: string;
  description: string;
  capacity: string;
  isActive: boolean;
  sortOrder: number;
}

type ScheduleType = "one_time" | "multi_day" | "repeating";

interface WizardState {
  registrationType: string;
  name: string;
  description: string;
  eventType: string;
  scheduleType: ScheduleType;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  repeatFrequency: "weekly";
  repeatDayOfWeek: number;
  useRooms: boolean | null;
  rooms: RoomDraft[];
  formTitle: string;
  formDescription: string;
  isActive: boolean;
  isPublic: boolean;
  allowAdditionalPeople: boolean;
  addDefaultQuestions: boolean;
  trackAttendance: boolean;
  requireCheckout: boolean;
  printLabels: boolean;
  labelType: string;
  // Draft form fields — no DB writes until Finish Setup
  draftFields: DraftFieldSpec[];
  // Tracks what mode draftFields was last populated for (null = not yet populated)
  draftFieldsInitializedAsTemplate: boolean | null;
  zeroFieldsConfirmed: boolean;
}

const DEFAULTS: WizardState = {
  registrationType: "",
  name: "",
  description: "",
  eventType: "general",
  scheduleType: "one_time",
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  repeatFrequency: "weekly",
  repeatDayOfWeek: -1,
  useRooms: null,
  rooms: [],
  formTitle: "",
  formDescription: "",
  isActive: true,
  isPublic: true,
  allowAdditionalPeople: false,
  addDefaultQuestions: true,
  trackAttendance: false,
  requireCheckout: false,
  printLabels: false,
  labelType: "simple_name",
  draftFields: [],
  draftFieldsInitializedAsTemplate: null,
  zeroFieldsConfirmed: false,
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_ABBR = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function computeSessionCount(startDate: string, endDate: string, dayOfWeek: number): number {
  if (!startDate || !endDate || dayOfWeek < 0) return 0;
  let count = 0;
  const end = new Date(endDate + "T00:00:00");
  const current = new Date(startDate + "T00:00:00");
  while (current.getDay() !== dayOfWeek) current.setDate(current.getDate() + 1);
  while (current <= end) { count++; current.setDate(current.getDate() + 7); }
  return count;
}

function formatPreviewDate(dateStr: string): string {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const STEP_TITLES = [
  "Event Details",
  "Rooms / Groups",
  "Registration Form Settings",
  "Build Registration Form",
  "Review & Finish",
];

// ─── Step 1: Event Details ────────────────────────────────────────────────────

function Step1({
  state,
  update,
}: {
  state: WizardState;
  update: (k: keyof WizardState, v: unknown) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: categories = [] } = useListEventCategories();
  const [createCatOpen, setCreateCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const createCategory = useCreateEventCategory({
    mutation: {
      onSuccess: (cat) => {
        queryClient.invalidateQueries({ queryKey: getListEventCategoriesQueryKey() });
        update("eventType", cat.slug);
        setCreateCatOpen(false);
        setNewCatName("");
        toast({ title: `Category "${cat.name}" created` });
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Failed to create category";
        toast({ title: msg, variant: "destructive" });
      },
    },
  });
  const setRegType = (type: string) => {
    const isChild = type === "child_checkin";
    update("registrationType", type);
    update("trackAttendance", isChild);
    update("requireCheckout", isChild);
    update("printLabels", isChild);
    update("labelType", isChild ? "child_security" : "simple_name");
    update("allowAdditionalPeople", type === "family_group");
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

        <div className="space-y-1.5 sm:col-span-2">
          <Label>Event Category</Label>
          <Select
            value={state.eventType}
            onValueChange={(v) => update("eventType", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category…" />
            </SelectTrigger>
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
                placeholder="e.g. Kids Program"
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

        <div className="space-y-1.5 sm:col-span-2">
          <Label>Description</Label>
          <Textarea
            placeholder="Optional description..."
            rows={2}
            value={state.description}
            onChange={(e) => update("description", e.target.value)}
          />
        </div>
      </div>

      {/* ── Event Schedule ─────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold">Event Schedule</Label>
          <p className="text-sm text-muted-foreground mt-0.5 mb-3">
            How often does this event occur?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([
              { value: "one_time" as ScheduleType, label: "One-time", Icon: Calendar, description: "A single event on one day." },
              { value: "multi_day" as ScheduleType, label: "Multi-day", Icon: CalendarRange, description: "Spans consecutive days — VBS, retreat, conference." },
              { value: "repeating" as ScheduleType, label: "Repeating", Icon: Repeat, description: "Regular schedule — AWANA, youth group, weekly classes." },
            ] as const).map(({ value, label, Icon, description }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  update("scheduleType", value);
                  if (value === "one_time") update("endDate", "");
                }}
                className={`group text-left rounded-xl border-2 p-4 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  state.scheduleType === value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/40"
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 transition-colors ${
                  state.scheduleType === value ? "bg-primary/20" : "bg-primary/10 group-hover:bg-primary/15"
                }`}>
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="font-semibold text-sm">{label}</p>
                  {state.scheduleType === value && <Check className="w-3.5 h-3.5 text-primary ml-auto" />}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
              </button>
            ))}
          </div>
        </div>

        {state.scheduleType === "one_time" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Date <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
              <Input
                type="date"
                value={state.startDate}
                onChange={(e) => update("startDate", e.target.value)}
              />
            </div>
            <div className="space-y-1.5" />
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-muted-foreground" />Start Time <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
              <Input type="time" value={state.startTime} onChange={(e) => update("startTime", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-muted-foreground" />End Time <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
              <Input type="time" value={state.endTime} onChange={(e) => update("endTime", e.target.value)} />
            </div>
          </div>
        )}

        {state.scheduleType === "multi_day" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-muted-foreground" />Start Time <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
              <Input type="time" value={state.startTime} onChange={(e) => update("startTime", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-muted-foreground" />End Time <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
              <Input type="time" value={state.endTime} onChange={(e) => update("endTime", e.target.value)} />
            </div>
          </div>
        )}

        {state.scheduleType === "repeating" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Program Start Date</Label>
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
                <Label>Program End Date</Label>
                <Input
                  type="date"
                  value={state.endDate}
                  min={state.startDate || undefined}
                  onChange={(e) => update("endDate", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Repeat Frequency</Label>
                <Select value={state.repeatFrequency} onValueChange={(v) => update("repeatFrequency", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Repeat On</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {DAY_ABBR.map((abbr, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => update("repeatDayOfWeek", idx)}
                      className={`w-9 h-9 rounded-lg text-xs font-semibold border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        state.repeatDayOfWeek === idx
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary/50 hover:bg-muted/40"
                      }`}
                    >
                      {abbr}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-muted-foreground" />Start Time <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
                <Input type="time" value={state.startTime} onChange={(e) => update("startTime", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-muted-foreground" />End Time <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
                <Input type="time" value={state.endTime} onChange={(e) => update("endTime", e.target.value)} />
              </div>
            </div>

            {state.startDate && state.endDate && state.repeatDayOfWeek >= 0 && (() => {
              const count = computeSessionCount(state.startDate, state.endDate, state.repeatDayOfWeek);
              const dayName = DAY_NAMES[state.repeatDayOfWeek];
              return (
                <div className="flex items-start gap-2.5 p-3.5 rounded-lg border border-primary/20 bg-primary/5">
                  <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-foreground">
                    This will create{" "}
                    <span className="font-semibold">{count} {dayName} session{count !== 1 ? "s" : ""}</span>{" "}
                    from <span className="font-semibold">{formatPreviewDate(state.startDate)}</span> to{" "}
                    <span className="font-semibold">{formatPreviewDate(state.endDate)}</span>.
                  </p>
                </div>
              );
            })()}
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
            <p className="font-semibold text-sm">Yes, create {entityNamePlural}</p>
            {state.useRooms === true && <Check className="w-4 h-4 text-primary ml-auto" />}
          </div>
          <p className="text-xs text-muted-foreground">
            Set up {entityNamePlural} now to assign attendees during registration or check-in.
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
            <Check className={`w-5 h-5 ${state.useRooms === false ? "text-primary" : "text-muted-foreground"}`} />
            <p className="font-semibold text-sm">No {entityNamePlural} needed</p>
            {state.useRooms === false && <Check className="w-4 h-4 text-primary ml-auto" />}
          </div>
          <p className="text-xs text-muted-foreground">
            This event doesn't need {entityNamePlural}. You can still add them later from Event Settings.
          </p>
        </button>
      </div>

      {state.useRooms === true && (
        <div className="space-y-4 pt-2">
          {state.rooms.length > 0 && (
            <div className="space-y-2">
              <Label>{entityNameCap}s added ({state.rooms.length})</Label>
              <div className="space-y-2">
                {state.rooms.map((room) =>
                  editRoomId === room.clientId ? (
                    <div key={room.clientId} className="p-3 rounded-lg border border-primary/50 bg-primary/5 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">{entityNameCap} Name <span className="text-destructive">*</span></Label>
                          <Input value={roomForm.name} onChange={(e) => setRoomForm((p) => ({ ...p, name: e.target.value }))} className="h-8 text-sm" autoFocus />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Description</Label>
                          <Input value={roomForm.description} onChange={(e) => setRoomForm((p) => ({ ...p, description: e.target.value }))} placeholder="Optional" className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Capacity</Label>
                          <Input type="number" min="0" value={roomForm.capacity} onChange={(e) => setRoomForm((p) => ({ ...p, capacity: e.target.value }))} placeholder="No limit" className="h-8 text-sm" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch id={`edit-active-${room.clientId}`} checked={roomForm.isActive} onCheckedChange={(v) => setRoomForm((p) => ({ ...p, isActive: v }))} />
                        <label htmlFor={`edit-active-${room.clientId}`} className="text-xs cursor-pointer">Active</label>
                        <div className="ml-auto flex gap-2">
                          <Button size="sm" variant="ghost" onClick={resetRoomForm} className="h-7 text-xs">Cancel</Button>
                          <Button size="sm" onClick={saveEditRoom} disabled={!roomForm.name.trim()} className="h-7 text-xs">Save</Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div key={room.clientId} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background">
                      <DoorOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{room.name}</p>
                        {room.description && <p className="text-xs text-muted-foreground">{room.description}</p>}
                      </div>
                      {room.capacity && <span className="text-xs text-muted-foreground shrink-0">Cap: {room.capacity}</span>}
                      {!room.isActive && <span className="text-xs text-muted-foreground italic shrink-0">Inactive</span>}
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground shrink-0" onClick={() => startEditRoom(room)}><Pencil className="w-3 h-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive/70 hover:text-destructive shrink-0" onClick={() => removeRoom(room.clientId)}><Trash2 className="w-3 h-3" /></Button>
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
                  <Label className="text-xs">{entityNameCap} Name <span className="text-destructive">*</span></Label>
                  <Input
                    value={roomForm.name}
                    onChange={(e) => setRoomForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder={isChild ? "e.g. Nursery, Cubbies, Sparks..." : "e.g. Table A, Team 1, Session 1..."}
                    className="h-8 text-sm"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") addRoom(); if (e.key === "Escape") resetRoomForm(); }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input value={roomForm.description} onChange={(e) => setRoomForm((p) => ({ ...p, description: e.target.value }))} placeholder="Optional" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Capacity</Label>
                  <Input type="number" min="0" value={roomForm.capacity} onChange={(e) => setRoomForm((p) => ({ ...p, capacity: e.target.value }))} placeholder="No limit" className="h-8 text-sm" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="new-room-active" checked={roomForm.isActive} onCheckedChange={(v) => setRoomForm((p) => ({ ...p, isActive: v }))} />
                <label htmlFor="new-room-active" className="text-xs cursor-pointer">Active</label>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="ghost" onClick={resetRoomForm} className="h-7 text-xs">Cancel</Button>
                  <Button size="sm" onClick={addRoom} disabled={!roomForm.name.trim()} className="h-7 text-xs">Add {entityNameCap}</Button>
                </div>
              </div>
            </div>
          ) : editRoomId === null ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowAddForm(true); setRoomForm({ name: "", description: "", capacity: "", isActive: true }); }}
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

// ─── Step 3: Registration Form Settings ──────────────────────────────────────

function Step3({
  state,
  update,
}: {
  state: WizardState;
  update: (k: keyof WizardState, v: unknown) => void;
}) {
  const regType = (state.registrationType || "child_checkin") as keyof typeof TEMPLATE_FIELDS;
  const baseFields = TEMPLATE_FIELDS[regType] ?? TEMPLATE_FIELDS.child_checkin;
  const regTypeLabel =
    regType === "child_checkin"
      ? "child check-in"
      : regType === "family_group"
      ? "family/group registration"
      : "individual registration";

  const hasRooms = state.useRooms === true && state.rooms.length > 0;
  const fields =
    hasRooms && regType === "child_checkin"
      ? [...baseFields, { label: "Room / Group", required: true, isRoomField: true }]
      : baseFields.map((f) => ({ ...f, isRoomField: false as const }));

  const showAllowAdditionalPeople =
    state.registrationType === "family_group" || state.registrationType === "individual";

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Form Title <span className="text-destructive">*</span></Label>
          <Input
            value={state.formTitle}
            onChange={(e) => update("formTitle", e.target.value)}
            placeholder={`${state.name || "Event"} Registration`}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Header Text / Welcome Message</Label>
          <Textarea
            rows={2}
            value={state.formDescription}
            onChange={(e) => update("formDescription", e.target.value)}
            placeholder="Text shown at the top of the registration form. Welcome message, instructions, etc."
          />
        </div>
      </div>

      <div className="space-y-2 pt-1 border-t border-border">
        <Label className="text-sm font-medium">Form Visibility</Label>
        <div className="space-y-2">
          <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background">
            <Switch id="form-active" checked={state.isActive} onCheckedChange={(v) => update("isActive", v)} />
            <div className="flex-1">
              <Label htmlFor="form-active" className="cursor-pointer font-medium text-sm flex items-center gap-1.5">
                {state.isActive ? <Eye className="w-3.5 h-3.5 text-muted-foreground" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
                Active — Accepting responses
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {state.isActive ? "The form is open and accepting new registrations." : "The form is closed. No new registrations will be accepted."}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background">
            <Switch id="form-public" checked={state.isPublic} onCheckedChange={(v) => update("isPublic", v)} />
            <div className="flex-1">
              <Label htmlFor="form-public" className="cursor-pointer font-medium text-sm flex items-center gap-1.5">
                {state.isPublic ? <Globe className="w-3.5 h-3.5 text-muted-foreground" /> : <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                Public — Accessible via embed link
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {state.isPublic ? "Anyone with the embed link can access and submit this form." : "The form is not publicly accessible via embed link."}
              </p>
            </div>
          </div>

          {showAllowAdditionalPeople && (
            <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background">
              <Switch id="allow-additional" checked={state.allowAdditionalPeople} onCheckedChange={(v) => update("allowAdditionalPeople", v)} />
              <div>
                <Label htmlFor="allow-additional" className="cursor-pointer font-medium text-sm flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  Allow registering additional people
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  One registrant can add multiple people in a single submission.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2 pt-1 border-t border-border">
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
              {state.addDefaultQuestions && <Check className="w-4 h-4 text-primary ml-auto" />}
            </div>
            <p className="text-xs text-muted-foreground">
              {fields.length} fields pre-configured for {regTypeLabel}
              {hasRooms && regType === "child_checkin" ? ", including Room / Group." : "."}
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
              {!state.addDefaultQuestions && <Check className="w-4 h-4 text-primary ml-auto" />}
            </div>
            <p className="text-xs text-muted-foreground">
              Start with an empty form and add fields manually in the next step.
            </p>
          </button>
        </div>

        {state.addDefaultQuestions && (
          <div className="mt-2 p-3 rounded-lg border border-border bg-muted/30 space-y-2">
            <p className="text-xs font-medium text-foreground">Fields included:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5">
              {fields.map((f) => (
                <div
                  key={f.label}
                  className={`flex items-center gap-1.5 text-xs ${
                    "isRoomField" in f && f.isRoomField
                      ? "text-primary font-medium"
                      : "text-foreground"
                  }`}
                >
                  <Check className="w-3 h-3 flex-shrink-0 text-primary" />
                  {f.label}
                  {!f.required && <span className="text-muted-foreground">(optional)</span>}
                  {"isRoomField" in f && f.isRoomField && (
                    <span className="text-primary/70">(from rooms)</span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              You can edit, reorder, or remove fields in the next step.
            </p>
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
              <Label htmlFor="track-attendance" className="cursor-pointer font-medium text-sm">
                Track attendance with check-ins
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Staff can check attendees in at the kiosk.
              </p>
            </div>
          </div>

          {state.trackAttendance && state.registrationType === "child_checkin" && (
            <div className="ml-4 flex items-start gap-3 p-3 rounded-lg border border-border bg-background">
              <Switch id="require-checkout" checked={state.requireCheckout} onCheckedChange={(v) => update("requireCheckout", v)} />
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
              <Switch id="print-labels" checked={state.printLabels} onCheckedChange={(v) => update("printLabels", v)} />
              <div className="flex-1">
                <Label htmlFor="print-labels" className="cursor-pointer font-medium text-sm">
                  Print name labels at check-in
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Print a label when each attendee checks in.
                </p>
                {state.printLabels && (
                  <div className="mt-2">
                    <Select value={state.labelType} onValueChange={(v) => update("labelType", v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="simple_name_tag">Simple Name Tag</SelectItem>
                        <SelectItem value="simple_name">Simple Child Label</SelectItem>
                        <SelectItem value="child_security" disabled={state.registrationType !== "child_checkin"}>
                          Child security label{state.registrationType !== "child_checkin" ? " (kids events only)" : ""}
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

// ─── Step 4: Draft Form Builder ───────────────────────────────────────────────

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Text",
  textarea: "Text area",
  date: "Date",
  phone: "Phone",
  email: "Email",
  select: "Dropdown",
  checkbox: "Checkbox",
};

// System keys that belong to each section in child_checkin events
const GUARDIAN_SECTION_KEYS = new Set([
  "guardian_first_name", "guardian_last_name", "guardian_phone", "guardian_email",
  "secondary_guardian_name", "secondary_guardian_phone",
  "authorized_pickup_names", "unauthorized_pickup_notes",
  "photo_permission", "medical_permission",
]);

const CHILD_SECTION_KEYS = new Set([
  "child_first_name", "child_last_name", "date_of_birth", "gender", "grade",
  "allergies", "medical_notes", "special_needs", "notes", "room_assignment",
]);

const EMERGENCY_SECTION_KEYS = new Set([
  "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relationship",
]);

type WizardSectionId = "guardian" | "child" | "emergency" | "additional" | "participant";

interface WizardSectionDef {
  id: WizardSectionId;
  title: string;
  iconName: "Users" | "Baby" | "FileText" | "User" | "Phone";
  helperText: string;
  repeatBadge?: string;
  emptyLabel: string;
  canAddCustom: boolean;
  addSystemButtonLabel: string | null;
  allowedSystemKeys?: Set<string>;
  headerBg: string;
  iconBg: string;
  iconColor: string;
}

const CHILD_CHECKIN_SECTIONS: WizardSectionDef[] = [
  {
    id: "guardian",
    title: "Parent / Guardian Information",
    iconName: "Users",
    helperText: "Primary contact details for the registration",
    emptyLabel: "No parent/guardian fields yet. Use the button above to add one.",
    canAddCustom: true,
    addSystemButtonLabel: "Add Parent Field",
    allowedSystemKeys: GUARDIAN_SECTION_KEYS,
    headerBg: "bg-amber-50",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-700",
  },
  {
    id: "child",
    title: "Child Information",
    iconName: "Baby",
    helperText: "Details collected for each child being registered",
    repeatBadge: "Repeats for each child",
    emptyLabel: "No child fields yet. Use the button above to add one.",
    canAddCustom: true,
    addSystemButtonLabel: "Add Child Field",
    allowedSystemKeys: CHILD_SECTION_KEYS,
    headerBg: "bg-orange-50",
    iconBg: "bg-orange-100",
    iconColor: "text-orange-700",
  },
  {
    id: "emergency",
    title: "Emergency Contact Information",
    iconName: "Phone",
    helperText: "Backup contact in case a guardian cannot be reached",
    emptyLabel: "No emergency contact fields yet. Use the button above to add one.",
    canAddCustom: true,
    addSystemButtonLabel: "Add Emergency Contact Field",
    allowedSystemKeys: EMERGENCY_SECTION_KEYS,
    headerBg: "bg-rose-50",
    iconBg: "bg-rose-100",
    iconColor: "text-rose-700",
  },
  {
    id: "additional",
    title: "Additional Questions",
    iconName: "FileText",
    helperText: "Custom questions shown at the end of the registration form",
    emptyLabel: "No additional questions yet. Use the button above to add one.",
    canAddCustom: true,
    addSystemButtonLabel: null,
    headerBg: "bg-slate-50",
    iconBg: "bg-slate-100",
    iconColor: "text-slate-500",
  },
];

const OTHER_REG_SECTIONS: WizardSectionDef[] = [
  {
    id: "participant",
    title: "Participant Information",
    iconName: "User",
    helperText: "Basic participant details",
    emptyLabel: "No participant fields added yet. Use the button above to add one.",
    canAddCustom: false,
    addSystemButtonLabel: "Add Participant Field",
    headerBg: "bg-blue-50",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-700",
  },
  {
    id: "additional",
    title: "Additional Questions",
    iconName: "FileText",
    helperText: "Custom questions shown at the end of the registration form",
    emptyLabel: "No additional questions yet. Use the button above to add one.",
    canAddCustom: true,
    addSystemButtonLabel: null,
    headerBg: "bg-slate-50",
    iconBg: "bg-slate-100",
    iconColor: "text-slate-500",
  },
];

function getWizardSection(field: DraftFieldSpec, registrationType: string): WizardSectionId {
  if (registrationType !== "child_checkin") {
    if (field.fieldKind === "custom" || field.sectionKey === "additional_questions") return "additional";
    return "participant";
  }
  // child_checkin: systemKey determines section (takes precedence over sectionKey)
  if (field.systemKey && GUARDIAN_SECTION_KEYS.has(field.systemKey)) return "guardian";
  if (field.systemKey && CHILD_SECTION_KEYS.has(field.systemKey)) return "child";
  if (field.systemKey && EMERGENCY_SECTION_KEYS.has(field.systemKey)) return "emergency";
  // Custom fields: honour sectionKey if set
  if (field.sectionKey === "guardian_info") return "guardian";
  if (field.sectionKey === "child_info") return "child";
  if (field.sectionKey === "emergency_contact") return "emergency";
  return "additional";
}

interface WizardFieldCardProps {
  field: DraftFieldSpec;
  index: number;
  total: number;
  onUpdate: (updates: Partial<DraftFieldSpec>) => void;
  onDelete: () => void;
  onMove: (dir: "up" | "down") => void;
}

function WizardFieldCard({ field, index, total, onUpdate, onDelete, onMove }: WizardFieldCardProps) {
  const [labelEditing, setLabelEditing] = useState(false);
  const [labelDraft, setLabelDraft] = useState(field.label);
  const labelInputRef = useRef<HTMLInputElement>(null);

  const handleLabelSave = () => {
    const trimmed = labelDraft.trim();
    if (trimmed && trimmed !== field.label) onUpdate({ label: trimmed });
    else setLabelDraft(field.label);
    setLabelEditing(false);
  };

  return (
    <div className="flex items-start gap-2 p-3 rounded-lg border border-border bg-background hover:border-primary/30 transition-colors">
      {/* Move buttons */}
      <div className="flex flex-col gap-0 mt-0.5 flex-shrink-0">
        <button
          type="button"
          onClick={() => onMove("up")}
          disabled={index === 0}
          className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed"
          title="Move up"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onMove("down")}
          disabled={index === total - 1}
          className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed"
          title="Move down"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          {labelEditing ? (
            <input
              ref={labelInputRef}
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onBlur={handleLabelSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLabelSave();
                if (e.key === "Escape") { setLabelDraft(field.label); setLabelEditing(false); }
              }}
              className="text-sm font-medium rounded border border-input bg-background px-1.5 py-0.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={() => { setLabelDraft(field.label); setLabelEditing(true); }}
              className="group/label inline-flex items-center gap-1.5 max-w-full rounded px-1.5 py-0.5 -ml-1.5 cursor-pointer hover:bg-amber-50 transition-colors"
              title="Click to rename"
            >
              <span className="text-sm font-medium text-foreground truncate">{field.label}</span>
              <Pencil className="w-3 h-3 flex-shrink-0 text-muted-foreground/30 group-hover/label:text-amber-600 transition-colors" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onUpdate({ required: !field.required })}
            aria-pressed={field.required}
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all select-none ${
              field.required
                ? "bg-amber-50 border-amber-400/80 text-amber-900 hover:bg-amber-100"
                : "bg-background border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            }`}
          >
            {field.required && <Check className="w-3 h-3 flex-shrink-0" />}
            Required
          </button>

        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{field.fieldKind === "system" ? "System" : "Custom"}</span>
          <span className="text-muted-foreground/40">·</span>
          <span>{FIELD_TYPE_LABELS[field.fieldType] ?? field.fieldType}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onDelete}
        className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0 mt-0.5"
        title="Remove field"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function WizardFormBuilder({
  registrationType,
  fields,
  onChange,
  hasRooms,
}: {
  registrationType: string;
  fields: DraftFieldSpec[];
  onChange: (fields: DraftFieldSpec[]) => void;
  hasRooms: boolean;
}) {
  const [addModal, setAddModal] = useState<{ section: WizardSectionDef; tab: "system" | "custom" } | null>(null);
  const [systemSearch, setSystemSearch] = useState("");
  const [customForm, setCustomForm] = useState({ label: "", fieldType: "text", required: false, placeholder: "" });
  const [collapsedSections, setCollapsedSections] = useState<Set<WizardSectionId>>(new Set());

  const sections = registrationType === "child_checkin" ? CHILD_CHECKIN_SECTIONS : OTHER_REG_SECTIONS;
  const addedSystemKeys = new Set(fields.map((f) => f.systemKey).filter(Boolean));

  const getAvailableForSection = (section: WizardSectionDef) =>
    SYSTEM_FIELDS.filter(
      (f) =>
        !addedSystemKeys.has(f.key) &&
        (!section.allowedSystemKeys || section.allowedSystemKeys.has(f.key)) &&
        (f.key !== "room_assignment" || hasRooms)
    );

  const getFilteredForSection = (section: WizardSectionDef) => {
    const available = getAvailableForSection(section);
    if (!systemSearch) return available;
    return available.filter((f) => f.label.toLowerCase().includes(systemSearch.toLowerCase()));
  };

  const openAddModal = (section: WizardSectionDef) => {
    setAddModal({ section, tab: section.addSystemButtonLabel ? "system" : "custom" });
    setSystemSearch("");
    setCustomForm({ label: "", fieldType: "text", required: false, placeholder: "" });
  };

  const toggleCollapse = (sectionId: WizardSectionId) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId); else next.add(sectionId);
      return next;
    });
  };

  const updateField = (clientId: string, updates: Partial<DraftFieldSpec>) => {
    onChange(fields.map((f) => (f.clientId === clientId ? { ...f, ...updates } : f)));
  };

  const deleteField = (clientId: string) => {
    onChange(fields.filter((f) => f.clientId !== clientId).map((f, i) => ({ ...f, sortOrder: i })));
  };

  const moveFieldInSection = (clientId: string, dir: "up" | "down", sectionFields: DraftFieldSpec[]) => {
    const sectionIdx = sectionFields.findIndex((f) => f.clientId === clientId);
    if (sectionIdx < 0) return;
    const swapTarget = dir === "up" ? sectionFields[sectionIdx - 1] : sectionFields[sectionIdx + 1];
    if (!swapTarget) return;
    const newFields = [...fields];
    const idxA = newFields.findIndex((f) => f.clientId === clientId);
    const idxB = newFields.findIndex((f) => f.clientId === swapTarget.clientId);
    [newFields[idxA], newFields[idxB]] = [newFields[idxB], newFields[idxA]];
    onChange(newFields.map((f, i) => ({ ...f, sortOrder: i })));
  };

  const addSystemField = (sysField: SystemFieldDef) => {
    onChange([...fields, {
      clientId: `draft_sys_${Date.now()}_${sysField.key}`,
      fieldKind: "system",
      systemKey: sysField.key,
      label: sysField.label,
      fieldType: sysField.fieldType,
      required: false,
      sortOrder: fields.length,
      placeholder: sysField.placeholder ?? "",
      options: sysField.defaultOptions ?? "",
      sectionKey: null,
    }]);
    setSystemSearch("");
    // Keep modal open so multiple fields can be added in one session
  };

  const addCustomField = (sectionId: WizardSectionId) => {
    if (!customForm.label.trim()) return;
    onChange([...fields, {
      clientId: `draft_custom_${Date.now()}`,
      fieldKind: "custom",
      systemKey: null,
      label: customForm.label.trim(),
      fieldType: customForm.fieldType,
      required: customForm.required,
      sortOrder: fields.length,
      placeholder: customForm.placeholder.trim(),
      options: "",
      sectionKey:
        sectionId === "guardian"  ? "guardian_info" :
        sectionId === "child"     ? "child_info" :
        sectionId === "emergency" ? "emergency_contact" :
        null,
    }]);
    setAddModal(null);
  };

  const SectionIcon = ({ name, className }: { name: WizardSectionDef["iconName"]; className?: string }) => {
    if (name === "Users") return <Users className={className} />;
    if (name === "Baby") return <Baby className={className} />;
    if (name === "User") return <User className={className} />;
    if (name === "Phone") return <Phone className={className} />;
    return <FileText className={className} />;
  };

  const getAddButtonLabel = (section: WizardSectionDef) => {
    if (section.id === "additional") return "Add Question";
    if (section.id === "guardian")   return "Parent Field";
    if (section.id === "child")      return "Child Field";
    if (section.id === "emergency")  return "Emergency Field";
    return "Add Field";
  };

  const modalSection = addModal?.section ?? null;
  const modalAvailable = modalSection ? getAvailableForSection(modalSection) : [];
  const modalFiltered  = modalSection ? getFilteredForSection(modalSection) : [];
  const showSystemPanel = !!(addModal?.section.addSystemButtonLabel && (addModal.tab === "system" || !addModal.section.canAddCustom));
  const showCustomPanel = !!(addModal?.section.canAddCustom && (addModal.tab === "custom" || !addModal.section.addSystemButtonLabel));

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Click a field name to rename it. Toggle Required on/off. Reorder within each section using the arrows.
      </p>

      {sections.map((section) => {
        const sectionFields = fields.filter((f) => getWizardSection(f, registrationType) === section.id);
        const isCollapsed = collapsedSections.has(section.id);
        const canAdd = !!section.addSystemButtonLabel || section.canAddCustom;

        return (
          <div key={section.id} className="rounded-xl border border-border overflow-hidden">
            {/* Section header */}
            <div className={`px-4 py-2.5 ${section.headerBg} ${!isCollapsed ? "border-b border-border" : ""}`}>
              <div className="flex items-start gap-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${section.iconBg}`}>
                  <SectionIcon name={section.iconName} className={`w-3.5 h-3.5 ${section.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-foreground">{section.title}</p>
                    {section.repeatBadge && (
                      <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium border ${section.iconBg} ${section.iconColor} border-current/20`}>
                        {section.repeatBadge}
                      </span>
                    )}
                    <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {sectionFields.length} {sectionFields.length === 1 ? "field" : "fields"}
                      </span>
                      {canAdd && (
                        <button
                          type="button"
                          onClick={() => openAddModal(section)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border border-border bg-background text-foreground shadow-sm hover:text-amber-800 hover:border-amber-400 hover:bg-amber-50 hover:shadow-none transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          {getAddButtonLabel(section)}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleCollapse(section.id)}
                        className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                        title={isCollapsed ? "Expand section" : "Collapse section"}
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`} />
                      </button>
                    </div>
                  </div>
                  {!isCollapsed && (
                    <p className="text-xs text-muted-foreground mt-0.5">{section.helperText}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Field list */}
            {!isCollapsed && (
              <div className="p-3">
                {sectionFields.length === 0 ? (
                  <div className="py-4 text-center">
                    <p className="text-xs text-muted-foreground">{section.emptyLabel}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sectionFields.map((field, idx) => (
                      <WizardFieldCard
                        key={field.clientId}
                        field={field}
                        index={idx}
                        total={sectionFields.length}
                        onUpdate={(updates) => updateField(field.clientId, updates)}
                        onDelete={() => deleteField(field.clientId)}
                        onMove={(dir) => moveFieldInSection(field.clientId, dir, sectionFields)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Add-field dialog */}
      <Dialog open={!!addModal} onOpenChange={(open) => { if (!open) setAddModal(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {!addModal?.section.addSystemButtonLabel ? "Add Custom Question" : `Add to ${addModal?.section.title}`}
            </DialogTitle>
            <DialogDescription className="sr-only">{addModal?.section.title}</DialogDescription>
          </DialogHeader>

          {/* Tab switcher — only when section supports both system fields and custom questions */}
          {addModal?.section.addSystemButtonLabel && addModal.section.canAddCustom && (
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              <button
                type="button"
                onClick={() => { setAddModal((p) => p ? { ...p, tab: "system" } : p); setSystemSearch(""); }}
                className={`flex-1 px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                  addModal.tab === "system" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                System Field
              </button>
              <button
                type="button"
                onClick={() => setAddModal((p) => p ? { ...p, tab: "custom" } : p)}
                className={`flex-1 px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                  addModal.tab === "custom" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Custom Question
              </button>
            </div>
          )}

          {/* System field picker */}
          {showSystemPanel && (
            <div className="space-y-3">
              <Input
                placeholder="Search fields…"
                value={systemSearch}
                onChange={(e) => setSystemSearch(e.target.value)}
                className="h-9"
                autoFocus
              />
              <div className="max-h-60 overflow-y-auto space-y-0.5">
                {modalFiltered.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    {modalAvailable.length === 0 ? "All available fields have been added." : "No fields match your search."}
                  </p>
                ) : (
                  modalFiltered.map((sysField) => (
                    <button
                      key={sysField.key}
                      type="button"
                      onClick={() => addSystemField(sysField)}
                      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors group"
                    >
                      <span className="flex-1 font-medium">{sysField.label}</span>
                      <span className="text-xs text-muted-foreground bg-muted group-hover:bg-background px-1.5 py-0.5 rounded transition-colors shrink-0">
                        {FIELD_TYPE_LABELS[sysField.fieldType] ?? sysField.fieldType}
                      </span>
                    </button>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground border-t pt-2.5">
                System fields are saved to the child or guardian profile and shared across events.
              </p>
            </div>
          )}

          {/* Custom question form */}
          {showCustomPanel && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Question Label <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g. T-shirt size"
                    value={customForm.label}
                    onChange={(e) => setCustomForm((p) => ({ ...p, label: e.target.value }))}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && customForm.label.trim() && addModal) addCustomField(addModal.section.id);
                      if (e.key === "Escape") setAddModal(null);
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Field Type</Label>
                    <Select value={customForm.fieldType} onValueChange={(v) => setCustomForm((p) => ({ ...p, fieldType: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="textarea">Long Text</SelectItem>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="select">Dropdown</SelectItem>
                        <SelectItem value="checkbox">Checkbox</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Placeholder</Label>
                    <Input
                      placeholder="Optional hint text"
                      value={customForm.placeholder}
                      onChange={(e) => setCustomForm((p) => ({ ...p, placeholder: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="modal-custom-required"
                    checked={customForm.required}
                    onChange={(e) => setCustomForm((p) => ({ ...p, required: e.target.checked }))}
                    className="rounded"
                  />
                  <label htmlFor="modal-custom-required" className="text-sm cursor-pointer">Required</label>
                </div>
              </div>
              <p className="text-xs text-muted-foreground border-t pt-2.5">
                Custom questions are stored only for this event registration and not saved to any profile.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddModal(null)}>Cancel</Button>
                <Button
                  onClick={() => addModal && addCustomField(addModal.section.id)}
                  disabled={!customForm.label.trim()}
                >
                  Add Question
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Step4({
  state,
  setState,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  const isTemplate = state.addDefaultQuestions;

  return (
    <div className="space-y-4">
      <div className={`flex items-start gap-3 p-3.5 rounded-lg border text-sm ${
        isTemplate ? "border-primary/20 bg-primary/5" : "border-border bg-muted/30"
      }`}>
        {isTemplate ? (
          <CheckSquare className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        ) : (
          <FileText className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        )}
        <p className="text-sm text-foreground">
          {isTemplate
            ? "Recommended template fields have been added. Edit, reorder, or remove fields, and add custom questions as needed."
            : "You're starting with a blank form. Add fields below before finishing setup."}
        </p>
      </div>

      <WizardFormBuilder
        registrationType={state.registrationType}
        fields={state.draftFields}
        onChange={(fields) => setState((prev) => ({ ...prev, draftFields: fields }))}
        hasRooms={state.useRooms === true && state.rooms.length > 0}
      />
    </div>
  );
}

// ─── Step 5: Review & Finish ──────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-4 text-sm">
      <span className="text-muted-foreground w-40 shrink-0">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Step5({
  state,
  onConfirmZeroFields,
}: {
  state: WizardState;
  onConfirmZeroFields: () => void;
}) {
  const { data: categories = [] } = useListEventCategories();

  const isChild = !state.registrationType || state.registrationType === "child_checkin";
  const regTypeLabel = ({
    child_checkin: "Child Check-In",
    family_group: "Family / Group",
    individual: "Individual",
  } as Record<string, string>)[state.registrationType] ?? state.registrationType;

  const categoryLabel = categories.find((c) => c.slug === state.eventType)?.name ?? state.eventType;
  const entityPlural = isChild ? "rooms" : "groups";
  const resolvedFormTitle = state.formTitle.trim() || `${state.name} Registration`;

  const systemFields = state.draftFields.filter((f) => f.fieldKind === "system");
  const customFields = state.draftFields.filter((f) => f.fieldKind === "custom");
  const totalFields = state.draftFields.length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Review your setup before finishing. Your event will be created when you click Finish Setup.
      </p>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-2.5 bg-muted/40 border-b border-border">
          <p className="text-sm font-semibold">Event</p>
        </div>
        <div className="p-4 space-y-2.5">
          <ReviewRow label="Name" value={state.name} />
          <ReviewRow label="Registration Type" value={regTypeLabel} />
          <ReviewRow label="Category" value={categoryLabel} />
          <ReviewRow
            label="Schedule"
            value={state.scheduleType === "one_time" ? "One-time" : state.scheduleType === "multi_day" ? "Multi-day" : "Repeating"}
          />
          {state.scheduleType === "one_time" && state.startDate && (
            <ReviewRow label="Date" value={formatPreviewDate(state.startDate)} />
          )}
          {state.scheduleType === "multi_day" && (
            <>
              {state.startDate && <ReviewRow label="Start Date" value={formatPreviewDate(state.startDate)} />}
              {state.endDate && <ReviewRow label="End Date" value={formatPreviewDate(state.endDate)} />}
            </>
          )}
          {state.scheduleType === "repeating" && (
            <>
              {state.startDate && <ReviewRow label="Program Start" value={formatPreviewDate(state.startDate)} />}
              {state.endDate && <ReviewRow label="Program End" value={formatPreviewDate(state.endDate)} />}
              {state.repeatDayOfWeek >= 0 && (
                <ReviewRow
                  label="Repeats"
                  value={`Weekly on ${DAY_NAMES[state.repeatDayOfWeek]}${
                    state.startDate && state.endDate && state.repeatDayOfWeek >= 0
                      ? ` (${computeSessionCount(state.startDate, state.endDate, state.repeatDayOfWeek)} sessions)`
                      : ""
                  }`}
                />
              )}
            </>
          )}
          {(state.startTime || state.endTime) && (
            <ReviewRow label="Time" value={[state.startTime, state.endTime].filter(Boolean).join(" – ")} />
          )}
          {state.description && <ReviewRow label="Description" value={state.description} />}
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-2.5 bg-muted/40 border-b border-border">
          <p className="text-sm font-semibold">{isChild ? "Rooms" : "Groups"}</p>
        </div>
        <div className="p-4 space-y-2.5">
          {state.useRooms === false ? (
            <p className="text-sm text-muted-foreground">No {entityPlural} — skipped</p>
          ) : state.useRooms === true ? (
            <>
              <ReviewRow label="Count" value={`${state.rooms.length} ${isChild ? "room" : "group"}${state.rooms.length !== 1 ? "s" : ""}`} />
              {state.rooms.length > 0 && (
                <ReviewRow label={isChild ? "Rooms" : "Groups"} value={state.rooms.map((r) => r.name).join(", ")} />
              )}
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
          <ReviewRow label="System Fields" value={`${systemFields.length} field${systemFields.length !== 1 ? "s" : ""}`} />
          <ReviewRow label="Custom Questions" value={`${customFields.length} question${customFields.length !== 1 ? "s" : ""}`} />
          <ReviewRow label="Public Form" value={state.isPublic ? "Yes — accessible via embed link" : "No — not publicly accessible"} />
          <ReviewRow label="Accepting Responses" value={state.isActive ? "Yes" : "No"} />
          <ReviewRow label="Check-In" value={state.trackAttendance ? "Enabled" : "Not enabled"} />
          {state.trackAttendance && state.registrationType === "child_checkin" && (
            <ReviewRow label="Require Check-Out" value={state.requireCheckout ? "Yes" : "No"} />
          )}
          {state.trackAttendance && (
            <ReviewRow
              label="Print Labels"
              value={state.printLabels ? (state.labelType === "child_security" ? "Child security label" : state.labelType === "simple_name_tag" ? "Simple Name Tag" : "Simple Child Label") : "No"}
            />
          )}
        </div>
      </div>

      {totalFields === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                This registration form has no fields.
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                You can finish setup, but people will not be asked for any information when they register.
              </p>
            </div>
          </div>
          {!state.zeroFieldsConfirmed && (
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950"
              onClick={onConfirmZeroFields}
            >
              I understand — finish setup anyway
            </Button>
          )}
          {state.zeroFieldsConfirmed && (
            <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> Confirmed — click Finish Setup to continue.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function EventSetupWizard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: org } = useGetOrganization();
  const brandLogo = org?.logoUrl || anchorLogo;
  const createEvent = useCreateEvent();
  const createRoom = useCreateRoom();
  const createFormField = useCreateFormField();
  const updateForm = useUpdateForm();

  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(DEFAULTS);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const update = (k: keyof WizardState, v: unknown) =>
    setState((prev) => ({ ...prev, [k]: v }));

  const canProceed = () => {
    if (step === 1) return !!state.registrationType && !!state.name.trim();
    if (step === 2) return state.useRooms !== null;
    return true;
  };

  const isBusy = createEvent.isPending || createRoom.isPending || createFormField.isPending || updateForm.isPending;

  // Whether user has entered enough to warrant a confirmation on exit
  const hasProgress = state.name.trim() !== "" || state.registrationType !== "" || step > 1;

  const handleNext = () => {
    if (step === 2 && !state.formTitle.trim()) {
      setState((prev) => ({ ...prev, formTitle: `${state.name} Registration` }));
    }

    if (step === 3) {
      const currentIsTemplate = state.addDefaultQuestions;
      const hasRooms = state.useRooms === true && state.rooms.length > 0;

      setState((prev) => {
        // Full rebuild on first visit or when template mode changes
        if (prev.draftFieldsInitializedAsTemplate === null || prev.draftFieldsInitializedAsTemplate !== currentIsTemplate) {
          return {
            ...prev,
            draftFields: currentIsTemplate
              ? buildTemplateDraftFields(state.registrationType, hasRooms)
              : [],
            draftFieldsInitializedAsTemplate: currentIsTemplate,
          };
        }

        // Already initialized with template — keep user edits but sync room field
        if (currentIsTemplate) {
          const hasRoomField = prev.draftFields.some((f) => f.systemKey === "room_assignment");
          if (hasRooms && !hasRoomField) {
            const roomField: DraftFieldSpec = {
              clientId: "draft_room",
              fieldKind: "system",
              systemKey: "room_assignment",
              label: "Room / Group",
              fieldType: "select",
              required: true,
              sortOrder: prev.draftFields.length,
              placeholder: "Select a room or group",
              options: "",
              sectionKey: "child_info",
            };
            return {
              ...prev,
              draftFields: [...prev.draftFields, roomField].map((f, i) => ({ ...f, sortOrder: i })),
            };
          }
          if (!hasRooms && hasRoomField) {
            return {
              ...prev,
              draftFields: prev.draftFields
                .filter((f) => f.systemKey !== "room_assignment")
                .map((f, i) => ({ ...f, sortOrder: i })),
            };
          }
        }

        return prev;
      });

      setStep(4);
      return;
    }

    setStep((s) => s + 1);
  };

  const handleFinish = async () => {
    if (!state.name.trim() || !state.registrationType) return;

    const formTitle = state.formTitle.trim() || `${state.name} Registration`;

    try {
      // 1. Create the event (always with addDefaultQuestions:false — fields created from draftFields below)
      const event = await createEvent.mutateAsync({
        data: {
          name: state.name,
          description: state.description || undefined,
          eventType: state.eventType,
          registrationType: state.registrationType || undefined,
          scheduleType: state.scheduleType,
          startDate: state.startDate || undefined,
          endDate: state.scheduleType !== "one_time" ? (state.endDate || undefined) : undefined,
          startTime: state.startTime || undefined,
          endTime: state.endTime || undefined,
          repeatFrequency: state.scheduleType === "repeating" ? state.repeatFrequency : undefined,
          repeatDayOfWeek:
            state.scheduleType === "repeating" && state.repeatDayOfWeek >= 0
              ? state.repeatDayOfWeek
              : undefined,
          formTitle,
          formDescription: state.formDescription || undefined,
          addDefaultQuestions: false,
          trackAttendance: state.trackAttendance,
          requireCheckout: state.requireCheckout,
          printLabels: state.printLabels,
          labelType: state.labelType,
        },
      });

      // 2. Create rooms
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

      // 3. Create form fields from draftFields
      const formId = event.form?.id;
      if (formId && state.draftFields.length > 0) {
        for (const field of state.draftFields) {
          await createFormField.mutateAsync({
            formId,
            data: {
              fieldKind: field.fieldKind,
              ...(field.systemKey ? { systemKey: field.systemKey } : {}),
              label: field.label,
              fieldType: field.fieldType as "text" | "textarea" | "date" | "phone" | "email" | "select" | "checkbox",
              required: field.required,
              sortOrder: field.sortOrder,
              ...(field.placeholder ? { placeholder: field.placeholder } : {}),
              ...(field.options ? { options: field.options } : {}),
              ...(field.sectionKey ? { sectionKey: field.sectionKey } : {}),
            },
          });
        }
      }

      // 4. Apply form visibility settings if they differ from server defaults
      if (formId) {
        const serverDefaultAllowAdditional = state.registrationType === "family_group";
        const needsUpdate =
          !state.isActive ||
          !state.isPublic ||
          state.allowAdditionalPeople !== serverDefaultAllowAdditional;

        if (needsUpdate) {
          await updateForm.mutateAsync({
            formId,
            data: {
              title: formTitle,
              description: state.formDescription || "",
              isActive: state.isActive,
              isPublic: state.isPublic,
              allowAdditionalPeople: state.allowAdditionalPeople,
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

  const isZeroFields = step === 5 && state.draftFields.length === 0;
  const finishBlocked = isZeroFields && !state.zeroFieldsConfirmed;
  const canGoBack = step > 1;
  const progressPct = ((step - 1) / (STEP_TITLES.length - 1)) * 100;
  const contentMaxWidth = step === 4 ? "max-w-3xl" : "max-w-2xl";

  return (
    <div className="min-h-screen bg-background">
      {/* Exit confirmation dialog */}
      <Dialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Discard event setup?</DialogTitle>
            <DialogDescription>
              You have not finished creating this event. If you leave now, this event will not be created.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowExitConfirm(false)}>
              Continue Setup
            </Button>
            <Button variant="destructive" onClick={() => navigate("/events")}>
              Discard Event Setup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => {
              if (hasProgress) {
                setShowExitConfirm(true);
              } else {
                navigate("/events");
              }
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Events
          </Button>
          <div className="flex items-center gap-2 flex-1 justify-center">
            <img src={brandLogo} alt="Organization logo" className="w-5 h-5 object-contain" />
            <span className="font-serif font-bold text-sm">New Event Setup</span>
          </div>
          <span className="text-xs text-muted-foreground w-16 text-right">
            Step {step} of {STEP_TITLES.length}
          </span>
        </div>
      </header>

      <div className={`${contentMaxWidth} mx-auto px-6 py-8`}>
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
              style={{ width: `${progressPct + 10}%` }}
            />
          </div>
        </div>

        {/* Step content */}
        <div className="mb-2">
          <h1 className="text-2xl font-serif font-bold mb-1">{STEP_TITLES[step - 1]}</h1>
          <p className="text-sm text-muted-foreground">
            {step === 1 && "Set up the basic details for your event."}
            {step === 2 && "Configure rooms or groups for this event. You can skip this step and add them later."}
            {step === 3 && "Configure your registration form settings and choose a starting template."}
            {step === 4 && "Add, edit, and arrange the fields for your registration form."}
            {step === 5 && "Review your event setup before finishing."}
          </p>
        </div>

        <div className="mt-6 mb-10">
          {step === 1 && <Step1 state={state} update={update} />}
          {step === 2 && <Step2 state={state} setState={setState} />}
          {step === 3 && <Step3 state={state} update={update} />}
          {step === 4 && <Step4 state={state} setState={setState} />}
          {step === 5 && (
            <Step5
              state={state}
              onConfirmZeroFields={() => update("zeroFieldsConfirmed", true)}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          {canGoBack ? (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={isBusy}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          ) : (
            <div />
          )}

          {step < STEP_TITLES.length ? (
            <Button onClick={handleNext} disabled={!canProceed() || isBusy}>
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleFinish}
              disabled={isBusy || finishBlocked}
              size="lg"
              className="px-8"
            >
              {isBusy ? "Creating…" : "Finish Setup"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
