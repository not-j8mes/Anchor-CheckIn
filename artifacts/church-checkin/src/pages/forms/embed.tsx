import { useParams, Link } from "wouter";
import { useGetForm } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Copy, ExternalLink, Code } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function FormEmbed() {
  const params = useParams<{ id: string }>();
  const formId = parseInt(params.id || "0", 10);
  const { data: form, isLoading } = useGetForm(formId);
  const { toast } = useToast();

  const handleCopy = (text: string, title: string) => {
    navigator.clipboard.writeText(text);
    toast({ title });
  };

  if (isLoading) return <div className="p-10 animate-pulse"><div className="h-8 bg-muted w-1/3 rounded mb-8"></div><div className="h-64 bg-muted/50 rounded-xl"></div></div>;
  if (!form) return <div className="p-10">Form not found</div>;

  const publicUrl = `${window.location.origin}/register/${form.embedSlug}`;
  const embedUrl = `${publicUrl}?embed=true`;
  const iframeCode = `<iframe src="${embedUrl}" width="100%" height="800" frameborder="0" style="border:none; border-radius:12px;"></iframe>`;

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto w-full space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/forms"><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Share Form</h1>
          <p className="text-muted-foreground mt-1">{form.title}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Card className="border-card-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="w-5 h-5 text-primary" /> Direct Link
              </CardTitle>
              <CardDescription>Share this link directly via email, text, or social media.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input value={publicUrl} readOnly className="bg-muted/50" />
                <Button onClick={() => handleCopy(publicUrl, "Link copied to clipboard")}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <div className="mt-4">
                <Button variant="outline" className="w-full" asChild>
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                    Open in new tab <ExternalLink className="w-4 h-4 ml-2" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-card-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="w-5 h-5 text-primary" /> Website Embed
              </CardTitle>
              <CardDescription>Paste this code into your website's HTML to embed the form directly.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <pre className="p-4 rounded-md bg-muted text-sm text-foreground overflow-x-auto border border-border/50 font-mono whitespace-pre-wrap">
                  {iframeCode}
                </pre>
                <Button 
                  size="sm" 
                  variant="secondary" 
                  className="absolute top-2 right-2"
                  onClick={() => handleCopy(iframeCode, "Embed code copied to clipboard")}
                >
                  <Copy className="w-4 h-4 mr-2" /> Copy
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-serif font-bold">Live Preview</h2>
          <div className="border-[8px] border-muted rounded-2xl overflow-hidden shadow-lg h-[600px] relative bg-white">
            <div className="absolute inset-0 flex items-center justify-center bg-muted/20 z-0">
              <span className="text-muted-foreground flex items-center gap-2"><div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" /> Loading preview...</span>
            </div>
            <iframe 
              src={embedUrl}
              className="w-full h-full relative z-10 border-0 bg-transparent"
              title="Form Preview"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
