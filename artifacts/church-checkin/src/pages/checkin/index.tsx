import { useState } from "react";
import { useListChildren, useCreateCheckin, LabelData } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, UserCheck, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LabelPrintDialog } from "@/components/checkin/LabelPrintDialog";
import { format } from "date-fns";

export default function CheckinKiosk() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { data: children, isLoading } = useListChildren({ search: debouncedSearch || undefined });
  const { toast } = useToast();
  
  const [labelData, setLabelData] = useState<LabelData | null>(null);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);

  // Debounce search
  useState(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  });

  const createCheckin = useCreateCheckin({
    mutation: {
      onSuccess: (data) => {
        setLabelData(data.labelData);
        setPrintDialogOpen(true);
        toast({ title: `${data.checkin.childFirstName} checked in successfully!` });
        setSearch("");
      },
      onError: () => {
        toast({ title: "Check-in failed", variant: "destructive" });
      }
    }
  });

  const handleCheckin = (childId: number, registrationId?: number, room?: string | null) => {
    if (!registrationId) {
      toast({ title: "Cannot check in - Missing registration data", variant: "destructive" });
      return;
    }
    createCheckin.mutate({ 
      data: { 
        registrationId, 
        room: room || undefined 
      } 
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="max-w-4xl mx-auto w-full space-y-8 mt-12">
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-serif font-bold text-primary">Welcome!</h1>
          <p className="text-xl text-muted-foreground">Search by child or guardian name to check in.</p>
        </div>

        <Card className="border-card-border shadow-md overflow-hidden">
          <CardContent className="p-2 sm:p-4 bg-card">
            <div className="relative">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-8 h-8 text-muted-foreground" />
              <Input 
                autoFocus
                placeholder="Type name here..." 
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setDebouncedSearch(e.target.value);
                }}
                className="pl-20 text-3xl h-24 rounded-lg bg-muted/20 border-transparent focus-visible:ring-primary font-serif placeholder:text-muted-foreground/50"
              />
            </div>
          </CardContent>
        </Card>

        {debouncedSearch.length > 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 animate-in slide-in-from-bottom-4 duration-300">
            {isLoading ? (
              [1, 2, 3, 4].map(i => (
                <Card key={i} className="animate-pulse h-32"></Card>
              ))
            ) : children && children.length > 0 ? (
              children.map(child => (
                <Card key={child.id} className="overflow-hidden border-primary/20 hover:border-primary transition-colors cursor-pointer group hover-elevate" onClick={() => handleCheckin(child.id, child.registrationId, child.room)}>
                  <CardContent className="p-0 flex h-full">
                    <div className="bg-primary/5 w-24 flex items-center justify-center border-r border-border group-hover:bg-primary/10 transition-colors">
                      <div className="w-16 h-16 rounded-full bg-background flex items-center justify-center text-primary font-serif font-bold text-xl shadow-sm">
                        {child.firstName[0]}{child.lastName[0]}
                      </div>
                    </div>
                    <div className="p-5 flex-1 flex flex-col justify-center">
                      <h3 className="text-xl font-serif font-bold leading-none mb-2">{child.firstName} {child.lastName}</h3>
                      <div className="text-sm text-muted-foreground flex justify-between">
                        <span>Guardian: {child.guardianName}</span>
                        <span className="font-medium text-foreground">{child.room || "No Room"}</span>
                      </div>
                      {(child.allergies || child.specialNeeds) && (
                        <div className="flex items-center gap-1 mt-2 text-xs font-medium text-amber-600">
                          <AlertCircle className="w-3 h-3" /> Important notes
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-1 md:col-span-2 text-center py-12">
                <p className="text-2xl text-muted-foreground font-serif">No matches found for "{debouncedSearch}"</p>
                <p className="text-muted-foreground mt-2">Check the spelling or register as a new family.</p>
              </div>
            )}
          </div>
        )}

      </div>

      <LabelPrintDialog 
        open={printDialogOpen} 
        onOpenChange={setPrintDialogOpen} 
        labelData={labelData} 
      />
    </div>
  );
}
