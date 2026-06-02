import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import {
  useListChildren,
  useBatchCheckin,
  useCheckoutChild,
  useDeleteCheckin,
  getListChildrenQueryKey,
  LabelData,
  Child,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
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
  LogOut,
  Undo2,
  LayoutDashboard,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LabelPrintDialog } from "@/components/checkin/LabelPrintDialog";

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
  onCheckoutChild: (child: Child) => void;
  onUndoCheckin: (child: Child) => void;
  isCheckingIn: boolean;
  loadingCheckinId: number | null;
}

function FamilyCard({
  guardian,
  children,
  onCheckinFamily,
  onCheckoutChild,
  onUndoCheckin,
  isCheckingIn,
  loadingCheckinId,
}: FamilyCardProps) {
  const notCheckedIn = children.filter((c) => !c.isCheckedIn);
  const alreadyCheckedIn = children.filter((c) => c.isCheckedIn);

  const [selected, setSelected] = useState<Set<number>>(
    new Set(notCheckedIn.map((c) => c.id))
  );

  const toggleChild = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(
      selected.size === notCheckedIn.length
        ? new Set()
        : new Set(notCheckedIn.map((c) => c.id))
    );

  const selectedChildren = notCheckedIn.filter((c) => selected.has(c.id));

  return (
    <Card className="overflow-hidden border-primary/20 shadow-md" data-testid={`family-card-${guardian}`}>
      <div className="bg-primary/5 border-b border-primary/10 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="font-semibold text-foreground">{guardian}</span>
          <Badge variant="secondary" className="text-xs">
            {children.length} {children.length === 1 ? "child" : "children"}
          </Badge>
        </div>
        {notCheckedIn.length > 1 && (
          <button type="button" onClick={toggleAll} className="text-xs text-primary hover:underline font-medium">
            {selected.size === notCheckedIn.length ? "Deselect all" : "Select all"}
          </button>
        )}
      </div>

      <CardContent className="p-0 divide-y divide-border">
        {alreadyCheckedIn.map((child) => (
          <div key={child.id} className="flex items-center gap-4 px-5 py-4 bg-green-50/50" data-testid={`child-row-${child.id}`}>
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center font-serif font-bold text-green-700 text-sm flex-shrink-0">
              {child.firstName[0]}{child.lastName[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-base flex items-center gap-2 flex-wrap">
                {child.firstName} {child.lastName}
                <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Checked In</Badge>
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
                {child.room && <span>{child.room}</span>}
                {child.activeCheckinLabelCode && (
                  <span className="font-mono font-bold text-green-700">Code: {child.activeCheckinLabelCode}</span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="text-muted-foreground hover:text-destructive hover:border-destructive gap-1"
                disabled={loadingCheckinId === child.checkinId}
                onClick={() => onCheckoutChild(child)}
                data-testid={`button-checkout-${child.id}`}
              >
                {loadingCheckinId === child.checkinId ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <LogOut className="w-3.5 h-3.5" />
                )}
                Check Out
              </Button>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                onClick={() => onUndoCheckin(child)}
                data-testid={`button-undo-checkin-${child.id}`}
              >
                <Undo2 className="w-3 h-3" /> Undo check-in
              </button>
            </div>
          </div>
        ))}

        {notCheckedIn.map((child) => {
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
                <div className="font-semibold text-base">{child.firstName} {child.lastName}</div>
                <div className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
                  {child.room && <span>{child.room}</span>}
                  {(child.allergies || child.specialNeeds) && (
                    <span className="flex items-center gap-1 text-amber-600 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" /> Medical notes
                    </span>
                  )}
                </div>
              </div>
              {isChecked && <UserCheck className="w-4 h-4 text-primary flex-shrink-0" />}
            </div>
          );
        })}
      </CardContent>

      {notCheckedIn.length > 0 && (
        <div className="px-5 py-4 border-t border-border bg-background">
          <Button
            className="w-full h-12 text-base font-bold gap-2"
            disabled={selectedChildren.length === 0 || isCheckingIn}
            onClick={() => onCheckinFamily(selectedChildren)}
            data-testid={`button-checkin-family-${guardian}`}
          >
            {isCheckingIn ? (
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
      )}
    </Card>
  );
}

export default function CheckinKiosk() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const childrenParams = { search: debouncedSearch || undefined };
  const { data: children, isLoading: searching } = useListChildren(
    childrenParams,
    { query: { enabled: debouncedSearch.length > 1, queryKey: getListChildrenQueryKey(childrenParams) } }
  );

  const { toast } = useToast();
  const [collectedLabels, setCollectedLabels] = useState<LabelData[]>([]);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [checkingInGuardian, setCheckingInGuardian] = useState<string | null>(null);
  const [loadingCheckinId, setLoadingCheckinId] = useState<number | null>(null);

  const batchCheckin = useBatchCheckin();
  const checkoutChild = useCheckoutChild();
  const deleteCheckin = useDeleteCheckin();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const refreshResults = () =>
    queryClient.invalidateQueries({ queryKey: getListChildrenQueryKey(childrenParams) });

  const handleCheckinFamily = async (familyGuardian: string, selectedChildren: Child[]) => {
    if (selectedChildren.length === 0) return;
    setCheckingInGuardian(familyGuardian);
    try {
      const result = await batchCheckin.mutateAsync({
        data: {
          items: selectedChildren.map((c) => ({
            registrationId: c.registrationId ?? c.id,
            room: c.room ?? undefined,
          })),
        },
      });
      setCollectedLabels(result.labels as LabelData[]);
      setPrintDialogOpen(true);
      setSearch("");
      setDebouncedSearch("");
      toast({
        title: result.labels.length > 1
          ? `${result.labels.length} children checked in for ${familyGuardian}`
          : `${selectedChildren[0]?.firstName} checked in!`,
      });
    } catch {
      toast({ title: "Check-in failed — please try again.", variant: "destructive" });
    } finally {
      setCheckingInGuardian(null);
    }
  };

  const handleCheckoutChild = async (child: Child) => {
    if (!child.checkinId) return;
    setLoadingCheckinId(child.checkinId);
    try {
      await checkoutChild.mutateAsync({ checkinId: child.checkinId });
      toast({ title: `${child.firstName} checked out.` });
      refreshResults();
    } catch {
      toast({ title: "Check-out failed — please try again.", variant: "destructive" });
    } finally {
      setLoadingCheckinId(null);
    }
  };

  const handleUndoCheckin = async (child: Child) => {
    if (!child.checkinId) return;
    setLoadingCheckinId(child.checkinId);
    try {
      await deleteCheckin.mutateAsync({ checkinId: child.checkinId });
      toast({ title: `Check-in for ${child.firstName} removed.` });
      refreshResults();
    } catch {
      toast({ title: "Could not undo check-in.", variant: "destructive" });
    } finally {
      setLoadingCheckinId(null);
    }
  };

  const families = children ? groupByFamily(children) : [];
  const showResults = debouncedSearch.length > 1;

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-muted/30">
      {/* Top bar with back button */}
      <div className="flex items-center justify-between px-6 py-3 bg-background border-b border-border shadow-sm">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Button>
        </Link>
        <span className="text-sm font-medium text-muted-foreground">Check-In Kiosk</span>
        <div className="w-28" />
      </div>

      {/* Main centered content */}
      <div className="flex flex-col flex-1 items-center w-full">
        <div className="text-center pt-10 pb-6 px-4">
          <h1 className="text-5xl font-serif font-bold text-primary">Welcome!</h1>
          <p className="text-xl text-muted-foreground mt-2">
            Search by child name, guardian name, or phone number.
          </p>
        </div>

        <div className="px-4 md:px-8 w-full max-w-2xl">
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

        <div className="px-4 md:px-8 w-full max-w-2xl mt-6 pb-12">
          {showResults ? (
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
                  <p className="text-sm text-muted-foreground font-medium px-1">
                    {families.length === 1
                      ? `1 family found · ${children?.length} ${children?.length === 1 ? "child" : "children"}`
                      : `${families.length} families found · ${children?.length} children total`}
                  </p>
                  {families.map((family) => (
                    <FamilyCard
                      key={family.guardian}
                      guardian={family.guardian}
                      children={family.children}
                      onCheckinFamily={(selected) => handleCheckinFamily(family.guardian, selected)}
                      onCheckoutChild={handleCheckoutChild}
                      onUndoCheckin={handleUndoCheckin}
                      isCheckingIn={checkingInGuardian === family.guardian}
                      loadingCheckinId={loadingCheckinId}
                    />
                  ))}
                </>
              )}
            </div>
          ) : (
            <div className="text-center pt-16 text-muted-foreground opacity-50">
              <Search className="w-16 h-16 mx-auto mb-4" />
              <p className="text-xl font-serif">Start typing to find a family</p>
            </div>
          )}
        </div>
      </div>

      <LabelPrintDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        labels={collectedLabels}
      />
    </div>
  );
}
