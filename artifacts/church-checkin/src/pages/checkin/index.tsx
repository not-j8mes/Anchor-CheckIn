import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import {
  useListChildren,
  useBatchCheckin,
  useCheckoutChild,
  useDeleteCheckin,
  useListEvents,
  useSubmitRegistration,
  useGetOrganization,
  getListChildrenQueryKey,
  getGetFormBySlugQueryKey,
  getFormBySlug,
  LabelData,
  Child,
  Event,
  type FormField,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select as UiSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox as UiCheckbox } from "@/components/ui/checkbox";
import {
  Search,
  AlertCircle,
  Users,
  UserCheck,
  Loader2,
  CheckCheck,
  LogOut,
  Undo2,
  LayoutDashboard,
  UserPlus,
  Calendar,
  ChevronRight,
  Plus,
  Trash2,
  User,
  Printer,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LabelPrintDialog } from "@/components/checkin/LabelPrintDialog";
import { Switch } from "@/components/ui/switch";

function groupByFamily(children: Child[]): Array<{ guardian: string; children: Child[] }> {
  const map = new Map<string, Child[]>();
  for (const child of children) {
    const key = child.guardianName || "Unknown Guardian";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(child);
  }
  return Array.from(map.entries()).map(([guardian, children]) => ({ guardian, children }));
}

interface FamilyCardProps {
  guardian: string;
  children: Child[];
  onCheckinFamily: (selected: Child[]) => void;
  onCheckoutChild: (child: Child) => void;
  onUndoCheckin: (child: Child) => void;
  isCheckingIn: boolean;
  loadingCheckinId: number | null;
}

