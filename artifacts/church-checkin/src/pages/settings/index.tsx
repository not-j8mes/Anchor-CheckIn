import { useState, useEffect } from "react";
import { useGetOrganization, useUpdateOrganization } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { data: org, isLoading } = useGetOrganization();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    name: "",
    headerText: "",
    primaryColor: "",
    logoUrl: "",
    address: "",
    phone: "",
    website: ""
  });

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
      onSuccess: () => {
        toast({ title: "Settings updated successfully" });
      },
      onError: () => {
        toast({ title: "Failed to update settings", variant: "destructive" });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateOrg.mutate({ data: formData });
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
    </div>
  );
}
