import { useParams } from "wouter";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { FormBuilderPanel } from "@/components/forms/FormBuilderPanel";

export default function FormBuilder() {
  const params = useParams<{ id: string }>();
  const formId = parseInt(params.id || "0", 10);

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto w-full space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/events"><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Form Builder</h1>
          <p className="text-muted-foreground mt-1">Edit registration form questions and settings</p>
        </div>
      </div>
      <FormBuilderPanel formId={formId} />
    </div>
  );
}
