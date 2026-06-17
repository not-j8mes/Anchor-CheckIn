import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import {
  useGetOrganization,
  useUpdateOrganization,
  useResetAllData,
  useSeedTestData,
  useListEventCategories,
  useCreateEventCategory,
  useUpdateEventCategory,
  useDeleteEventCategory,
  getGetOrganizationQueryKey,
  getListEventsQueryKey,
  getGetDashboardStatsQueryKey,
  getListEventCategoriesQueryKey,
  type EventCategory,
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Database, Moon, Sun, Trash2, Tag, Plus, Pencil, Check, X, Upload } from "lucide-react";
import appLogo from "@assets/ChatGPT_Image_Jun_10,_2026,_01_32_42_PM_1781112954294.png";
import { useDarkMode } from "@/hooks/use-dark-mode";

const DEFAULT_ORGANIZATION_NAME = "Anchor Events - Check In and Registration";
const MAX_LOGO_UPLOAD_BYTES = 1.5 * 1024 * 1024;
const ACCEPTED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

// ─── Event Categories Card ────────────────────────────────────────────────────

function EventCategoriesCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: categories = [], isLoading } = useListEventCategories();

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<EventCategory | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListEventCategoriesQueryKey() });

  const createCategory = useCreateEventCategory({
    mutation: {
      onSuccess: () => { invalidate(); setNewName(""); toast({ title: "Category created" }); },
      onError: (err: unknown) => {
        const msg = err instanceof Error && err.message.includes("409") ? "That name is already taken" : "Failed to create category";
        toast({ title: msg, variant: "destructive" });
      },
    },
  });

  const updateCategory = useUpdateEventCategory({
    mutation: {
      onSuccess: () => { invalidate(); setEditingId(null); toast({ title: "Category renamed" }); },
      onError: (err: unknown) => {
        const msg = err instanceof Error && err.message.includes("409") ? "That name is already taken" : "Failed to rename category";
        toast({ title: msg, variant: "destructive" });
      },
    },
  });

  const deleteCategory = useDeleteEventCategory({
    mutation: {
      onSuccess: () => { invalidate(); setDeleteTarget(null); toast({ title: "Category deleted, events reassigned" }); },
      onError: () => toast({ title: "Failed to delete category", variant: "destructive" }),
    },
  });

  const startEdit = (cat: EventCategory) => {
    setEditingId(cat.id);
    setEditName(cat.name);
  };

  const cancelEdit = () => { setEditingId(null); setEditName(""); };

  const saveEdit = (id: number) => {
    if (!editName.trim()) return;
    updateCategory.mutate({ categoryId: id, data: { name: editName.trim() } });
  };

  return (
    <>
      <Card className="border-card-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-primary" /> Event Categories
          </CardTitle>
          <CardDescription>
            Manage the categories used to organise events. "General / Other" is the built-in default and cannot be deleted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="animate-pulse space-y-2">
              {[1, 2].map((i) => <div key={i} className="h-9 bg-muted rounded" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center gap-2">
                  {editingId === cat.id ? (
                    <>
                      <Input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 h-8 text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(cat.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-green-600 hover:text-green-700"
                        onClick={() => saveEdit(cat.id)}
                        disabled={!editName.trim() || updateCategory.isPending}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEdit}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm py-1.5 px-2 rounded border border-border bg-background">
                        {cat.name}
                        {cat.isDefault && (
                          <span className="ml-2 text-xs text-muted-foreground">(default)</span>
                        )}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => startEdit(cat)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive/60 hover:text-destructive"
                        disabled={cat.isDefault}
                        onClick={() => setDeleteTarget(cat)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1 border-t border-border">
            <Input
              placeholder="e.g. Kids Program"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) {
                  createCategory.mutate({ data: { name: newName.trim() } });
                }
              }}
            />
            <Button
              size="sm"
              onClick={() => createCategory.mutate({ data: { name: newName.trim() } })}
              disabled={!newName.trim() || createCategory.isPending}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              {createCategory.isPending ? "Adding…" : "Add"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Any events using this category will be reassigned to "General / Other". This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteCategory.mutate({ categoryId: deleteTarget.id })}
              disabled={deleteCategory.isPending}
            >
              {deleteCategory.isPending ? "Deleting…" : "Delete & Reassign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Settings page ────────────────────────────────────────────────────────────

export default function Settings() {
  const { data: org, isLoading } = useGetOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: "",
    logoUrl: "",
    address: "",
    phone: "",
    website: "",
  });

  const { isDark, setIsDark } = useDarkMode();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const brandLogo = formData.logoUrl || org?.logoUrl || appLogo;
  const brandName = formData.name || org?.name || DEFAULT_ORGANIZATION_NAME;

  useEffect(() => {
    if (org) {
      setFormData({
        name: org.name || "",
        logoUrl: org.logoUrl || "",
        address: org.address || "",
        phone: org.phone || "",
        website: org.website || "",
      });
    }
  }, [org]);

  const updateOrg = useUpdateOrganization({
    mutation: {
      onSuccess: (updatedOrg) => {
        queryClient.setQueryData(getGetOrganizationQueryKey(), updatedOrg);
        toast({ title: "Settings updated successfully" });
      },
      onError: () => toast({ title: "Failed to update settings", variant: "destructive" }),
    }
  });

  const resetAllData = useResetAllData({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries();
        setDeleteDialogOpen(false);
        setDeleteConfirmText("");
        toast({ title: "All data deleted successfully." });
      },
      onError: () => toast({ title: "Failed to delete data — please try again.", variant: "destructive" }),
    }
  });

  const seedTestData = useSeedTestData({
    mutation: {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        toast({
          title: "Test data added",
          description: `${result.eventsCreated} events and ${result.registrationsCreated} registrations were created.`,
        });
      },
      onError: () => toast({ title: "Failed to add test data", variant: "destructive" }),
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateOrg.mutate({ data: formData });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
      toast({ title: "Please upload a PNG, JPG, WebP, or GIF logo.", variant: "destructive" });
      e.target.value = "";
      return;
    }

    if (file.size > MAX_LOGO_UPLOAD_BYTES) {
      toast({ title: "Logo must be smaller than 1.5 MB.", variant: "destructive" });
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setFormData((p) => ({ ...p, logoUrl: result }));
      }
    };
    reader.onerror = () => {
      toast({ title: "Could not read that logo file.", variant: "destructive" });
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setFormData((p) => ({ ...p, logoUrl: "" }));
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const handleDeleteAll = () => {
    resetAllData.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-4">
            <div className="flex items-center gap-2 text-foreground">
              <img src={appLogo} alt={`${DEFAULT_ORGANIZATION_NAME} logo`} className="w-6 h-6 object-contain" />
              <span className="font-serif font-bold text-base">{DEFAULT_ORGANIZATION_NAME}</span>
            </div>
          </div>
        </header>
        <div className="max-w-3xl mx-auto px-6 py-10">
          <div className="animate-pulse space-y-6">
            <div className="h-10 w-48 bg-muted rounded"></div>
            <div className="h-64 bg-muted/50 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-foreground">
            <img src={brandLogo} alt={`${brandName} logo`} className="w-6 h-6 object-contain" />
            <span className="font-serif font-bold text-base">{brandName}</span>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/events">
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
            </Link>
          </Button>
        </div>
      </header>

    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Organization Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your church identity and default styling</p>
      </div>

      <Card className="border-card-border shadow-sm">
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize how the application looks for you.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isDark ? <Moon className="w-5 h-5 text-muted-foreground" /> : <Sun className="w-5 h-5 text-muted-foreground" />}
              <div>
                <p className="font-medium text-sm">Dark Mode</p>
                <p className="text-xs text-muted-foreground">Switch between light and dark theme</p>
              </div>
            </div>
            <Switch
              checked={isDark}
              onCheckedChange={setIsDark}
              aria-label="Toggle dark mode"
            />
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="border-card-border shadow-sm">
          <CardHeader>
            <CardTitle>Branding</CardTitle>
            <CardDescription>
              These details appear on your public registration forms.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                value={formData.name}
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="logoUpload">Logo</Label>
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                    {formData.logoUrl ? (
                      <img
                        src={formData.logoUrl}
                        alt="Organization logo preview"
                        className="max-h-12 max-w-12 object-contain"
                      />
                    ) : (
                      <Upload className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {formData.logoUrl ? "Logo selected" : "Upload your organization logo"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG, WebP, or GIF. Max 1.5 MB.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    ref={logoInputRef}
                    id="logoUpload"
                    type="file"
                    accept={ACCEPTED_LOGO_TYPES.join(",")}
                    onChange={handleLogoUpload}
                    className="sr-only"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => logoInputRef.current?.click()}
                    className="gap-1.5"
                  >
                    <Upload className="h-4 w-4" />
                    {formData.logoUrl ? "Change" : "Upload"}
                  </Button>
                  {formData.logoUrl && (
                    <Button type="button" variant="ghost" onClick={removeLogo} className="gap-1.5">
                      <X className="h-4 w-4" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <h3 className="font-medium text-lg mb-4">Contact Info</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={e => setFormData(p => ({ ...p, address: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      type="url"
                      value={formData.website}
                      onChange={e => setFormData(p => ({ ...p, website: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-end border-t border-border pt-4">
            <Button type="submit" disabled={updateOrg.isPending}>
              {updateOrg.isPending ? "Saving..." : "Save Branding"}
            </Button>
          </CardFooter>
        </Card>
      </form>

      {/* Event Categories */}
      <EventCategoriesCard />

      <Card className="border-card-border shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            <CardTitle>Test Data</CardTitle>
          </div>
          <CardDescription>
            Create demo events and registrations for trying out check-in, rooms, labels, and family registrations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/30 p-4">
            <div>
              <p className="font-medium text-sm">Add Test Data</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Adds one child check-in event, one family/group event, and one individual event dated for next week.
              </p>
            </div>
            <Button
              size="sm"
              className="flex-shrink-0 gap-1.5"
              onClick={() => seedTestData.mutate()}
              disabled={seedTestData.isPending}
            >
              <Database className="w-4 h-4" />
              {seedTestData.isPending ? "Adding..." : "Add Test Data"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/40 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
          </div>
          <CardDescription>
            These actions are permanent and cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div>
              <p className="font-medium text-sm">Delete All Data</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Permanently removes all events, forms, registrations, check-ins, and children from the system.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="flex-shrink-0 gap-1.5"
              onClick={() => { setDeleteConfirmText(""); setDeleteDialogOpen(true); }}
            >
              <Trash2 className="w-4 h-4" />
              Delete All Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) setDeleteConfirmText(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <DialogTitle className="text-destructive">Delete All Data?</DialogTitle>
            </div>
            <DialogDescription className="space-y-2 pt-1">
              <span className="block">This will permanently delete:</span>
              <ul className="list-disc list-inside text-sm space-y-1 pl-1">
                <li>All events</li>
                <li>All registration forms and questions</li>
                <li>All child registrations</li>
                <li>All check-in and check-out records</li>
              </ul>
              <span className="block pt-1 font-medium text-foreground">This cannot be undone.</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="delete-confirm" className="text-sm">
              Type <span className="font-mono font-bold text-destructive">DELETE</span> to confirm
            </Label>
            <Input
              id="delete-confirm"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
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
              disabled={deleteConfirmText !== "DELETE" || resetAllData.isPending}
              onClick={handleDeleteAll}
              className="gap-1.5"
            >
              {resetAllData.isPending ? (
                "Deleting..."
              ) : (
                <><Trash2 className="w-4 h-4" /> Delete Everything</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </div>
  );
}
