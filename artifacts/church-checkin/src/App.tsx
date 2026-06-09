import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { EventWorkspaceLayout } from "@/components/layout/EventWorkspaceLayout";
import { AppLayout } from "@/components/layout/AppLayout";

import NotFound from "@/pages/not-found";
import EventSelectionScreen from "@/pages/events";
import EventWorkspace from "@/pages/events/detail";
import EventSetupWizard from "@/pages/events/setup";
import PublicRegistrationForm from "@/pages/register";
import CheckinKiosk from "@/pages/checkin";
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

function Router() {
  return (
    <Switch>
      {/* Public routes — no layout */}
      <Route path="/register/:embedSlug" component={PublicRegistrationForm} />

      {/* Standalone kiosk mode */}
      <Route path="/checkin" component={CheckinKiosk} />

      {/* New event setup wizard — must be before /:id routes */}
      <Route path="/events/new" component={EventSetupWizard} />

      {/* Event workspace — all sections under /events/:id/* */}
      <Route path="/events/:id/checkin" component={EventWorkspaceRoute} />
      <Route path="/events/:id/registrations" component={EventWorkspaceRoute} />
      <Route path="/events/:id/groups" component={EventWorkspaceRoute} />
      <Route path="/events/:id/rooms" component={EventWorkspaceRoute} />
      <Route path="/events/:id/form" component={EventWorkspaceRoute} />
      <Route path="/events/:id/reports" component={EventWorkspaceRoute} />
      <Route path="/events/:id/settings" component={EventWorkspaceRoute} />
      <Route path="/events/:id" component={EventWorkspaceRoute} />

      {/* Event selection home screen */}
      <Route path="/events" component={EventSelectionScreen} />
      <Route path="/" component={EventSelectionScreen} />

      {/* Settings */}
      <Route path="/settings" component={SettingsPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
