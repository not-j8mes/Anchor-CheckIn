import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListForms, useCreateForm, getListFormsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardList, Plus, Settings, Users, Code, Activity, Globe } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function FormsList() {
  const { data: forms, isLoading } = useListForms();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createForm = useCreateForm({
    mutation: {
      onSuccess: (newForm) => {
        setIsCreateOpen(false);
        queryClient.invalidateQueries({ queryKey: getListFormsQueryKey() });
        toast({ title: "Form created successfully" });
        setLocation(`/forms/${newForm.id}/builder`);
      },
      onError: () => {
        toast({ title: "Failed to create form", variant: "destructive" });
      }
    }
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createForm.mutate({ data: { title, description, isActive: true, isPublic: true } });
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Forms</h1>
          <p className="text-muted-foreground mt-1">Manage registration and event forms</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              Create Form
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Create New Form</DialogTitle>
                <DialogDescription>
                  Start a new registration form for Sunday school, VBS, or an event.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Form Title</Label>
                  <Input 
                    id="title" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)} 
                    placeholder="e.g. Vacation Bible School 2024"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea 
                    id="description" 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide some details about this registration..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createForm.isPending}>
                  {createForm.isPending ? "Creating..." : "Create Form"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-24 bg-muted/50 rounded-t-lg"></CardHeader>
              <CardContent className="h-32"></CardContent>
            </Card>
          ))}
        </div>
      ) : forms && forms.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {forms.map((form) => (
            <Card key={form.id} className="flex flex-col h-full hover-elevate transition-all border-card-border overflow-hidden group">
              <CardHeader className="bg-card pb-4 border-b border-border/50 relative">
                <div className="flex justify-between items-start gap-4">
                  <CardTitle className="text-xl font-serif leading-tight">
                    {form.title}
                  </CardTitle>
                </div>
                <CardDescription className="line-clamp-2 mt-2">
                  {form.description || "No description provided."}
                </CardDescription>
                <div className="flex gap-2 mt-4">
                  <Badge variant={form.isActive ? "default" : "secondary"} className={form.isActive ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}>
                    {form.isActive ? "Active" : "Inactive"}
                  </Badge>
                  {form.isPublic && (
                    <Badge variant="outline" className="text-muted-foreground">
                      <Globe className="w-3 h-3 mr-1" /> Public
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="py-4 flex-1">
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="font-medium text-foreground">{form.submissionCount || 0}</span>
                    <span>Registrations</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="p-0 border-t border-border/50 grid grid-cols-3 bg-muted/20">
                <Link href={`/forms/${form.id}/builder`} className="flex flex-col items-center justify-center p-3 text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors">
                  <Settings className="w-4 h-4 mb-1" />
                  Builder
                </Link>
                <Link href={`/forms/${form.id}/registrations`} className="flex flex-col items-center justify-center p-3 text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 border-l border-r border-border/50 transition-colors">
                  <ClipboardList className="w-4 h-4 mb-1" />
                  Entries
                </Link>
                <Link href={`/forms/${form.id}/embed`} className="flex flex-col items-center justify-center p-3 text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors">
                  <Code className="w-4 h-4 mb-1" />
                  Embed
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState 
          title="No forms created yet"
          description="Create your first form to start collecting registrations for Sunday school, VBS, or other children's events."
          icon={<ClipboardList className="w-8 h-8" />}
          action={
            <Button onClick={() => setIsCreateOpen(true)} className="mt-2">
              <Plus className="w-4 h-4 mr-2" />
              Create First Form
            </Button>
          }
        />
      )}
    </div>
  );
}