function FamilyCard({
  guardian,
  children,
  onCheckinFamily,
  onCheckoutChild,
  onUndoCheckin,
  isCheckingIn,
  loadingCheckinId,
}: FamilyCardProps) {
  const notCheckedIn = children.filter((c) => !c.isCheckedIn);
  const alreadyCheckedIn = children.filter((c) => c.isCheckedIn);

  const [selected, setSelected] = useState<Set<number>>(
    new Set(notCheckedIn.map((c) => c.id))
  );

  const toggleChild = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(
      selected.size === notCheckedIn.length
        ? new Set()
        : new Set(notCheckedIn.map((c) => c.id))
    );

  const selectedChildren = notCheckedIn.filter((c) => selected.has(c.id));

  return (
    <Card className="overflow-hidden border-primary/20 shadow-md" data-testid={`family-card-${guardian}`}>
      <div className="bg-primary/5 border-b border-primary/10 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="font-semibold text-foreground">{guardian}</span>
          <Badge variant="secondary" className="text-xs">
            {children.length} {children.length === 1 ? "child" : "children"}
          </Badge>
        </div>
        {notCheckedIn.length > 1 && (
          <button type="button" onClick={toggleAll} className="text-xs text-primary hover:underline font-medium">
            {selected.size === notCheckedIn.length ? "Deselect all" : "Select all"}
          </button>
        )}
      </div>

      <CardContent className="p-0 divide-y divide-border">
        {alreadyCheckedIn.map((child) => (
          <div key={child.id} className="flex items-center gap-4 px-5 py-4 bg-green-50/50" data-testid={`child-row-${child.id}`}>
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center font-serif font-bold text-green-700 text-sm flex-shrink-0">
              {child.firstName[0]}{child.lastName[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-base flex items-center gap-2 flex-wrap">
                {child.firstName} {child.lastName}
                <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Checked In</Badge>
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
                {child.room && <span>{child.room}</span>}
                {child.activeCheckinLabelCode && (
                  <span className="font-mono font-bold text-green-700">Code: {child.activeCheckinLabelCode}</span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="text-muted-foreground hover:text-destructive hover:border-destructive gap-1"
                disabled={loadingCheckinId === child.checkinId}
                onClick={() => onCheckoutChild(child)}
                data-testid={`button-checkout-${child.id}`}
              >
                {loadingCheckinId === child.checkinId ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <LogOut className="w-3.5 h-3.5" />
                )}
                Check Out
              </Button>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                onClick={() => onUndoCheckin(child)}
                data-testid={`button-undo-checkin-${child.id}`}
              >
                <Undo2 className="w-3 h-3" /> Undo check-in
              </button>
            </div>
          </div>
        ))}

        {notCheckedIn.map((child) => {
          const isChecked = selected.has(child.id);
          return (
            <div
              key={child.id}
              className={`flex items-center gap-4 px-5 py-4 transition-colors cursor-pointer ${
                isChecked ? "bg-primary/5" : "hover:bg-muted/30"
              }`}
              onClick={() => toggleChild(child.id)}
              data-testid={`child-row-${child.id}`}
            >
              <Checkbox
                checked={isChecked}
                onCheckedChange={() => toggleChild(child.id)}
                className="pointer-events-none"
                data-testid={`checkbox-child-${child.id}`}
              />
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-serif font-bold text-primary text-sm flex-shrink-0">
                {child.firstName[0]}{child.lastName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-base">{child.firstName} {child.lastName}</div>
                <div className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
                  {child.room && <span>{child.room}</span>}
                  {(child.allergies || child.specialNeeds) && (
                    <span className="flex items-center gap-1 text-amber-600 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" /> Medical notes
                    </span>
                  )}
                </div>
              </div>
              {isChecked && <UserCheck className="w-4 h-4 text-primary flex-shrink-0" />}
            </div>
          );
        })}
      </CardContent>

      {notCheckedIn.length > 0 && (
        <div className="px-5 py-4 border-t border-border bg-background">
          <Button
            className="w-full h-12 text-base font-bold gap-2"
            disabled={selectedChildren.length === 0 || isCheckingIn}
            onClick={() => onCheckinFamily(selectedChildren)}
            data-testid={`button-checkin-family-${guardian}`}
          >
            {isCheckingIn ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Checking in...</>
            ) : (
              <><CheckCheck className="w-5 h-5" />
                Check In {selectedChildren.length > 1
                  ? `${selectedChildren.length} Children`
                  : selectedChildren[0]?.firstName || "Child"}
              </>
            )}
          </Button>
        </div>
      )}
    </Card>
  );
}

// ─── Field renderer (mirrors the public registration form) ────────────────────

function FieldInput({ field, value, onChange }: { field: FormField; value: string; onChange: (v: string) => void }) {
  const { fieldType, placeholder, options, required, label } = field;
  if (fieldType === "textarea")
    return <Textarea required={required} placeholder={placeholder ?? ""} value={value} onChange={(e) => onChange(e.target.value)} rows={2} />;
  if ((fieldType === "select" || fieldType === "multiselect") && options)
    return (
      <UiSelect value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder={placeholder ?? "Select…"} /></SelectTrigger>
        <SelectContent>
          {options.split(",").map((o) => <SelectItem key={o.trim()} value={o.trim()}>{o.trim()}</SelectItem>)}
        </SelectContent>
      </UiSelect>
    );
  if (fieldType === "checkbox")
    return (
      <div className="flex items-center gap-2 mt-1">
        <UiCheckbox id={`wf-${field.id}`} checked={value === "true"} onCheckedChange={(c) => onChange(c ? "true" : "")} />
        <label htmlFor={`wf-${field.id}`} className="text-sm text-muted-foreground cursor-pointer">{placeholder ?? label}</label>
      </div>
    );
  return (
    <Input
      type={fieldType === "date" ? "date" : fieldType === "email" ? "email" : fieldType === "phone" ? "tel" : fieldType === "number" ? "number" : "text"}
      required={required} placeholder={placeholder ?? ""} value={value}
      onChange={(e) => onChange(e.target.value)} autoComplete="off"
    />
  );
}

function isGuardianField(field: FormField): boolean {
  if (field.fieldKind !== "system" || !field.systemKey) return false;
  return ["guardian_first_name", "guardian_last_name", "guardian_email", "guardian_phone",
    "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relationship"].includes(field.systemKey);
}

// ─── Walk-in dialog ───────────────────────────────────────────────────────────

interface WalkInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (labels: LabelData[]) => void;
  event: Event;
}

function WalkInDialog({ open, onOpenChange, onSuccess, event }: WalkInDialogProps) {
  const { toast } = useToast();

  const { data: form, isLoading: formLoading } = useQuery({
    queryKey: getGetFormBySlugQueryKey(event.formEmbedSlug ?? ""),
    queryFn: () => getFormBySlug(event.formEmbedSlug!),
    enabled: open && !!event.formEmbedSlug,
  });

  const formFields: FormField[] = form?.formFields ?? [];
  const guardianFields = formFields.filter(isGuardianField);
  const childFields = formFields.filter((f) => !isGuardianField(f));

  const [guardianAnswers, setGuardianAnswers] = useState<Record<number, string>>({});
  const [childrenAnswers, setChildrenAnswers] = useState<Record<number, string>[]>([{}]);
  const [submitting, setSubmitting] = useState(false);

  const submitRegistration = useSubmitRegistration();
  const batchCheckin = useBatchCheckin();

  const reset = () => { setGuardianAnswers({}); setChildrenAnswers([{}]); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSubmitting(true);
    try {
      const registrationIds: number[] = [];
      for (const childAnswerMap of childrenAnswers) {
        const fields = [
          ...guardianFields.map((f) => ({ fieldId: f.id, value: guardianAnswers[f.id] ?? "" })),
          ...childFields.map((f) => ({ fieldId: f.id, value: childAnswerMap[f.id] ?? "" })),
        ];
        const reg = await submitRegistration.mutateAsync({ formId: form.id, data: { fields } });
        registrationIds.push((reg as { id: number }).id);
      }
      const result = await batchCheckin.mutateAsync({
        data: { items: registrationIds.map((id) => ({ registrationId: id })) },
      });
      onSuccess(result.labels as LabelData[]);
      onOpenChange(false);
      reset();
    } catch {
      toast({ title: "Walk-in failed — please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-serif">Walk-In Registration</DialogTitle>
        </DialogHeader>

        {formLoading ? (
          <div className="flex items-center justify-center py-12 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-muted-foreground">Loading form…</span>
          </div>
        ) : !form ? (
          <p className="py-8 text-center text-muted-foreground">This event has no registration form.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 pt-2">
            {/* Guardian section */}
            {guardianFields.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-1 border-b border-border">
                  <User className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold">Parent / Guardian</p>
                </div>
                {guardianFields.map((field) => (
                  <div key={field.id} className="space-y-1.5">
                    <Label className="text-sm flex items-center gap-1">
                      {field.label}{field.required && <span className="text-destructive">*</span>}
                    </Label>
                    <FieldInput field={field} value={guardianAnswers[field.id] ?? ""} onChange={(v) => setGuardianAnswers((p) => ({ ...p, [field.id]: v }))} />
                  </div>
                ))}
              </div>
            )}

            {/* Per-child sections */}
            {childrenAnswers.map((childAnswerMap, idx) => (
              <div key={idx} className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <p className="text-sm font-semibold">
                      {childrenAnswers.length > 1 ? `Child ${idx + 1}` : "Child Information"}
                    </p>
                  </div>
                  {childrenAnswers.length > 1 && (
                    <button type="button" className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                      onClick={() => setChildrenAnswers((p) => p.filter((_, i) => i !== idx))}>
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  )}
                </div>
                {childFields.map((field) => (
                  <div key={field.id} className="space-y-1.5">
                    <Label className="text-sm flex items-center gap-1">
                      {field.label}{field.required && <span className="text-destructive">*</span>}
                    </Label>
                    <FieldInput field={field} value={childAnswerMap[field.id] ?? ""}
                      onChange={(v) => setChildrenAnswers((p) => { const next = [...p]; next[idx] = { ...next[idx], [field.id]: v }; return next; })} />
                  </div>
                ))}
              </div>
            ))}

            <Button type="button" variant="outline" size="sm" className="w-full border-dashed gap-2"
              onClick={() => setChildrenAnswers((p) => [...p, {}])}>
              <Plus className="w-3.5 h-3.5" /> Add Another Child
            </Button>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => { onOpenChange(false); reset(); }}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="gap-2">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
                Register &amp; Check In
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface EventSelectorProps {
  onSelect: (event: Event) => void;
}

function EventSelector({ onSelect }: EventSelectorProps) {
  const { data: events, isLoading } = useListEvents();
  const eligibleEvents = events?.filter((e) => e.formId && (e.status === "active" || e.status === "upcoming")) ?? [];

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-serif font-bold text-primary">Select Event</h1>
          <p className="text-muted-foreground text-lg">Choose which event this kiosk is for</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-muted-foreground">Loading events...</span>
          </div>
        ) : eligibleEvents.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="py-12 text-center">
              <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-xl text-muted-foreground font-serif mb-1">No active events</p>
              <p className="text-sm text-muted-foreground">Create an event and attach a form to use the kiosk.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {eligibleEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => onSelect(event)}
                className="w-full text-left"
              >
                <Card className="border-2 border-transparent hover:border-primary hover:shadow-md transition-all cursor-pointer">
                  <CardContent className="px-6 py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-lg text-foreground truncate">{event.name}</p>
                      {event.startDate && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {new Date(event.startDate).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                        </p>
                      )}
                      <Badge
                        variant={event.status === "active" ? "default" : "secondary"}
                        className="mt-1.5 text-xs"
                      >
                        {event.status}
                      </Badge>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CheckinKiosk() {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [printLabels, setPrintLabels] = useState<boolean>(() => {
    return localStorage.getItem("checkin:printLabels") !== "false";
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handlePrintLabelsToggle = (val: boolean) => {
    setPrintLabels(val);
    localStorage.setItem("checkin:printLabels", String(val));
  };

  const childrenParams = {
    search: debouncedSearch || undefined,
    eventId: selectedEvent?.id,
  };
  const { data: children, isLoading: searching } = useListChildren(
    childrenParams,
    { query: { enabled: debouncedSearch.length > 1 && selectedEvent !== null, queryKey: getListChildrenQueryKey(childrenParams) } }
  );

  const { toast } = useToast();
  useGetOrganization();

  const [collectedLabels, setCollectedLabels] = useState<LabelData[]>([]);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [checkingInGuardian, setCheckingInGuardian] = useState<string | null>(null);
  const [loadingCheckinId, setLoadingCheckinId] = useState<number | null>(null);

  const handleWalkInSuccess = (labels: LabelData[]) => {
    queryClient.invalidateQueries({ queryKey: getListChildrenQueryKey(childrenParams) });
    if (printLabels && labels.length > 0) {
      setCollectedLabels(labels);
      setPrintDialogOpen(true);
    }
    toast({
      title: labels.length > 1
        ? `${labels.length} children registered and checked in!`
        : `${labels[0]?.childName} registered and checked in!`,
    });
  };

  const batchCheckin = useBatchCheckin();
  const checkoutChild = useCheckoutChild();
  const deleteCheckin = useDeleteCheckin();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const refreshResults = () =>
    queryClient.invalidateQueries({ queryKey: getListChildrenQueryKey(childrenParams) });

  const handleCheckinFamily = async (familyGuardian: string, selectedChildren: Child[]) => {
    if (selectedChildren.length === 0) return;
    setCheckingInGuardian(familyGuardian);
    try {
      const result = await batchCheckin.mutateAsync({
        data: {
          items: selectedChildren.map((c) => ({
            registrationId: c.registrationId ?? c.id,
            room: c.room ?? undefined,
          })),
        },
      });
      setSearch("");
      setDebouncedSearch("");
      if (printLabels && result.labels.length > 0) {
        setCollectedLabels(result.labels as LabelData[]);
        setPrintDialogOpen(true);
      }
      toast({
        title: result.labels.length > 1
          ? `${result.labels.length} children checked in for ${familyGuardian}`
          : `${selectedChildren[0]?.firstName} checked in!`,
      });
    } catch {
      toast({ title: "Check-in failed — please try again.", variant: "destructive" });
    } finally {
      setCheckingInGuardian(null);
    }
  };

  const handleCheckoutChild = async (child: Child) => {
    if (!child.checkinId) return;
    setLoadingCheckinId(child.checkinId);
    try {
      await checkoutChild.mutateAsync({ checkinId: child.checkinId });
      toast({ title: `${child.firstName} checked out.` });
      refreshResults();
    } catch {
      toast({ title: "Check-out failed — please try again.", variant: "destructive" });
    } finally {
      setLoadingCheckinId(null);
    }
  };

  const handleUndoCheckin = async (child: Child) => {
    if (!child.checkinId) return;
    setLoadingCheckinId(child.checkinId);
    try {
      await deleteCheckin.mutateAsync({ checkinId: child.checkinId });
      toast({ title: `Check-in for ${child.firstName} removed.` });
      refreshResults();
    } catch {
      toast({ title: "Could not undo check-in.", variant: "destructive" });
    } finally {
      setLoadingCheckinId(null);
    }
  };

  const families = children ? groupByFamily(children) : [];
  const showResults = debouncedSearch.length > 1;

  if (!selectedEvent) {
    return <EventSelector onSelect={setSelectedEvent} />;
  }

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-muted/30">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-background border-b border-border shadow-sm">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Button>
        </Link>
        <button
          type="button"
          onClick={() => { setSelectedEvent(null); setSearch(""); setDebouncedSearch(""); }}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Calendar className="w-4 h-4" />
          {selectedEvent.name}
          <span className="text-xs text-muted-foreground/60">(change)</span>
        </button>
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-1.5 text-sm font-medium cursor-pointer select-none transition-colors ${printLabels ? "text-primary" : "text-muted-foreground"}`}
            title={printLabels ? "Label printing on" : "Label printing off"}
            onClick={() => handlePrintLabelsToggle(!printLabels)}
          >
            <Printer className="w-4 h-4" />
            <Switch
              checked={printLabels}
              onCheckedChange={handlePrintLabelsToggle}
              onClick={(e) => e.stopPropagation()}
              aria-label="Print labels on check-in"
            />
          </div>
          <Button variant="outline" size="sm" className="gap-2 w-28" onClick={() => setWalkInOpen(true)}>
            <UserPlus className="w-4 h-4" /> Walk-in
          </Button>
        </div>
      </div>

      {/* Main centered content */}
      <div className="flex flex-col flex-1 items-center w-full">
        <div className="text-center pt-10 pb-6 px-4">
          <h1 className="text-5xl font-serif font-bold text-primary">Welcome!</h1>
          <p className="text-xl text-muted-foreground mt-2">
            Search by child name, guardian name, or phone number.
          </p>
        </div>

        <div className="px-4 md:px-8 w-full max-w-2xl">
          <Card className="shadow-md overflow-hidden">
            <CardContent className="p-2">
              <div className="relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-8 h-8 text-muted-foreground pointer-events-none" />
                <Input
                  ref={inputRef}
                  autoFocus
                  placeholder="Type family name or phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-20 text-3xl h-24 rounded-lg bg-muted/20 border-transparent focus-visible:ring-primary font-serif placeholder:text-muted-foreground/50"
                  data-testid="input-checkin-search"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => { setSearch(""); setDebouncedSearch(""); }}
                    className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors text-2xl font-light"
                  >
                    ×
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="px-4 md:px-8 w-full max-w-2xl mt-6 pb-12">
          {showResults ? (
            <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
              {searching ? (
                <div className="flex items-center justify-center py-16 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <span className="text-lg text-muted-foreground">Searching...</span>
                </div>
              ) : families.length === 0 ? (
                <Card className="shadow-sm">
                  <CardContent className="py-16 text-center">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
                    <p className="text-2xl text-muted-foreground font-serif mb-2">
                      No matches for "{debouncedSearch}"
                    </p>
                    <p className="text-muted-foreground text-sm mb-6">
                      This family may not be registered yet.
                    </p>
                    <Button onClick={() => setWalkInOpen(true)} className="gap-2">
                      <UserPlus className="w-4 h-4" /> Register as Walk-in
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground font-medium px-1">
                    {families.length === 1
                      ? `1 family found · ${children?.length} ${children?.length === 1 ? "child" : "children"}`
                      : `${families.length} families found · ${children?.length} children total`}
                  </p>
                  {families.map((family) => (
                    <FamilyCard
                      key={family.guardian}
                      guardian={family.guardian}
                      children={family.children}
                      onCheckinFamily={(selected) => handleCheckinFamily(family.guardian, selected)}
                      onCheckoutChild={handleCheckoutChild}
                      onUndoCheckin={handleUndoCheckin}
                      isCheckingIn={checkingInGuardian === family.guardian}
                      loadingCheckinId={loadingCheckinId}
                    />
                  ))}
                </>
              )}
            </div>
          ) : (
            <div className="text-center pt-16 text-muted-foreground opacity-50">
              <Search className="w-16 h-16 mx-auto mb-4" />
              <p className="text-xl font-serif">Start typing to find a family</p>
            </div>
          )}
        </div>
      </div>

      <LabelPrintDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        labels={collectedLabels}
      />
      {selectedEvent && (
        <WalkInDialog
          open={walkInOpen}
          onOpenChange={setWalkInOpen}
          onSuccess={handleWalkInSuccess}
          event={selectedEvent}
        />
      )}
    </div>
  );
}
