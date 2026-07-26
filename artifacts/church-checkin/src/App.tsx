import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { EventWorkspaceLayout } from "@/components/layout/EventWorkspaceLayout";
import {
  AuthProvider,
  useAuth,
  type OrganizationPermission,
} from "@/lib/auth";

import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import EventSelectionScreen from "@/pages/events";
import EventWorkspace from "@/pages/events/detail";
import EventSetupWizard from "@/pages/events/setup";
import PublicRegistrationForm from "@/pages/register";
import SettingsPage from "@/pages/settings";
import PlatformAdminPage from "@/pages/admin";

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

function PermissionGate({
  permission,
  children,
}: {
  permission: OrganizationPermission;
  children: React.ReactNode;
}) {
  const { organization, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const allowed = Boolean(
    organization &&
      (organization.role === "owner" ||
        organization.permissions.includes(permission)),
  );

  useEffect(() => {
    if (!isLoading && organization && !allowed) navigate("/events");
  }, [allowed, isLoading, navigate, organization]);

  if (!allowed) return null;
  return <>{children}</>;
}

function SuperAdminGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!user) { navigate("/login"); return; }
    if (!user.isSuperAdmin) { navigate("/events"); }
  }, [isLoading, navigate, user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user || !user.isSuperAdmin) {
    return null;
  }

  return <>{children}</>;
}

function ProtectedAdminPage() {
  return (
    <SuperAdminGate>
      <PlatformAdminPage />
    </SuperAdminGate>
  );
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
      <PermissionGate permission="event_settings">
        <EventSetupWizard />
      </PermissionGate>
    </AuthGate>
  );
}

function ProtectedSettingsPage() {
  return (
    <AuthGate>
      <PermissionGate permission="org_settings">
        <SettingsPage />
      </PermissionGate>
    </AuthGate>
  );
}

function EventWorkspaceWithPermission({
  permission,
}: {
  permission: OrganizationPermission;
}) {
  return (
    <AuthGate>
      <PermissionGate permission={permission}>
        <EventWorkspaceRoute />
      </PermissionGate>
    </AuthGate>
  );
}

const EventDashboardRoute = () => (
  <EventWorkspaceWithPermission permission="events" />
);
const CheckinRoute = () => (
  <EventWorkspaceWithPermission permission="checkin" />
);
const RegistrationsRoute = () => (
  <EventWorkspaceWithPermission permission="registrations" />
);
const RoomsRoute = () => (
  <EventWorkspaceWithPermission permission="rooms" />
);
const StaffRoute = () => (
  <EventWorkspaceWithPermission permission="staff" />
);
const FormsRoute = () => (
  <EventWorkspaceWithPermission permission="forms" />
);
const ReportsRoute = () => (
  <EventWorkspaceWithPermission permission="reports" />
);
const EventSettingsRoute = () => (
  <EventWorkspaceWithPermission permission="event_settings" />
);

function Router() {
  return (
    <Switch>
      {/* Public routes — no layout */}
      <Route path="/login" component={LoginPage} />
      <Route path="/register/:embedSlug" component={PublicRegistrationForm} />

      {/* New event setup wizard — must be before /:id routes */}
      <Route path="/events/new" component={ProtectedEventSetupWizard} />

      {/* Event workspace — all sections under /events/:id/* */}
      <Route path="/events/:id/checkin" component={CheckinRoute} />
      <Route path="/events/:id/registrations" component={RegistrationsRoute} />
      <Route path="/events/:id/groups" component={RegistrationsRoute} />
      <Route path="/events/:id/rooms" component={RoomsRoute} />
      <Route path="/events/:id/staff" component={StaffRoute} />
      <Route path="/events/:id/form" component={FormsRoute} />
      <Route path="/events/:id/reports" component={ReportsRoute} />
      <Route path="/events/:id/settings" component={EventSettingsRoute} />
      <Route path="/events/:id" component={EventDashboardRoute} />

      {/* Event selection home screen */}
      <Route path="/events" component={ProtectedEventSelectionScreen} />
      <Route path="/" component={ProtectedEventSelectionScreen} />

      {/* Settings */}
      <Route path="/settings" component={ProtectedSettingsPage} />

      {/* Platform admin — super admin only */}
      <Route path="/admin" component={ProtectedAdminPage} />

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
