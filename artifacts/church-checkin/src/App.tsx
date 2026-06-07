import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppLayout } from "@/components/layout/AppLayout";

import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import EventsPage from "@/pages/events";
import EventDetail from "@/pages/events/detail";
import FormsList from "@/pages/forms";
import FormBuilder from "@/pages/forms/builder";
import FormRegistrations from "@/pages/forms/registrations";
import FormEmbed from "@/pages/forms/embed";
import PublicRegistrationForm from "@/pages/register";
import ChildrenDirectory from "@/pages/children";
import Settings from "@/pages/settings";
import CheckinKiosk from "@/pages/checkin";
import RoomsPage from "@/pages/rooms";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* Public Routes without sidebar */}
      <Route path="/register/:embedSlug" component={PublicRegistrationForm} />

      {/* Kiosk Mode (clean layout, no sidebar) */}
      <Route path="/checkin" component={CheckinKiosk} />

      {/* Admin Routes with Sidebar */}
      <Route path="/events/:id">
        <AppLayout><EventDetail /></AppLayout>
      </Route>
      <Route path="/events">
        <AppLayout><EventsPage /></AppLayout>
      </Route>
      <Route path="/forms/:id/builder">
        <AppLayout><FormBuilder /></AppLayout>
      </Route>
      <Route path="/forms/:id/registrations">
        <AppLayout><FormRegistrations /></AppLayout>
      </Route>
      <Route path="/forms/:id/embed">
        <AppLayout><FormEmbed /></AppLayout>
      </Route>
      <Route path="/forms">
        <AppLayout><FormsList /></AppLayout>
      </Route>
      <Route path="/children">
        <AppLayout><ChildrenDirectory /></AppLayout>
      </Route>
      <Route path="/rooms">
        <AppLayout><RoomsPage /></AppLayout>
      </Route>
      <Route path="/settings">
        <AppLayout><Settings /></AppLayout>
      </Route>
      <Route path="/">
        <AppLayout><Dashboard /></AppLayout>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <SidebarProvider>
            <Router />
          </SidebarProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
