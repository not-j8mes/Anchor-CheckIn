import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgePlus,
  ContactRound,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  Search,
  Settings2,
  Trash2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { isPrintActive, printIsolatedRoot } from "@/lib/print-isolation";
import { useAuth } from "@/lib/auth";

interface StaffRole {
  id: number;
  name: string;
}

interface StaffMember {
  id: number;
  roleId: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  roleName: string;
}

interface StaffData {
  roles: StaffRole[];
  members: StaffMember[];
  labelSettings: StaffLabelSettings;
}

interface StaffLabelSettings {
  showLastName: boolean;
  showRole: boolean;
  showEventName: boolean;
  showOrganization: boolean;
}

async function staffRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? "Request failed");
  }
  return (response.status === 204 ? null : response.json()) as Promise<T>;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function printStaffLabels(
  members: StaffMember[],
  eventName: string,
  organizationName: string,
  settings: StaffLabelSettings,
) {
  if (!members.length || isPrintActive()) return;
  document.getElementById("staff-label-print-root")?.remove();
  const root = document.createElement("div");
  root.id = "staff-label-print-root";
  root.style.cssText = "margin:0;padding:0;line-height:0;font-size:0;";
  root.innerHTML = members
    .map(
      (member, index) => `<div style="width:90mm;height:62mm;overflow:hidden;${
        index < members.length - 1
          ? "page-break-after:always;break-after:always;"
          : ""
      }">
<div style="-webkit-print-color-adjust:exact;print-color-adjust:exact;width:90mm;height:62mm;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;background:#fff;border:1px solid #000;border-radius:3px;color:#000;overflow:hidden;display:flex;flex-direction:column;">
  <div style="padding:2.5mm 4mm;border-bottom:1px solid #000;display:flex;justify-content:space-between;align-items:center;">
    <span style="font-size:7pt;font-weight:800;text-transform:uppercase;letter-spacing:.1em;">${settings.showOrganization ? escapeHtml(organizationName) : ""}</span>
    <span style="font-size:7pt;font-weight:800;text-transform:uppercase;letter-spacing:.12em;">STAFF</span>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3mm 5mm;text-align:center;">
    <div style="font-size:28pt;font-weight:900;line-height:1.05;max-width:80mm;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(member.firstName)}</div>
    ${settings.showLastName ? `<div style="font-size:16pt;font-weight:700;line-height:1.2;max-width:80mm;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(member.lastName)}</div>` : ""}
    ${settings.showRole ? `<div style="margin-top:3mm;border:2px solid #000;border-radius:999px;padding:1.5mm 5mm;font-size:11pt;font-weight:800;text-transform:uppercase;letter-spacing:.06em;">${escapeHtml(member.roleName)}</div>` : ""}
  </div>
  ${settings.showEventName ? `<div style="padding:2mm 4mm;border-top:1px solid #000;font-size:7pt;font-weight:700;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(eventName)}</div>` : ""}
</div></div>`,
    )
    .join("");
  document.body.appendChild(root);
  printIsolatedRoot({ mode: "staff-labels", root });
}

export function StaffTabContent({
  eventId,
  eventName,
}: {
  eventId: number;
  eventName: string;
}) {
  const { organization } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ["event-staff", eventId];
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<number | "all">("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [memberToDelete, setMemberToDelete] = useState<StaffMember | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<StaffRole | null>(null);
  const [draftSettings, setDraftSettings] = useState<StaffLabelSettings>({
    showLastName: true,
    showRole: true,
    showEventName: true,
    showOrganization: true,
  });
  const [roleName, setRoleName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roleId, setRoleId] = useState("");

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => staffRequest<StaffData>(`/api/events/${eventId}/staff`),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const showError = (error: Error) =>
    toast({ title: error.message, variant: "destructive" });

  const createRole = useMutation({
    mutationFn: () =>
      staffRequest(`/api/events/${eventId}/staff/roles`, {
        method: "POST",
        body: JSON.stringify({ name: roleName }),
      }),
    onSuccess: () => {
      refresh();
      setRoleName("");
      toast({ title: "Staff role added" });
    },
    onError: showError,
  });
  const deleteRole = useMutation({
    mutationFn: (id: number) =>
      staffRequest(`/api/events/${eventId}/staff/roles/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      refresh();
      setRoleToDelete(null);
      toast({ title: "Staff role removed" });
    },
    onError: showError,
  });
  const createMember = useMutation({
    mutationFn: () =>
      staffRequest(`/api/events/${eventId}/staff/members`, {
        method: "POST",
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          roleId: Number(roleId),
        }),
      }),
    onSuccess: () => {
      refresh();
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setRoleId("");
      setMemberDialogOpen(false);
      toast({ title: "Staff member added" });
    },
    onError: showError,
  });
  const updateMember = useMutation({
    mutationFn: () =>
      staffRequest(`/api/events/${eventId}/staff/members/${editingMember?.id}`, {
        method: "PUT",
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          roleId: Number(roleId),
        }),
      }),
    onSuccess: () => {
      refresh();
      setMemberDialogOpen(false);
      setEditingMember(null);
      toast({ title: "Staff member updated" });
    },
    onError: showError,
  });
  const deleteMember = useMutation({
    mutationFn: (id: number) =>
      staffRequest(`/api/events/${eventId}/staff/members/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      refresh();
      setSelectedIds((current) => {
        const next = new Set(current);
        if (memberToDelete) next.delete(memberToDelete.id);
        return next;
      });
      setMemberToDelete(null);
      toast({ title: "Staff member removed" });
    },
    onError: showError,
  });
  const updateLabelSettings = useMutation({
    mutationFn: () =>
      staffRequest(`/api/events/${eventId}/staff/label-settings`, {
        method: "PUT",
        body: JSON.stringify(draftSettings),
      }),
    onSuccess: () => {
      refresh();
      setLabelDialogOpen(false);
      toast({ title: "Staff label format saved" });
    },
    onError: showError,
  });

  const roles = data?.roles ?? [];
  const members = data?.members ?? [];
  const labelSettings = data?.labelSettings ?? {
    showLastName: true,
    showRole: true,
    showEventName: true,
    showOrganization: true,
  };
  const organizationName = organization?.name ?? "Anchor Events";
  const normalizedSearch = search.trim().toLowerCase();
  const filteredMembers = members.filter((member) => {
    const matchesRole = roleFilter === "all" || member.roleId === roleFilter;
    const matchesSearch =
      !normalizedSearch ||
      `${member.firstName} ${member.lastName} ${member.email ?? ""} ${member.phone ?? ""} ${member.roleName}`
        .toLowerCase()
        .includes(normalizedSearch);
    return matchesRole && matchesSearch;
  });
  const selectedMembers = members.filter((member) => selectedIds.has(member.id));
  const allVisibleSelected =
    filteredMembers.length > 0 &&
    filteredMembers.every((member) => selectedIds.has(member.id));
  const clearFilters = () => {
    setSearch("");
    setRoleFilter("all");
  };
  const openAddMember = () => {
    setEditingMember(null);
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setRoleId("");
    setMemberDialogOpen(true);
  };
  const openEditMember = (member: StaffMember) => {
    setEditingMember(member);
    setFirstName(member.firstName);
    setLastName(member.lastName);
    setEmail(member.email ?? "");
    setPhone(member.phone ?? "");
    setRoleId(String(member.roleId));
    setMemberDialogOpen(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold">Staff</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {members.length} staff member{members.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!members.length}
            onClick={() =>
              printStaffLabels(members, eventName, organizationName, labelSettings)
            }
          >
            <Printer className="mr-1.5 h-4 w-4" /> Print All Labels
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDraftSettings(labelSettings);
              setLabelDialogOpen(true);
            }}
          >
            <Settings2 className="mr-1.5 h-4 w-4" /> Label Format
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRoleDialogOpen(true)}
          >
            <BadgePlus className="mr-1.5 h-4 w-4" /> Manage Roles
          </Button>
        </div>
      </div>

      {/* Search + Add */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search staff…"
            className="h-12 pl-11 text-base"
          />
        </div>
        <Button
          className="h-12 shrink-0 gap-2 px-5 text-base font-semibold"
          disabled={!roles.length}
          onClick={openAddMember}
        >
          <Plus className="h-5 w-5" />
          <span className="hidden sm:inline">Add Staff Member</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={String(roleFilter)}
          onValueChange={(value) =>
            setRoleFilter(value === "all" ? "all" : Number(value))
          }
        >
          <SelectTrigger className="h-9 w-auto min-w-48 text-sm">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Staff ({members.length})</SelectItem>
            {roles.map((role) => {
              const count = members.filter(
                (member) => member.roleId === role.id,
              ).length;
              return (
                <SelectItem key={role.id} value={String(role.id)}>
                  {role.name} ({count})
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
          <span className="mr-1 text-sm font-semibold">{selectedIds.size} selected</span>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() =>
              printStaffLabels(selectedMembers, eventName, organizationName, labelSettings)
            }
          >
            <Printer className="mr-1.5 h-3.5 w-3.5" /> Print Labels
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear Selection
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : !members.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto mb-3 h-9 w-9 text-muted-foreground/30" />
            <h2 className="font-semibold">No staff members yet</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Add staff members, assign event roles, and print name tags for your team.
            </p>
            <Button
              size="sm"
              className="mt-4"
              disabled={!roles.length}
              onClick={openAddMember}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add Staff Member
            </Button>
          </CardContent>
        </Card>
      ) : !filteredMembers.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
            <p className="font-medium">No staff members match your search.</p>
            <Button variant="link" className="mt-1" onClick={clearFilters}>
              Clear search and filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="hidden h-10 grid-cols-[44px_minmax(0,1fr)_minmax(140px,220px)_92px] items-center border-b bg-muted/40 px-4 text-xs font-medium text-muted-foreground sm:grid">
            <Checkbox
              checked={allVisibleSelected}
              aria-label="Select all visible staff"
              onCheckedChange={(checked) => {
                const next = new Set(selectedIds);
                filteredMembers.forEach((member) =>
                  checked ? next.add(member.id) : next.delete(member.id),
                );
                setSelectedIds(next);
              }}
            />
            <span>Name</span>
            <span>Role</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="divide-y">
            {filteredMembers.map((member) => (
              <div
                key={member.id}
                className="grid min-h-[70px] grid-cols-[28px_minmax(0,1fr)_88px] items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30 sm:grid-cols-[44px_minmax(0,1fr)_minmax(140px,220px)_92px]"
              >
                <Checkbox
                  checked={selectedIds.has(member.id)}
                  aria-label={`Select ${member.firstName} ${member.lastName}`}
                  onCheckedChange={(checked) => {
                    const next = new Set(selectedIds);
                    checked ? next.add(member.id) : next.delete(member.id);
                    setSelectedIds(next);
                  }}
                />
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-serif text-sm font-bold text-primary">
                    {member.firstName[0]}
                    {member.lastName[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {member.firstName} {member.lastName}
                    </p>
                    <div className="mt-1 sm:hidden">
                      <Badge className="h-5 rounded-full border-[#E5BE57] bg-[#FFF9EF] text-[10px] font-semibold text-[#A85B00] hover:bg-[#FFF9EF]">
                        {member.roleName}
                      </Badge>
                    </div>
                    {(member.email || member.phone) && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {member.email || member.phone}
                      </p>
                    )}
                  </div>
                </div>
                <div className="hidden sm:block">
                  <Badge className="h-5 rounded-full border-[#E5BE57] bg-[#FFF9EF] text-[10px] font-semibold text-[#A85B00] hover:bg-[#FFF9EF]">
                    {member.roleName}
                  </Badge>
                </div>
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 sm:h-8 sm:w-8"
                    title="Print staff label"
                    onClick={() =>
                      printStaffLabels([member], eventName, organizationName, labelSettings)
                    }
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-8 sm:w-8">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Staff member actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onSelect={() => openEditMember(member)}>
                        <Pencil /> Edit Staff Member
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          printStaffLabels([member], eventName, organizationName, labelSettings)
                        }
                      >
                        <Printer /> Print Name Tag
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => setMemberToDelete(member)}
                      >
                        <Trash2 /> Remove Staff Member
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Manage Roles</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Input
                id="staff-role-name"
                value={roleName}
                onChange={(event) => setRoleName(event.target.value)}
                placeholder="Add a role…"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && roleName.trim()) createRole.mutate();
                }}
              />
              <Button
                disabled={!roleName.trim() || createRole.isPending}
                onClick={() => createRole.mutate()}
              >
                {createRole.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Add
              </Button>
            </div>
            <div className="overflow-hidden rounded-lg border">
              {roles.length ? (
                <div className="divide-y">
                  {roles.map((role) => {
                    const count = members.filter((member) => member.roleId === role.id).length;
                    return (
                      <div key={role.id} className="flex min-h-12 items-center gap-3 px-3 py-2">
                        <ContactRound className="h-4 w-4 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{role.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {count} staff member{count === 1 ? "" : "s"}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          aria-label={`Delete ${role.name} role`}
                          onClick={() => setRoleToDelete(role)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  No roles yet.
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Roles assigned to staff cannot be deleted until those staff members are removed or reassigned.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setRoleDialogOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={labelDialogOpen} onOpenChange={setLabelDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Customize Staff Label</DialogTitle></DialogHeader>
          <div className="grid gap-5 py-2 sm:grid-cols-[1fr_210px]">
            <div className="space-y-4">
              {([
                ["showLastName", "Show last name"],
                ["showRole", "Show staff role"],
                ["showEventName", "Show event name"],
                ["showOrganization", "Show organization"],
              ] as const).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <Label htmlFor={key}>{label}</Label>
                  <Switch
                    id={key}
                    checked={draftSettings[key]}
                    onCheckedChange={(checked) =>
                      setDraftSettings((current) => ({ ...current, [key]: checked }))
                    }
                  />
                </div>
              ))}
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Preview</p>
              <div className="aspect-[90/62] overflow-hidden rounded border border-foreground bg-white text-black shadow-sm">
                <div className="flex h-[22%] items-center justify-between border-b border-black px-2 text-[7px] font-bold uppercase">
                  <span>{draftSettings.showOrganization ? organizationName : ""}</span>
                  <span>Staff</span>
                </div>
                <div className="flex h-[61%] flex-col items-center justify-center px-2 text-center">
                  <div className="max-w-full truncate text-xl font-black">Jordan</div>
                  {draftSettings.showLastName && <div className="text-sm font-bold">Taylor</div>}
                  {draftSettings.showRole && (
                    <div className="mt-1.5 rounded-full border-2 border-black px-3 py-0.5 text-[8px] font-black uppercase">
                      Team Lead
                    </div>
                  )}
                </div>
                {draftSettings.showEventName && (
                  <div className="flex h-[17%] items-center justify-center truncate border-t border-black px-2 text-[7px] font-bold">
                    {eventName}
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLabelDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={updateLabelSettings.isPending}
              onClick={() => updateLabelSettings.mutate()}
            >
              {updateLabelSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Format
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={memberDialogOpen}
        onOpenChange={(open) => {
          setMemberDialogOpen(open);
          if (!open) setEditingMember(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingMember ? "Edit Staff Member" : "Add Staff Member"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="staff-first-name">First name</Label>
              <Input id="staff-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-last-name">Last name</Label>
              <Input id="staff-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Role</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger><SelectValue placeholder="Choose a role" /></SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={String(role.id)}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-email">Email (optional)</Label>
              <Input id="staff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-phone">Phone (optional)</Label>
              <Input id="staff-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={
                !firstName.trim() ||
                !lastName.trim() ||
                !roleId ||
                createMember.isPending ||
                updateMember.isPending
              }
              onClick={() =>
                editingMember ? updateMember.mutate() : createMember.mutate()
              }
            >
              {(createMember.isPending || updateMember.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingMember ? "Save Changes" : "Add Staff Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!memberToDelete}
        onOpenChange={(open) => !open && setMemberToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove staff member?</AlertDialogTitle>
            <AlertDialogDescription>
              {memberToDelete
                ? `${memberToDelete.firstName} ${memberToDelete.lastName} will be removed from this event.`
                : "This staff member will be removed from the event."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMember.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (memberToDelete) deleteMember.mutate(memberToDelete.id);
              }}
            >
              {deleteMember.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove Staff Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!roleToDelete}
        onOpenChange={(open) => !open && setRoleToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {roleToDelete &&
              members.some((member) => member.roleId === roleToDelete.id)
                ? "This role is currently in use"
                : "Delete staff role?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {roleToDelete &&
              members.some((member) => member.roleId === roleToDelete.id)
                ? `Remove or reassign staff with the ${roleToDelete.name} role before deleting it.`
                : `The ${roleToDelete?.name ?? ""} role will be permanently deleted.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {roleToDelete &&
            members.some((member) => member.roleId === roleToDelete.id) ? (
              <AlertDialogCancel>Close</AlertDialogCancel>
            ) : (
              <>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={deleteRole.isPending}
                  onClick={(event) => {
                    event.preventDefault();
                    if (roleToDelete) deleteRole.mutate(roleToDelete.id);
                  }}
                >
                  {deleteRole.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Delete Role
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
