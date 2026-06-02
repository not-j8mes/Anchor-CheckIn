import { useState, useEffect } from "react";
import { useGetOrganization, useUpdateOrganization, useResetAllData } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { AlertTriangle, Trash2 } from "lucide-react";

export default function Settings() {
  const { data: org, isLoading } = useGetOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: "",
    headerText: "",
    primaryColor: "",
    logoUrl: "",
    address: "",
    phone: "",
    website: ""
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  useEffect(() => {
    if (org) {
      setFormData({
        name: org.name || "",
        headerText: org.headerText || "",
        primaryColor: org.primaryColor || "#1e3a8a",
        logoUrl: org.logoUrl || "",
        address: org.address || "",
        phone: org.phone || "",
        website: org.website || ""
      });
    }
  }, [org]);

  const updateOrg = useUpdateOrganization({
    mutation: {
      onSuccess: () => toast({ title: "Settings updated successfully" }),
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
      <div className="p-6 md:p-10 max-w-3xl mx-auto w-full">
        <div className="animate-pulse space-y-6">
          <div className="h-10 w-48 bg-muted rounded"></div>
          <div className="h-64 bg-muted/50 rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto w-full space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Organization Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your church identity and default styling</p>
      </div>

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
              <Label htmlFor="headerText">Form Header Text</Label>
              <Textarea
                id="headerText"
                value={formData.headerText}
                onChange={e => setFormData(p => ({ ...p, headerText: e.target.value }))}
                placeholder="Welcome to our children's ministry registration!"
                rows={2}
              />
              <p className="text-xs text-muted-foreground">Appears at the top of public registration forms.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Brand Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    id="primaryColor"
                    value={formData.primaryColor}
                    onChange={e => setFormData(p => ({ ...p, primaryColor: e.target.value }))}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={formData.primaryColor}
                    onChange={e => setFormData(p => ({ ...p, primaryColor: e.target.value }))}
                    className="flex-1 font-mono uppercase"
                  />
                </div>
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
  );
}
