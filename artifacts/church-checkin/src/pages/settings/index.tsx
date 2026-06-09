import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useGetOrganization, useUpdateOrganization, useResetAllData, getGetOrganizationQueryKey } from "@workspace/api-client-react";
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
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Church, Moon, Sun, Trash2 } from "lucide-react";
import { useDarkMode } from "@/hooks/use-dark-mode";

export default function Settings() {
  const { data: org, isLoading } = useGetOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: "",
    logoUrl: "",
    address: "",
    phone: "",
    website: ""
  });

  const { isDark, setIsDark } = useDarkMode();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  useEffect(() => {
    if (org) {
      setFormData({
        name: org.name || "",
        logoUrl: org.logoUrl || "",
        address: org.address || "",
        phone: org.phone || "",
        website: org.website || ""
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateOrg.mutate({ data: formData });
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
              <Church className="w-5 h-5 text-primary" />
              <span className="font-serif font-bold text-base">Church Check-In</span>
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
            <Church className="w-5 h-5 text-primary" />
            <span className="font-serif font-bold text-base">Church Check-In</span>
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

      <form onSubmit={handleSubmit}>
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
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                type="url"
                placeholder="https://example.com/logo.png"
                value={formData.logoUrl}
                onChange={e => setFormData(p => ({ ...p, logoUrl: e.target.value }))}
              />
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
          <CardFooter className="bg-muted/30 border-t border-border px-6 py-4">
            <Button type="submit" disabled={updateOrg.isPending} className="ml-auto">
              {updateOrg.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </CardFooter>
        </Card>
      </form>

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
