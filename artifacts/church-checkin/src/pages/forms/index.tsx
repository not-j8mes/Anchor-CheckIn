import { Link } from "wouter";
import { useListForms } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ClipboardList, Settings, Users, Code, Globe, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function FormsList() {
  const { data: forms, isLoading } = useListForms();

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Forms</h1>
          <p className="text-muted-foreground mt-1">
            Registration forms are created automatically when you create a new event.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/events">
            <Calendar className="w-4 h-4 mr-2" /> Go to Events
          </Link>
        </Button>
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
        <Card className="border-dashed">
          <CardContent className="py-20 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <ClipboardList className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-serif font-bold">No forms yet</h3>
              <p className="text-muted-foreground mt-1 max-w-sm">
                Forms are created automatically when you create an event. Head to Events to get started.
              </p>
            </div>
            <Button asChild>
              <Link href="/events">Go to Events</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
