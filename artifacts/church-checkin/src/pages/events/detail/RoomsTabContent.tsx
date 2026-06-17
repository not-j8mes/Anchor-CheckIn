import { useState } from "react";
import {
  getListFormFieldsQueryKey,
  getListRoomsQueryKey,
  useCreateFormField,
  useCreateRoom,
  useDeleteRoom,
  useListFormFields,
  useListRooms,
  useUpdateRoom,
  type Room,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { DoorOpen, Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

function EventRoomFormDialog({
  room,
  eventId,
  open,
  onOpenChange,
}: {
  room?: Room;
  eventId: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!room;
  const [name, setName] = useState(room?.name ?? "");
  const [description, setDescription] = useState(room?.description ?? "");
  const [capacity, setCapacity] = useState(
    room?.capacity != null ? String(room.capacity) : "",
  );

  const invalidateRooms = () =>
    queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey(eventId) });
  const createRoom = useCreateRoom({
    mutation: {
      onSuccess: () => {
        invalidateRooms();
        toast({ title: "Room created" });
        onOpenChange(false);
      },
      onError: () =>
        toast({ title: "Failed to create room", variant: "destructive" }),
    },
  });
  const updateRoom = useUpdateRoom({
    mutation: {
      onSuccess: () => {
        invalidateRooms();
        toast({ title: "Room updated" });
        onOpenChange(false);
      },
      onError: () =>
        toast({ title: "Failed to update room", variant: "destructive" }),
    },
  });
  const isPending = createRoom.isPending || updateRoom.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const cap = capacity ? parseInt(capacity, 10) : undefined;
    if (isEdit) {
      updateRoom.mutate({
        eventId,
        roomId: room.id,
        data: {
          name: name.trim(),
          description: description.trim() || undefined,
          capacity: cap,
        },
      });
    } else {
      createRoom.mutate({
        eventId,
        data: {
          name: name.trim(),
          description: description.trim() || undefined,
          capacity: cap,
        },
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!isPending) onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Room" : "Add Room"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>
              Room Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Nursery, K-2nd Grade"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Description{" "}
              <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Age range, grade, etc."
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Capacity{" "}
              <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              type="number"
              min="1"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="Max children"
            />
          </div>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isPending}>
              {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {isEdit ? "Save Changes" : "Add Room"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RoomsTabContent({
  eventId,
  formId,
  roomAssignmentMode,
}: {
  eventId: number;
  formId?: number | null;
  roomAssignmentMode?: string | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: rooms, isLoading } = useListRooms(eventId, {
    query: { enabled: !!eventId, queryKey: getListRoomsQueryKey(eventId) },
  });
  const { data: formFields = [] } = useListFormFields(formId ?? 0, {
    query: {
      enabled: !!formId,
      queryKey: getListFormFieldsQueryKey(formId ?? 0),
    },
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const deleteRoom = useDeleteRoom({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey(eventId) });
        toast({ title: "Room deleted" });
        setDeletingId(null);
      },
      onError: () => {
        toast({ title: "Failed to delete room", variant: "destructive" });
        setDeletingId(null);
      },
    },
  });

  const createFormField = useCreateFormField({
    mutation: {
      onSuccess: () => {
        if (formId) {
          queryClient.invalidateQueries({
            queryKey: getListFormFieldsQueryKey(formId),
          });
        }
        toast({ title: "Room / Group field added to the registration form" });
      },
      onError: () => {
        toast({ title: "Failed to add field", variant: "destructive" });
      },
    },
  });

  const hasRoomAssignmentField = formFields.some(
    (f) => f.systemKey === "room_assignment",
  );
  const activeRooms = rooms?.filter((r) => r.isActive) ?? [];
  const inactiveRooms = rooms?.filter((r) => !r.isActive) ?? [];

  const handleAddRoomField = () => {
    if (!formId) return;
    createFormField.mutate({
      formId,
      data: {
        fieldKind: "system",
        systemKey: "room_assignment",
        label: "Room / Group",
        fieldType: "select",
        required: true,
        sortOrder: formFields.length,
        placeholder: "Select a room or group",
        options: "",
        sectionKey: "child_info",
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {rooms?.length ?? 0} room{rooms?.length === 1 ? "" : "s"}
        </p>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => {
            setEditingRoom(undefined);
            setDialogOpen(true);
          }}
        >
          <Plus className="w-3.5 h-3.5" /> Add Room
        </Button>
      </div>

      {formId &&
        roomAssignmentMode === "registrant_chooses" &&
        (rooms?.length ?? 0) > 0 &&
        !hasRoomAssignmentField && (
          <div className="flex items-start gap-3 p-3.5 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 text-sm">
            <DoorOpen className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-blue-900 dark:text-blue-300">
                Room selection is not on the registration form yet.
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                Add the Room / Group field if registrants should choose a room
                when signing up.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-blue-300 text-blue-800 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950 flex-shrink-0"
              onClick={handleAddRoomField}
              disabled={createFormField.isPending}
            >
              {createFormField.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "Add to form"
              )}
            </Button>
          </div>
        )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : !rooms?.length ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <DoorOpen className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p>
              No rooms yet. Add rooms like Nursery or K-2nd Grade to organize
              check-ins.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {[...activeRooms, ...inactiveRooms].map((room) => (
            <Card
              key={room.id}
              className={!room.isActive ? "opacity-60" : undefined}
            >
              <CardContent className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <DoorOpen className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{room.name}</p>
                      {!room.isActive && (
                        <Badge variant="secondary" className="text-[10px] py-0">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    {room.description && (
                      <p className="text-xs text-muted-foreground">
                        {room.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-0.5">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" />{" "}
                        {room.participantCount ?? 0} registered
                      </p>
                      {room.capacity != null && (
                        <p className="text-xs text-muted-foreground">
                          max {room.capacity}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingRoom(room);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={deletingId === room.id}
                    onClick={() => {
                      setDeletingId(room.id);
                      deleteRoom.mutate({ eventId, roomId: room.id });
                    }}
                  >
                    {deletingId === room.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EventRoomFormDialog
        key={editingRoom?.id ?? "new"}
        room={editingRoom}
        eventId={eventId}
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditingRoom(undefined);
        }}
      />
    </div>
  );
}
