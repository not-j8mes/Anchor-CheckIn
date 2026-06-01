import { useState, useEffect, useRef } from "react";
import {
  useListChildren,
  useCreateCheckin,
  getListChildrenQueryKey,
  LabelData,
  Child,
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  AlertCircle,
  Users,
  UserCheck,
  Loader2,
  CheckCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LabelPrintDialog } from "@/components/checkin/LabelPrintDialog";

/** Group children by guardian name, returning an array of family groups */
function groupByFamily(children: Child[]): Array<{ guardian: string; children: Child[] }> {
  const map = new Map<string, Child[]>();
  for (const child of children) {
    const key = child.guardianName || "Unknown Guardian";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(child);
  }
  return Array.from(map.entries()).map(([guardian, children]) => ({ guardian, children }));
}

interface FamilyCardProps {
  guardian: string;
  children: Child[];
  onCheckinFamily: (selected: Child[]) => void;
  isLoading: boolean;
}

function FamilyCard({ guardian, children, onCheckinFamily, isLoading }: FamilyCardProps) {
  const [selected, setSelected] = useState<Set<number>>(
    new Set(children.map((c) => c.id))
  );

  const toggleChild = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === children.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(children.map((c) => c.id)));
    }
  };

  const selectedChildren = children.filter((c) => selected.has(c.id));
  const allChecked = selected.size === children.length;
  const noneChecked = selected.size === 0;

  return (
    <Card className="overflow-hidden border-primary/20 shadow-md" data-testid={`family-card-${guardian}`}>
      {/* Family header */}
      <div className="bg-primary/5 border-b border-primary/10 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="font-semibold text-foreground">{guardian}</span>
          <Badge variant="secondary" className="text-xs">
            {children.length} {children.length === 1 ? "child" : "children"}
          </Badge>
        </div>
        {children.length > 1 && (
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs text-primary hover:underline font-medium"
          >
            {allChecked ? "Deselect all" : "Select all"}
          </button>
        )}
      </div>

      {/* Children list */}
      <CardContent className="p-0 divide-y divide-border">
        {children.map((child) => {
          const isChecked = selected.has(child.id);
          return (
            <div
              key={child.id}
              className={`flex items-center gap-4 px-5 py-4 transition-colors cursor-pointer ${
                isChecked ? "bg-primary/5" : "hover:bg-muted/30"
              }`}
              onClick={() => toggleChild(child.id)}
              data-testid={`child-row-${child.id}`}
            >
              <Checkbox
                checked={isChecked}
                onCheckedChange={() => toggleChild(child.id)}
                className="pointer-events-none"
                data-testid={`checkbox-child-${child.id}`}
              />
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-serif font-bold text-primary text-sm flex-shrink-0">
                {child.firstName[0]}{child.lastName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-base">
                  {child.firstName} {child.lastName}
                </div>
                <div className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
                  {child.room && <span>{child.room}</span>}
                  {(child.allergies || child.specialNeeds) && (
                    <span className="flex items-center gap-1 text-amber-600 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Medical notes
                    </span>
                  )}
                </div>
              </div>
              {isChecked && (
                <UserCheck className="w-4 h-4 text-primary flex-shrink-0" />
              )}
            </div>
          );
        })}
      </CardContent>

      {/* Check-in button */}
      <div className="px-5 py-4 border-t border-border bg-background">
        <Button
          className="w-full h-12 text-base font-bold gap-2"
          disabled={noneChecked || isLoading}
          onClick={() => onCheckinFamily(selectedChildren)}
          data-testid={`button-checkin-family-${guardian}`}
        >
          {isLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Checking in...</>
          ) : (
            <><CheckCheck className="w-5 h-5" />
              Check In {selectedChildren.length > 1
                ? `${selectedChildren.length} Children`
                : selectedChildren[0]?.firstName || "Child"}
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}

export default function CheckinKiosk() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const childrenParams = { search: debouncedSearch || undefined };
  const { data: children, isLoading: searching } = useListChildren(
    childrenParams,
    { query: { enabled: debouncedSearch.length > 1, queryKey: getListChildrenQueryKey(childrenParams) } }
  );

  const { toast } = useToast();
  const [collectedLabels, setCollectedLabels] = useState<LabelData[]>([]);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [checkingInGuardian, setCheckingInGuardian] = useState<string | null>(null);

  const createCheckin = useCreateCheckin();

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const handleCheckinFamily = async (familyGuardian: string, selectedChildren: Child[]) => {
    setCheckingInGuardian(familyGuardian);
    const labels: LabelData[] = [];

    try {
      for (const child of selectedChildren) {
        const result = await createCheckin.mutateAsync({
          data: {
            registrationId: child.registrationId ?? child.id,
            room: child.room || undefined,
          },
        });
        labels.push(result.labelData);
      }

      setCollectedLabels(labels);
      setPrintDialogOpen(true);
      setSearch("");
      setDebouncedSearch("");

      toast({
        title: labels.length > 1
          ? `${labels.length} children checked in for ${familyGuardian}`
          : `${selectedChildren[0]?.firstName} checked in successfully!`,
      });
    } catch {
      toast({ title: "Check-in failed — please try again.", variant: "destructive" });
    } finally {
      setCheckingInGuardian(null);
    }
  };

  const families = children ? groupByFamily(children) : [];
  const showResults = debouncedSearch.length > 1;

  return (
    <div className="flex flex-col min-h-screen bg-muted/30">
      {/* Header */}
      <div className="text-center pt-12 pb-6 px-4">
        <h1 className="text-5xl font-serif font-bold text-primary">Welcome!</h1>
        <p className="text-xl text-muted-foreground mt-2">
          Search by child name, guardian name, or phone number.
        </p>
      </div>

      {/* Search bar */}
      <div className="px-4 md:px-8 max-w-4xl mx-auto w-full">
        <Card className="shadow-md overflow-hidden">
          <CardContent className="p-2">
            <div className="relative">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-8 h-8 text-muted-foreground pointer-events-none" />
              <Input
                ref={inputRef}
                autoFocus
                placeholder="Type family name or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-20 text-3xl h-24 rounded-lg bg-muted/20 border-transparent focus-visible:ring-primary font-serif placeholder:text-muted-foreground/50"
                data-testid="input-checkin-search"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(""); setDebouncedSearch(""); }}
                  className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors text-2xl font-light"
                >
                  ×
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      <div className="px-4 md:px-8 max-w-4xl mx-auto w-full mt-6 pb-12">
        {showResults && (
          <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
            {searching ? (
              <div className="flex items-center justify-center py-16 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-lg text-muted-foreground">Searching...</span>
              </div>
            ) : families.length === 0 ? (
              <Card className="shadow-sm">
                <CardContent className="py-16 text-center">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
                  <p className="text-2xl text-muted-foreground font-serif mb-2">
                    No matches for "{debouncedSearch}"
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Try a different name, or register the family first.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {families.length > 0 && (
                  <p className="text-sm text-muted-foreground font-medium px-1">
                    {families.length === 1
                      ? `1 family found · ${children?.length} ${children?.length === 1 ? "child" : "children"}`
                      : `${families.length} families found · ${children?.length} children total`}
                  </p>
                )}
                {families.map((family) => (
                  <FamilyCard
                    key={family.guardian}
                    guardian={family.guardian}
                    children={family.children}
                    onCheckinFamily={(selected) => handleCheckinFamily(family.guardian, selected)}
                    isLoading={checkingInGuardian === family.guardian}
                  />
                ))}
              </>
            )}
          </div>
        )}

        {/* Empty prompt */}
        {!showResults && (
          <div className="text-center pt-16 text-muted-foreground opacity-50">
            <Search className="w-16 h-16 mx-auto mb-4" />
            <p className="text-xl font-serif">Start typing to find a family</p>
          </div>
        )}
      </div>

      <LabelPrintDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        labels={collectedLabels}
      />
    </div>
  );
}
