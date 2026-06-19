import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, Building2, Users, RefreshCw, Pencil, LogOut, AlertCircle } from "lucide-react";
import appLogo from "@assets/image_1781393408862.png";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlatformOrg {
  id: number;
  name: string;
  plan: string;
  subscriptionStatus: string;
  createdAt: string;
  userCount: number;
}

interface PlatformUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  isSuperAdmin: boolean;
  createdAt: string;
  organizationId: number | null;
  organizationName: string | null;
  role: string | null;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function platformFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error((body as { error?: string })?.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// ─── Plan / status badges ─────────────────────────────────────────────────────

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, string> = {
    free: "bg-slate-100 text-slate-700 border-slate-200",
    basic: "bg-blue-100 text-blue-700 border-blue-200",
    pro: "bg-purple-100 text-purple-700 border-purple-200",
    custom: "bg-orange-100 text-orange-700 border-orange-200",
  };
  return (
    <Badge className={`capitalize border ${colors[plan] ?? "bg-muted text-muted-foreground"}`}>
      {plan}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    trialing: "bg-yellow-100 text-yellow-700 border-yellow-200",
    active: "bg-green-100 text-green-700 border-green-200",
    past_due: "bg-red-100 text-red-700 border-red-200",
    canceled: "bg-slate-100 text-slate-500 border-slate-200",
    none: "bg-slate-100 text-slate-500 border-slate-200",
  };
  const label = status === "past_due" ? "Past Due" : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <Badge className={`border ${colors[status] ?? "bg-muted text-muted-foreground"}`}>
      {label}
    </Badge>
  );
}

// ─── Edit Org Dialog ──────────────────────────────────────────────────────────

