import { useState, useEffect } from "react";
import {
  useGetForm,
  useUpdateForm,
  useListQuestions,
  useCreateQuestion,
  useUpdateQuestion,
  useDeleteQuestion,
  useReorderQuestions,
  Question,
  QuestionType,
  QuestionInputType,
  getGetFormQueryKey,
  getListQuestionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Settings, Trash2, GripVertical, Save, ArrowUp, ArrowDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FormBuilderPanelProps {
  formId: number;
}

export function FormBuilderPanel({ formId }: FormBuilderPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: form, isLoading: formLoading } = useGetForm(formId, {
    query: { queryKey: getGetFormQueryKey(formId) },
  });
  const { data: questions, isLoading: questionsLoading } = useListQuestions(formId, {
    query: { queryKey: getListQuestionsQueryKey(formId) },
  });

  const [formSettings, setFormSettings] = useState({
    title: "",
    description: "",
    isActive: true,
    isPublic: true,
  });

  const [editingQuestion, setEditingQuestion] = useState<Partial<Question> | null>(null);
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);

  useEffect(() => {
    if (form) {
      setFormSettings({
        title: form.title,
        description: form.description || "",
        isActive: form.isActive,
        isPublic: form.isPublic,
      });
    }
  }, [form]);

  const updateForm = useUpdateForm({
    mutation: {
      onSuccess: () => {
        toast({ title: "Form settings saved" });
        queryClient.invalidateQueries({ queryKey: getGetFormQueryKey(formId) });
      },
    },
  });

  const createQuestion = useCreateQuestion({
    mutation: {
      onSuccess: () => {
        toast({ title: "Question added" });
        setIsQuestionModalOpen(false);
        queryClient.invalidateQueries({ queryKey: getListQuestionsQueryKey(formId) });
      },
    },
  });

  const updateQuestion = useUpdateQuestion({
    mutation: {
      onSuccess: () => {
        toast({ title: "Question updated" });
        setIsQuestionModalOpen(false);
        queryClient.invalidateQueries({ queryKey: getListQuestionsQueryKey(formId) });
      },
    },
  });

  const deleteQuestion = useDeleteQuestion({
    mutation: {
      onSuccess: () => {
        toast({ title: "Question deleted" });
        queryClient.invalidateQueries({ queryKey: getListQuestionsQueryKey(formId) });
      },
    },
  });

  const reorderQuestions = useReorderQuestions({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListQuestionsQueryKey(formId) });
      },
    },
  });

  const handleSaveSettings = () => {
    updateForm.mutate({ formId, data: formSettings });
  };

  const handleSaveQuestion = () => {
    if (!editingQuestion?.label) {
      toast({ title: "Label is required", variant: "destructive" });
      return;
    }
    const qData = {
      label: editingQuestion.label,
      type: editingQuestion.type as QuestionInputType || QuestionInputType.text,
      required: !!editingQuestion.required,
      order: editingQuestion.order || (questions?.length || 0),
      placeholder: editingQuestion.placeholder || "",
      options: editingQuestion.options || "",
    };
    if (editingQuestion.id) {
      updateQuestion.mutate({ formId, questionId: editingQuestion.id, data: qData });
    } else {
      createQuestion.mutate({ formId, data: qData });
    }
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    if (!questions) return;
    const newQuestions = [...questions];
    if (direction === "up" && index > 0) {
      [newQuestions[index], newQuestions[index - 1]] = [newQuestions[index - 1], newQuestions[index]];
    } else if (direction === "down" && index < newQuestions.length - 1) {
      [newQuestions[index], newQuestions[index + 1]] = [newQuestions[index + 1], newQuestions[index]];
    } else {
      return;
    }
    reorderQuestions.mutate({ formId, data: { questionIds: newQuestions.map((q) => q.id) } });
  };

  if (formLoading || questionsLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-muted w-1/3 rounded" />
        <div className="h-48 bg-muted/50 rounded-xl" />
      </div>
    );
  }

  if (!form) return <div className="p-4 text-muted-foreground">Form not found.</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Questions column */}
      <div className="md:col-span-2 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-serif font-bold">Questions</h2>
          <Button
            size="sm"
            onClick={() => {
              setEditingQuestion({ type: QuestionType.text, required: false });
              setIsQuestionModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1.5" /> Add Question
          </Button>
        </div>

        <div className="space-y-3">
          {questions?.length === 0 ? (
            <Card className="border-dashed bg-transparent">
              <CardContent className="p-8 text-center text-muted-foreground text-sm">
                No questions yet. Click "Add Question" to build your form.
              </CardContent>
            </Card>
          ) : (
            questions?.map((q, index) => (
              <Card key={q.id} className="hover-elevate transition-all border-card-border overflow-hidden">
                <div className="flex items-center">
                  <div className="p-3 flex flex-col gap-1 text-muted-foreground border-r border-border bg-muted/10 h-full justify-center">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveQuestion(index, "up")} disabled={index === 0}>
                      <ArrowUp className="w-3 h-3" />
                    </Button>
                    <GripVertical className="w-4 h-4 mx-auto opacity-50" />
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveQuestion(index, "down")} disabled={index === (questions?.length ?? 0) - 1}>
                      <ArrowDown className="w-3 h-3" />
                    </Button>
                  </div>
                  <CardContent className="p-4 flex-1 flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground">{q.label}</h3>
                        {q.required && <span className="text-xs text-destructive font-medium">*</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                        {q.type} · {q.isChildField ? "System Field" : "Custom Field"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setEditingQuestion(q); setIsQuestionModalOpen(true); }}
                      >
                        Edit
                      </Button>
                      {!q.isChildField && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => { if (confirm("Delete this question?")) deleteQuestion.mutate({ formId, questionId: q.id }); }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Settings sidebar */}
      <div>
        <Card className="border-card-border shadow-sm sticky top-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="w-4 h-4 text-primary" /> Form Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fb-title">Title</Label>
              <Input
                id="fb-title"
                value={formSettings.title}
                onChange={(e) => setFormSettings((p) => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fb-description">Description</Label>
              <Textarea
                id="fb-description"
                rows={2}
                value={formSettings.description}
                onChange={(e) => setFormSettings((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between py-2 border-t border-border">
              <div>
                <Label className="text-sm">Active</Label>
                <p className="text-xs text-muted-foreground">Accepting responses</p>
              </div>
              <Switch checked={formSettings.isActive} onCheckedChange={(c) => setFormSettings((p) => ({ ...p, isActive: c }))} />
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <div>
                <Label className="text-sm">Public</Label>
                <p className="text-xs text-muted-foreground">Show in embed links</p>
              </div>
              <Switch checked={formSettings.isPublic} onCheckedChange={(c) => setFormSettings((p) => ({ ...p, isPublic: c }))} />
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" size="sm" onClick={handleSaveSettings} disabled={updateForm.isPending}>
              <Save className="w-4 h-4 mr-1.5" /> {updateForm.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Question modal */}
      <Dialog open={isQuestionModalOpen} onOpenChange={setIsQuestionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingQuestion?.id ? "Edit Question" : "Add Question"}</DialogTitle>
            <DialogDescription>Configure the form field properties.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Field Label</Label>
              <Input
                value={editingQuestion?.label || ""}
                onChange={(e) => setEditingQuestion((p) => ({ ...p, label: e.target.value }))}
                disabled={editingQuestion?.isChildField}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Field Type</Label>
                <Select
                  value={editingQuestion?.type || "text"}
                  onValueChange={(v) => setEditingQuestion((p) => ({ ...p, type: v as QuestionType }))}
                  disabled={editingQuestion?.isChildField}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Short Text</SelectItem>
                    <SelectItem value="textarea">Long Text</SelectItem>
                    <SelectItem value="select">Dropdown Select</SelectItem>
                    <SelectItem value="multiselect">Multiple Choice</SelectItem>
                    <SelectItem value="checkbox">Checkbox</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="phone">Phone Number</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2 pt-7">
                <Switch
                  id="fb-required"
                  checked={editingQuestion?.required || false}
                  onCheckedChange={(c) => setEditingQuestion((p) => ({ ...p, required: c }))}
                />
                <Label htmlFor="fb-required">Required</Label>
              </div>
            </div>
            {(editingQuestion?.type === "select" || editingQuestion?.type === "multiselect") && (
              <div className="space-y-2 animate-in fade-in zoom-in duration-200">
                <Label>Options (comma separated)</Label>
                <Input
                  value={editingQuestion?.options || ""}
                  onChange={(e) => setEditingQuestion((p) => ({ ...p, options: e.target.value }))}
                  placeholder="Red, Blue, Green"
                  disabled={editingQuestion?.isChildField}
                />
              </div>
            )}
            {!["checkbox", "select", "multiselect"].includes(editingQuestion?.type || "text") && (
              <div className="space-y-2">
                <Label>Placeholder (optional)</Label>
                <Input
                  value={editingQuestion?.placeholder || ""}
                  onChange={(e) => setEditingQuestion((p) => ({ ...p, placeholder: e.target.value }))}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuestionModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveQuestion} disabled={createQuestion.isPending || updateQuestion.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
