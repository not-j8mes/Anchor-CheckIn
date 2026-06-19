import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { EventWorkspaceLayout } from "@/components/layout/EventWorkspaceLayout";
import { AuthProvider, useAuth } from "@/lib/auth";

import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import EventSelectionScreen from "@/pages/events";
import EventWorkspace from "@/pages/events/detail";
import EventSetupWizard from "@/pages/events/setup";
import PublicRegistrationForm from "@/pages/register";
import SettingsPage from "@/pages/settings";

const queryClient = new QueryClient();

function EventWorkspaceRoute() {
  return (
    <SidebarProvider>
      <EventWorkspaceLayout>
        <EventWorkspace />
      </EventWorkspaceLayout>
    </SidebarProvider>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) navigate("/login");
  }, [isLoading, navigate, user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}

function ProtectedEventSelectionScreen() {
  return (
    <AuthGate>
      <EventSelectionScreen />
    </AuthGate>
  );
}

function ProtectedEventSetupWizard() {
  return (
    <AuthGate>
      <EventSetupWizard />
    </AuthGate>
  );
}

function ProtectedSettingsPage() {
  return (
    <AuthGate>
      <SettingsPage />
    </AuthGate>
  );
}

function ProtectedEventWorkspaceRoute() {
  return (
    <AuthGate>
      <EventWorkspaceRoute />
    </AuthGate>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public routes — no layout */}
      <Route path="/login" component={LoginPage} />
      <Route path="/register/:embedSlug" component={PublicRegistrationForm} />

      {/* New event setup wizard — must be before /:id routes */}
      <Route path="/events/new" component={ProtectedEventSetupWizard} />

      {/* Event workspace — all sections under /events/:id/* */}
      <Route path="/events/:id/checkin" component={ProtectedEventWorkspaceRoute} />
      <Route path="/events/:id/registrations" component={ProtectedEventWorkspaceRoute} />
      <Route path="/events/:id/groups" component={ProtectedEventWorkspaceRoute} />
      <Route path="/events/:id/rooms" component={ProtectedEventWorkspaceRoute} />
      <Route path="/events/:id/form" component={ProtectedEventWorkspaceRoute} />
      <Route path="/events/:id/reports" component={ProtectedEventWorkspaceRoute} />
      <Route path="/events/:id/settings" component={ProtectedEventWorkspaceRoute} />
      <Route path="/events/:id" component={ProtectedEventWorkspaceRoute} />

      {/* Event selection home screen */}
      <Route path="/events" component={ProtectedEventSelectionScreen} />
      <Route path="/" component={ProtectedEventSelectionScreen} />

      {/* Settings */}
      <Route path="/settings" component={ProtectedSettingsPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