function EditOrgDialog({
  org,
  open,
  onClose,
  onSaved,
}: {
  org: PlatformOrg;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(org.name);
  const [plan, setPlan] = useState(org.plan);
  const [subscriptionStatus, setSubscriptionStatus] = useState(org.subscriptionStatus);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(org.name);
      setPlan(org.plan);
      setSubscriptionStatus(org.subscriptionStatus);
    }
  }, [open, org]);

  async function handleSave() {
    setSaving(true);
    try {
      await platformFetch(`/platform/organizations/${org.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, plan, subscriptionStatus }),
      });
      toast({ title: "Organization updated" });
      onSaved();
      onClose();
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to update organization",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Organization</DialogTitle>
          <DialogDescription>Update plan and subscription status.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Organization Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Plan</Label>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Subscription Status</Label>
            <Select value={subscriptionStatus} onValueChange={setSubscriptionStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="trialing">Trialing</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="past_due">Past Due</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reset Password Dialog ────────────────────────────────────────────────────

function ResetPasswordDialog({
  user,
  open,
  onClose,
}: {
  user: PlatformUser;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setNewPassword("");
  }, [open]);

  async function handleReset() {
    if (!newPassword) return;
    setSaving(true);
    try {
      await platformFetch("/platform/users/reset-password", {
        method: "POST",
        body: JSON.stringify({ userId: user.id, newPassword }),
      });
      toast({ title: `Password reset for ${user.email}` });
      onClose();
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to reset password",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 py-2">
          <Label>New Temporary Password</Label>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleReset} disabled={saving || !newPassword}>
            {saving ? "Resetting…" : "Reset Password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Organizations Table ──────────────────────────────────────────────────────

function OrganizationsSection({
  orgs,
  onRefresh,
}: {
  orgs: PlatformOrg[];
  onRefresh: () => void;
}) {
  const [editOrg, setEditOrg] = useState<PlatformOrg | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-[#1a2e4a]">Organizations</CardTitle>
          <CardDescription>{orgs.length} organization{orgs.length !== 1 ? "s" : ""}</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} className="gap-1.5 shrink-0">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {orgs.length === 0 ? (
          <p className="px-6 py-8 text-center text-muted-foreground text-sm">No organizations yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plan</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Users</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {orgs.map((org, i) => (
                  <tr
                    key={org.id}
                    className={`border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`}
                  >
                    <td className="px-6 py-3 font-medium">{org.name}</td>
                    <td className="px-4 py-3"><PlanBadge plan={org.plan} /></td>
                    <td className="px-4 py-3"><StatusBadge status={org.subscriptionStatus} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{org.userCount}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setEditOrg(org)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {editOrg && (
        <EditOrgDialog
          org={editOrg}
          open={true}
          onClose={() => setEditOrg(null)}
          onSaved={onRefresh}
        />
      )}
    </Card>
  );
}

// ─── Create Org + Owner Form ──────────────────────────────────────────────────

const EMPTY_ORG_FORM = {
  organizationName: "",
  ownerFirstName: "",
  ownerLastName: "",
  ownerEmail: "",
  temporaryPassword: "",
  plan: "basic",
  subscriptionStatus: "trialing",
};

function CreateOrgSection({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY_ORG_FORM);
  const [submitting, setSubmitting] = useState(false);

  function setField(key: keyof typeof EMPTY_ORG_FORM, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await platformFetch<{
        organization: { id: number; name: string };
        user: { id: number; email: string; created: boolean };
      }>("/platform/organizations", {
        method: "POST",
        body: JSON.stringify(form),
      });
      toast({
        title: `Organization "${result.organization.name}" created`,
        description: result.user.created
          ? `Owner account created for ${result.user.email}.`
          : `Existing user ${result.user.email} added as owner.`,
      });
      setForm(EMPTY_ORG_FORM);
      onCreated();
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to create organization",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[#1a2e4a]">Create Organization + Owner</CardTitle>
        <CardDescription>
          Creates a new organization and sets up an owner account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                required
                value={form.organizationName}
                onChange={(e) => setField("organizationName", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="owner-first">Owner First Name</Label>
              <Input
                id="owner-first"
                required
                value={form.ownerFirstName}
                onChange={(e) => setField("ownerFirstName", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="owner-last">Owner Last Name</Label>
              <Input
                id="owner-last"
                required
                value={form.ownerLastName}
                onChange={(e) => setField("ownerLastName", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="owner-email">Owner Email</Label>
              <Input
                id="owner-email"
                type="email"
                required
                value={form.ownerEmail}
                onChange={(e) => setField("ownerEmail", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="owner-password">Temporary Password</Label>
              <Input
                id="owner-password"
                type="password"
                required
                autoComplete="new-password"
                value={form.temporaryPassword}
                onChange={(e) => setField("temporaryPassword", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Select value={form.plan} onValueChange={(v) => setField("plan", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Subscription Status</Label>
              <Select
                value={form.subscriptionStatus}
                onValueChange={(v) => setField("subscriptionStatus", v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trialing">Trialing</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="past_due">Past Due</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="pt-2">
            <Button type="submit" disabled={submitting} className="gap-1.5">
              <Building2 className="w-4 h-4" />
              {submitting ? "Creating…" : "Create Organization"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Add User to Existing Org ─────────────────────────────────────────────────

const EMPTY_USER_FORM = {
  organizationId: "",
  firstName: "",
  lastName: "",
  email: "",
  temporaryPassword: "",
  role: "staff",
};

function AddUserSection({
  orgs,
  onCreated,
}: {
  orgs: PlatformOrg[];
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY_USER_FORM);
  const [submitting, setSubmitting] = useState(false);

  function setField(key: keyof typeof EMPTY_USER_FORM, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await platformFetch<{
        user: { id: number; email: string; created: boolean };
        membershipCreated: boolean;
      }>("/platform/users", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          organizationId: parseInt(form.organizationId, 10),
        }),
      });
      const selectedOrg = orgs.find((o) => o.id === parseInt(form.organizationId, 10));
      toast({
        title: `User added to ${selectedOrg?.name ?? "organization"}`,
        description: result.user.created
          ? `New account created for ${result.user.email}.`
          : result.membershipCreated
          ? `Existing user ${result.user.email} added.`
          : `${result.user.email} was already a member.`,
      });
      setForm(EMPTY_USER_FORM);
      onCreated();
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to add user",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[#1a2e4a]">Add User to Organization</CardTitle>
        <CardDescription>
          Creates a new user (or uses an existing one) and adds them to an organization.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Organization</Label>
              <Select
                value={form.organizationId}
                onValueChange={(v) => setField("organizationId", v)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an organization…" />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={String(o.id)}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-first">First Name</Label>
              <Input
                id="user-first"
                required
                value={form.firstName}
                onChange={(e) => setField("firstName", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-last">Last Name</Label>
              <Input
                id="user-last"
                required
                value={form.lastName}
                onChange={(e) => setField("lastName", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-password">Temporary Password</Label>
              <Input
                id="user-password"
                type="password"
                required
                autoComplete="new-password"
                value={form.temporaryPassword}
                onChange={(e) => setField("temporaryPassword", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setField("role", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="pt-2">
            <Button type="submit" disabled={submitting || !form.organizationId} className="gap-1.5">
              <Users className="w-4 h-4" />
              {submitting ? "Adding…" : "Add User"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Users Table ──────────────────────────────────────────────────────────────

function UsersSection({
  users,
  onRefresh,
}: {
  users: PlatformUser[];
  onRefresh: () => void;
}) {
  const [resetUser, setResetUser] = useState<PlatformUser | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-[#1a2e4a]">Users</CardTitle>
          <CardDescription>{users.length} user{users.length !== 1 ? "s" : ""}</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} className="gap-1.5 shrink-0">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {users.length === 0 ? (
          <p className="px-6 py-8 text-center text-muted-foreground text-sm">No users yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Organization</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Super Admin</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr
                    key={`${u.id}-${u.organizationId ?? "none"}`}
                    className={`border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`}
                  >
                    <td className="px-6 py-3 font-medium whitespace-nowrap">
                      {u.firstName} {u.lastName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.organizationName ?? <span className="italic text-muted-foreground/60">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {u.role ? (
                        <Badge className="capitalize bg-slate-100 text-slate-700 border-slate-200 border">
                          {u.role}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.isSuperAdmin ? (
                        <Badge className="bg-orange-100 text-orange-700 border-orange-200 border">Yes</Badge>
                      ) : (
                        <span className="text-muted-foreground/60">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 whitespace-nowrap"
                        onClick={() => setResetUser(u)}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Reset PW
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {resetUser && (
        <ResetPasswordDialog
          user={resetUser}
          open={true}
          onClose={() => setResetUser(null)}
        />
      )}
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlatformAdminPage() {
  const { user, logout } = useAuth();
  const [orgs, setOrgs] = useState<PlatformOrg[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [orgsError, setOrgsError] = useState<string | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchOrgs = useCallback(async () => {
    setLoadingOrgs(true);
    setOrgsError(null);
    try {
      const data = await platformFetch<PlatformOrg[]>("/platform/organizations");
      setOrgs(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load organizations";
      setOrgsError(msg);
    } finally {
      setLoadingOrgs(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    setUsersError(null);
    try {
      const data = await platformFetch<PlatformUser[]>("/platform/users");
      setUsers(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load users";
      setUsersError(msg);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrgs();
    void fetchUsers();
  }, [fetchOrgs, fetchUsers]);

  async function handleLogout() {
    await logout();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={appLogo}
              alt="Anchor Check-In"
              className="w-6 h-6 object-contain shrink-0"
            />
            <span className="font-serif font-bold text-base text-foreground whitespace-nowrap">
              Platform Admin
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button asChild variant="ghost" size="sm" className="px-2 sm:px-3 gap-1.5">
              <Link href="/events">
                <ArrowLeft className="w-4 h-4" />
                <span className="sr-only sm:not-sr-only">Back to Events</span>
              </Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="px-2 sm:px-3 gap-1.5"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
              <span className="sr-only sm:not-sr-only">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Page header */}
        <div>
          <h1 className="text-3xl font-serif font-bold text-[#1a2e4a]">Platform Admin</h1>
          <p className="text-muted-foreground mt-1">
            Manage organizations, users, and subscription access.
          </p>
          {user && (
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              Logged in as {user.firstName} {user.lastName} ({user.email})
            </p>
          )}
        </div>

        {/* Organizations */}
        {loadingOrgs ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              Loading organizations…
            </CardContent>
          </Card>
        ) : orgsError ? (
          <Card>
            <CardContent className="py-8 flex flex-col items-center gap-3 text-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Could not load organizations</p>
                <p className="text-sm text-muted-foreground mt-0.5">{orgsError}</p>
              </div>
              <Button variant="outline" size="sm" onClick={fetchOrgs} className="gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : (
          <OrganizationsSection orgs={orgs} onRefresh={fetchOrgs} />
        )}

        {/* Create Org + Owner */}
        <CreateOrgSection
          onCreated={() => {
            void fetchOrgs();
            void fetchUsers();
          }}
        />

        {/* Add User to Org */}
        <AddUserSection
          orgs={orgs}
          onCreated={() => {
            void fetchUsers();
          }}
        />

        {/* Users */}
        {loadingUsers ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              Loading users…
            </CardContent>
          </Card>
        ) : usersError ? (
          <Card>
            <CardContent className="py-8 flex flex-col items-center gap-3 text-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Could not load users</p>
                <p className="text-sm text-muted-foreground mt-0.5">{usersError}</p>
              </div>
              <Button variant="outline" size="sm" onClick={fetchUsers} className="gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : (
          <UsersSection users={users} onRefresh={fetchUsers} />
        )}
      </div>
    </div>
  );
}
