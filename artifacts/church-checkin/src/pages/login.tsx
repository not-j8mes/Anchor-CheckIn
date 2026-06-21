import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { APP_NAME, APP_TAGLINE, DEFAULT_APP_LOGO } from "@/lib/branding";
function postLoginDestination(user: { isSuperAdmin: boolean } | null, organization: unknown): string {
  if (user?.isSuperAdmin && !organization) return "/admin";
  return "/events";
}

export default function LoginPage() {
  const { user, organization, isLoading, login } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [staySignedIn, setStaySignedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && user) navigate(postLoginDestination(user, organization));
  }, [isLoading, navigate, user, organization]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsSubmitting(true);
    try {
      await login(email, password, staySignedIn);
      // auth context updates async; the useEffect above handles the redirect
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl shadow-foreground/5 p-8">
        <div className="flex flex-col items-center text-center mb-8">
          <img src={DEFAULT_APP_LOGO} alt={`${APP_NAME} logo`} className="mb-3 h-20 w-20 object-contain" />
          <p className="text-lg font-serif font-bold text-foreground">{APP_NAME}</p>
          <p className="text-sm font-medium text-muted-foreground">{APP_TAGLINE}</p>
          <h1 className="mt-3 text-3xl font-serif font-bold text-foreground">Sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">Access your check-in dashboard.</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-12 rounded-xl"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 rounded-xl"
              required
            />
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="stay-signed-in"
              checked={staySignedIn}
              onCheckedChange={(checked) => setStaySignedIn(checked === true)}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <Label htmlFor="stay-signed-in" className="cursor-pointer font-medium">
                Stay signed in
              </Label>
              <p className="text-xs text-muted-foreground">
                Keep me signed in on this trusted device for up to 14 days.
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <div className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">
              {notice}
            </div>
          )}

          <Button
            type="submit"
            className="h-12 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={isSubmitting || isLoading}
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-3 text-sm">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
            onClick={() => setNotice("Password reset will be available soon.")}
          >
            Forgot password?
          </button>
          <a
            href="https://anchorcheckin.com/pricing"
            className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            Don&apos;t have an account? View plans
          </a>
        </div>
      </div>
    </div>
  );
}
