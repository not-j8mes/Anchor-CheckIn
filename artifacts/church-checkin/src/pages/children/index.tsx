import { useState } from "react";
import { useListChildren } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Phone, User, Calendar } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { format } from "date-fns";

export default function ChildrenDirectory() {
  const [search, setSearch] = useState("");
  // Pass undefined if search is empty to avoid sending empty string to API
  const { data: children, isLoading } = useListChildren({ search: search || undefined });

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
              <CardHeader className="h-20 bg-muted/50 rounded-t-lg border-b border-border/50"></CardHeader>
              <CardContent className="h-32"></CardContent>
            </Card>
          ))}
        </div>
      ) : children && children.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {children.map((child) => (
            <Card key={child.id} className="hover-elevate transition-all border-card-border overflow-hidden">
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
    </div>
  );
}
