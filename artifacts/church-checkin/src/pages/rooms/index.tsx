import { useState } from "react";
import {
  useListRooms,
  useCreateRoom,
  useUpdateRoom,
  useDeleteRoom,
  getListRoomsQueryKey,
  type Room,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { DoorOpen, Plus, Pencil, Trash2, Loader2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/ui/empty-state";

interface RoomFormDialogProps {
  room?: Room;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function RoomFormDialog({ room, open, onOpenChange }: RoomFormDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!room;

  const [name, setName] = useState(room?.name ?? "");
  const [capacity, setCapacity] = useState(room?.capacity != null ? String(room.capacity) : "");

  const createRoom = useCreateRoom({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey() });
        toast({ title: "Room created" });
        onOpenChange(false);
      },
      onError: () => toast({ title: "Failed to create room", variant: "destructive" }),
    },
  });
  const updateRoom = useUpdateRoom({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey() });
        toast({ title: "Room updated" });
        onOpenChange(false);
      },
      onError: () => toast({ title: "Failed to update room", variant: "destructive" }),
    },
  });

  const isPending = createRoom.isPending || updateRoom.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const cap = capacity ? parseInt(capacity, 10) : undefined;
    if (isEdit) {
      updateRoom.mutate({ roomId: room!.id, data: { name: name.trim(), capacity: cap } });
    } else {
      createRoom.mutate({ data: { name: name.trim(), capacity: cap } });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isPending) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Room" : "Add Room"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Room Name <span className="text-destructive">*</span></Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Nursery, K–2nd Grade, Teens"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Capacity <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              type="number"
              min="1"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="Max number of children"
            />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {isEdit ? "Save Changes" : "Add Room"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function RoomsPage() {
  const { data: rooms, isLoading } = useListRooms();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const deleteRoom = useDeleteRoom({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey() });
        toast({ title: "Room deleted" });
        setDeletingId(null);
      },
      onError: () => {
        toast({ title: "Failed to delete room", variant: "destructive" });
        setDeletingId(null);
      },
    },
  });

  const openAdd = () => { setEditingRoom(undefined); setDialogOpen(true); };
  const openEdit = (room: Room) => { setEditingRoom(room); setDialogOpen(true); };

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto w-full space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold">Rooms</h1>
          <p className="text-muted-foreground mt-1">Manage the rooms children are assigned to</p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="w-4 h-4" /> Add Room
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : !rooms?.length ? (
        <EmptyState
          title="No rooms yet"
          description="Add rooms like Nursery, K–2nd Grade, or Teens to organize check-ins."
          icon={<DoorOpen className="w-8 h-8" />}
          action={<Button onClick={openAdd} className="gap-2"><Plus className="w-4 h-4" /> Add Room</Button>}
        />
      ) : (
        <div className="space-y-3">
          {rooms.map((room) => (
            <Card key={room.id} className="border-card-border">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <DoorOpen className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{room.name}</p>
                    {room.capacity != null && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Users className="w-3 h-3" /> Capacity: {room.capacity}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(room)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={deletingId === room.id}
                    onClick={() => { setDeletingId(room.id); deleteRoom.mutate({ roomId: room.id }); }}
                  >
                    {deletingId === room.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-4 h-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RoomFormDialog
        key={editingRoom?.id ?? "new"}
        room={editingRoom}
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditingRoom(undefined); }}
      />
    </div>
  );
}
