import { useState } from "react";
import {
  useListChildren,
  useUpdateRegistration,
  getListChildrenQueryKey,
  type Child,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Users, Phone, User, Calendar, Pencil, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// ─── Edit dialog ──────────────────────────────────────────────────────────────

interface EditChildDialogProps {
  child: Child;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function EditChildDialog({ child, open, onOpenChange }: EditChildDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const guardianParts = (child.guardianName ?? "").trim().split(/\s+/);
  const [form, setForm] = useState({
    childFirstName: child.firstName,
    childLastName: child.lastName,
    childDateOfBirth: child.dateOfBirth ?? "",
    guardianFirstName: guardianParts[0] ?? "",
    guardianLastName: guardianParts.slice(1).join(" ") ?? "",
    guardianPhone: child.guardianPhone ?? "",
    guardianEmail: child.guardianEmail ?? "",
    allergies: child.allergies ?? "",
    specialNeeds: child.specialNeeds ?? "",
    room: child.room ?? "",
  });

  const set = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

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
          <DialogTitle className="text-xl font-serif">
            Edit — {child.firstName} {child.lastName}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">

          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Child</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input value={form.childFirstName} onChange={set("childFirstName")} />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input value={form.childLastName} onChange={set("childLastName")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Date of Birth</Label>
              <Input type="date" value={form.childDateOfBirth} onChange={set("childDateOfBirth")} />
            </div>
            <div className="space-y-1.5">
              <Label>Allergies</Label>
              <Input value={form.allergies} onChange={set("allergies")} placeholder="e.g. peanuts, latex" />
            </div>
            <div className="space-y-1.5">
              <Label>Special Needs / Notes</Label>
              <Input value={form.specialNeeds} onChange={set("specialNeeds")} placeholder="Any accommodations needed" />
            </div>
            <div className="space-y-1.5">
              <Label>Room</Label>
              <Input value={form.room} onChange={set("room")} placeholder="Room name" />
            </div>
          </div>

          <div className="space-y-3 pt-1 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Guardian</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input value={form.guardianFirstName} onChange={set("guardianFirstName")} />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input value={form.guardianLastName} onChange={set("guardianLastName")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input type="tel" value={form.guardianPhone} onChange={set("guardianPhone")} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.guardianEmail} onChange={set("guardianEmail")} />
            </div>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChildrenDirectory() {
  const [search, setSearch] = useState("");
  const { data: children, isLoading } = useListChildren({ search: search || undefined });
  const [editingChild, setEditingChild] = useState<Child | null>(null);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Children Directory</h1>
          <p className="text-muted-foreground mt-1">Search and manage all registered children</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by child or guardian name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-20 bg-muted/50 rounded-t-lg border-b border-border/50" />
              <CardContent className="h-32" />
            </Card>
          ))}
        </div>
      ) : children && children.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {children.map((child) => (
            <Card key={child.id} className="hover-elevate transition-all border-card-border overflow-hidden group">
              <CardHeader className="bg-card pb-4 border-b border-border/50 relative">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold font-serif text-lg shrink-0">
                    {child.firstName[0]}{child.lastName[0]}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg font-serif">
                      {child.firstName} {child.lastName}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <User className="w-3 h-3" /> {child.guardianName || "No Guardian"}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity -mt-1 -mr-2"
                    onClick={() => setEditingChild(child)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="py-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs font-medium">Room</p>
                    <p className="font-medium text-foreground">{child.room || "Unassigned"}</p>
                  </div>
                  {child.dateOfBirth && (
                    <div>
                      <p className="text-muted-foreground text-xs font-medium">DOB</p>
                      <p className="text-foreground">{format(new Date(child.dateOfBirth), "MMM d, yyyy")}</p>
                    </div>
                  )}
                  {child.guardianPhone && (
                    <div className="col-span-2 flex items-center gap-2 mt-1 text-foreground">
                      <Phone className="w-3 h-3 text-muted-foreground" />
                      {child.guardianPhone}
                    </div>
                  )}
                  {child.lastCheckinAt && (
                    <div className="col-span-2 flex items-center gap-2 text-foreground">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      Last check-in: {format(new Date(child.lastCheckinAt), "MMM d")}
                    </div>
                  )}
                </div>

                {(child.allergies || child.specialNeeds) && (
                  <div className="pt-2 flex flex-wrap gap-2">
                    {child.allergies && (
                      <Badge variant="destructive" className="text-[10px] bg-red-100 text-red-800 hover:bg-red-100 border-none">
                        Allergy: {child.allergies}
                      </Badge>
                    )}
                    {child.specialNeeds && (
                      <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800 hover:bg-amber-100 border-none">
                        Note: {child.specialNeeds}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No children found"
          description={search ? "Try adjusting your search terms." : "No children have been registered yet. They will appear here once someone registers through a form."}
          icon={<Users className="w-8 h-8" />}
        />
      )}

      {editingChild && (
        <EditChildDialog
          key={editingChild.id}
          child={editingChild}
          open={!!editingChild}
          onOpenChange={(v) => { if (!v) setEditingChild(null); }}
        />
      )}
    </div>
  );
}
