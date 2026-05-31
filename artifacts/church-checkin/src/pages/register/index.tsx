import { useState } from "react";
import { useParams } from "wouter";
import { useGetOrganization, useListForms, useGetForm, useSubmitRegistration } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2 } from "lucide-react";

export default function PublicRegistrationForm() {
  const params = useParams<{ embedSlug: string }>();
  const slug = params.embedSlug;

  const { data: org, isLoading: orgLoading } = useGetOrganization();
  const { data: forms } = useListForms();
  
  // Find form by slug. In a real app we'd have a specific endpoint or lookup,
  // but for now we'll match it from the list.
  const formSummary = forms?.find(f => f.embedSlug === slug);
  const { data: form, isLoading: formLoading } = useGetForm(formSummary?.id || 0, {
    query: { enabled: !!formSummary?.id }
  });

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  const submitRegistration = useSubmitRegistration({
    mutation: {
      onSuccess: () => {
        setIsSubmitted(true);
      }
    }
  });

  const handleInputChange = (questionId: number, value: any) => {
    setFormData(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    // Map the dynamic answers back to the strongly typed fields where possible
    const findValue = (key: string) => {
      const q = form.questions.find(q => q.fieldKey === key);
      return q ? formData[q.id] : undefined;
    };

    const registrationData = {
      childFirstName: findValue("childFirstName") || "",
      childLastName: findValue("childLastName") || "",
      childDateOfBirth: findValue("childDateOfBirth"),
      guardianName: findValue("guardianName") || "",
      guardianPhone: findValue("guardianPhone") || "",
      guardianEmail: findValue("guardianEmail"),
      allergies: findValue("allergies"),
      specialNeeds: findValue("specialNeeds"),
      room: findValue("room"),
      answers: form.questions.map(q => ({
        questionId: q.id,
        value: formData[q.id]?.toString() || ""
      }))
    };

    submitRegistration.mutate({ formId: form.id, data: registrationData });
  };

  if (orgLoading || formLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div></div>;
  }

  if (!form || !form.isActive) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold font-serif mb-2">Form Unavailable</h1>
        <p className="text-muted-foreground">This registration form is currently closed or does not exist.</p>
      </div>
    );
  }

  // Set custom CSS vars based on org settings
  const customStyles = org?.primaryColor ? {
    "--primary": org.primaryColor,
    "--ring": org.primaryColor,
  } as React.CSSProperties : {};

  return (
    <div className="min-h-screen bg-muted/20 py-8 px-4 sm:px-6 lg:px-8" style={customStyles}>
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Organization Header */}
        <div className="text-center space-y-4 mb-8">
          {org?.logoUrl ? (
            <img src={org.logoUrl} alt={org.name} className="h-20 mx-auto object-contain" />
          ) : (
            <div className="w-20 h-20 mx-auto bg-primary text-white rounded-full flex items-center justify-center font-serif text-3xl font-bold">
              {org?.name.charAt(0) || "C"}
            </div>
          )}
          <h1 className="text-3xl font-serif font-bold text-foreground">{org?.name}</h1>
          {org?.headerText && <p className="text-lg text-muted-foreground max-w-xl mx-auto">{org.headerText}</p>}
        </div>

        {isSubmitted ? (
          <Card className="border-card-border shadow-md overflow-hidden text-center py-12">
            <CardContent className="flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-serif font-bold">Registration Complete!</h2>
              <p className="text-muted-foreground text-lg max-w-md">
                Thank you for registering. We look forward to seeing you!
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-card-border shadow-xl overflow-hidden">
            <div className="bg-primary/5 px-6 py-8 border-b border-border text-center">
              <h2 className="text-2xl font-serif font-bold text-foreground">{form.title}</h2>
              {form.description && <p className="text-muted-foreground mt-2">{form.description}</p>}
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
              {form.questions.map((q) => (
                <div key={q.id} className="space-y-2">
                  <Label className="text-base font-medium flex items-center gap-1">
                    {q.label}
                    {q.required && <span className="text-destructive">*</span>}
                  </Label>

                  {q.type === 'textarea' ? (
                    <Textarea 
                      required={q.required}
                      placeholder={q.placeholder || ""}
                      value={formData[q.id] || ""}
                      onChange={(e) => handleInputChange(q.id, e.target.value)}
                      className="bg-muted/30 focus-visible:bg-background resize-y"
                      rows={3}
                    />
                  ) : q.type === 'select' && q.options ? (
                    <Select 
                      required={q.required} 
                      value={formData[q.id]} 
                      onValueChange={(v) => handleInputChange(q.id, v)}
                    >
                      <SelectTrigger className="bg-muted/30 focus:bg-background">
                        <SelectValue placeholder={q.placeholder || "Select an option"} />
                      </SelectTrigger>
                      <SelectContent>
                        {q.options.split(',').map((opt) => (
                          <SelectItem key={opt.trim()} value={opt.trim()}>{opt.trim()}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : q.type === 'checkbox' ? (
                    <div className="flex items-center space-x-2 mt-2">
                      <Checkbox 
                        id={`q-${q.id}`} 
                        checked={!!formData[q.id]} 
                        onCheckedChange={(c) => handleInputChange(q.id, c)}
                        required={q.required}
                      />
                      <Label htmlFor={`q-${q.id}`} className="text-sm font-normal text-muted-foreground cursor-pointer">
                        {q.placeholder || "Yes, I agree"}
                      </Label>
                    </div>
                  ) : (
                    <Input 
                      type={q.type === 'date' ? 'date' : q.type === 'email' ? 'email' : q.type === 'number' ? 'number' : 'text'}
                      required={q.required}
                      placeholder={q.placeholder || ""}
                      value={formData[q.id] || ""}
                      onChange={(e) => handleInputChange(q.id, e.target.value)}
                      className="bg-muted/30 focus-visible:bg-background h-12 text-base"
                    />
                  )}
                </div>
              ))}

              <div className="pt-6 border-t border-border">
                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full h-14 text-lg font-bold"
                  disabled={submitRegistration.isPending}
                >
                  {submitRegistration.isPending ? "Submitting..." : "Complete Registration"}
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}