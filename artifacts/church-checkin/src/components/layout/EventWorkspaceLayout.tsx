import { Link, useLocation, useParams } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenuItem,
  SidebarMenu,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useGetEvent } from "@workspace/api-client-react";
import { getGetEventQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  LayoutDashboard,
  CheckSquare,
  ClipboardList,
  DoorOpen,
  FileEdit,
  BarChart2,
  Settings,
  Users,
  LogOut,
  ContactRound,
  ChevronUp,
  ArrowRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useAuth,
  type OrganizationPermission,
} from "@/lib/auth";
import { APP_NAME, DEFAULT_APP_LOGO } from "@/lib/branding";

function NavLink({
  href,
  icon: Icon,
  label,
  active,
  onClick,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <SidebarMenuItem className="mb-0">
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-10 w-full items-center gap-3 px-3 py-2 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring ${
          active
            ? "text-sidebar-foreground font-semibold"
            : "rounded-md text-sidebar-foreground/85 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        }`}
        onClick={onClick}
      >
        <Icon
          className={`w-4 h-4 shrink-0 ${
            active ? "text-sidebar-primary" : "text-sidebar-foreground/70"
          }`}
        />
        <span>{label}</span>
      </Link>
    </SidebarMenuItem>
  );
}

export function EventWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const eventId = Number(id);
  const [location] = useLocation();
  const { setOpenMobile, state: sidebarState } = useSidebar();
  const { user, organization, logout } = useAuth();

  const { data: event } = useGetEvent(eventId, {
    query: { enabled: !!eventId, queryKey: getGetEventQueryKey(eventId) },
  });

  const close = () => setOpenMobile(false);

  const isChildCheckin = !event?.registrationType || event.registrationType === "child_checkin";
  const isFamilyGroup = event?.registrationType === "family_group";
  const trackAttendance = event?.trackAttendance ?? isChildCheckin;

  const base = `/events/${eventId}`;

  // Active-link helper — exact match for dashboard, prefix match for the rest
  const isActive = (href: string) => {
    if (href === base) return location === base;
    return location.startsWith(href);
  };

  async function handleLogout() {
    await logout();
    window.location.href = "/login";
  }

  // Build nav based on registration type
  type NavItem = {
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    permission: OrganizationPermission;
    section: "Overview" | "People" | "Insights" | "Setup";
  };
  const nav: NavItem[] = [];
  const can = (permission: OrganizationPermission) =>
    organization?.role === "owner" ||
    organization?.permissions.includes(permission);
  const showCheckinEntry =
    (isChildCheckin || trackAttendance) && can("checkin");

  nav.push({ href: base, icon: LayoutDashboard, label: "Dashboard", permission: "events", section: "Overview" });

  if (isChildCheckin) {
    nav.push({ href: `${base}/registrations`, icon: ClipboardList, label: "Registrations", permission: "registrations", section: "People" });
    nav.push({ href: `${base}/staff`, icon: ContactRound, label: "Staff", permission: "staff", section: "People" });
    nav.push({ href: `${base}/rooms`, icon: DoorOpen, label: "Rooms", permission: "rooms", section: "Setup" });
    nav.push({ href: `${base}/reports`, icon: BarChart2, label: "Reports", permission: "reports", section: "Insights" });
  } else if (isFamilyGroup) {
    nav.push({ href: `${base}/registrations`, icon: ClipboardList, label: "Registrations", permission: "registrations", section: "People" });
    nav.push({ href: `${base}/groups`, icon: Users, label: "Groups", permission: "registrations", section: "People" });
    nav.push({ href: `${base}/staff`, icon: ContactRound, label: "Staff", permission: "staff", section: "People" });
    nav.push({ href: `${base}/reports`, icon: BarChart2, label: "Reports", permission: "reports", section: "Insights" });
  } else {
    // Individual
    nav.push({ href: `${base}/registrations`, icon: ClipboardList, label: "Registrations", permission: "registrations", section: "People" });
    nav.push({ href: `${base}/staff`, icon: ContactRound, label: "Staff", permission: "staff", section: "People" });
    nav.push({ href: `${base}/reports`, icon: BarChart2, label: "Reports", permission: "reports", section: "Insights" });
  }
  if (can("forms")) {
    nav.push({ href: `${base}/form`, icon: FileEdit, label: "Registration Form", permission: "forms", section: "Setup" });
  }
  if (can("event_settings")) {
    nav.push({ href: `${base}/settings`, icon: Settings, label: "Event Settings", permission: "event_settings", section: "Setup" });
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar>
        <SidebarHeader className="p-3">
          {/* Back to events */}
          <div className="flex items-center gap-1">
            <Link href="/" onClick={close} className="min-w-0 flex-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground h-8 px-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Events
              </Button>
            </Link>
            <SidebarTrigger
              className="hidden h-8 w-8 shrink-0 md:inline-flex"
              title="Collapse sidebar (Ctrl+B)"
              aria-label="Collapse sidebar"
            />
          </div>

          {/* Event identity */}
          {event ? (
            <div className="mt-2 px-2">
              <p className="font-serif font-bold text-sidebar-foreground text-lg leading-tight line-clamp-2">
                {event.name}
              </p>
            </div>
          ) : (
            <div className="mt-2 px-2 space-y-1.5">
              <div className="h-4 bg-sidebar-accent/40 rounded animate-pulse" />
              <div className="h-3 bg-sidebar-accent/30 rounded w-2/3 animate-pulse" />
            </div>
          )}
          {showCheckinEntry && (
            <div className="mt-4 -mx-3 border-t border-sidebar-border" />
          )}
          {showCheckinEntry && (
            <Link
              href={`${base}/checkin`}
              onClick={close}
              title="Check-In Desk"
              aria-current={isActive(`${base}/checkin`) ? "page" : undefined}
              className={`mt-3 flex min-h-12 items-center gap-3 rounded-lg bg-primary px-3 py-1.5 text-primary-foreground shadow-sm transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 ${
                isActive(`${base}/checkin`) ? "ring-2 ring-primary-foreground/25" : ""
              }`}
            >
              <CheckSquare className="h-5 w-5 shrink-0" />
              <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <span className="block text-[15px] font-semibold leading-5">Check-In Desk</span>
                <span className="mt-0.5 block text-xs leading-4 text-primary-foreground/75">Open attendance</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-primary-foreground/75 group-data-[collapsible=icon]:hidden" />
            </Link>
          )}
        </SidebarHeader>

        <SidebarContent className="gap-0 px-2 py-2">
          {(["Overview", "People", "Insights", "Setup"] as const).map((section) => {
            const items = nav.filter(
              (item) => item.section === section && can(item.permission),
            );
            if (!items.length) return null;
            return (
              <SidebarGroup
                key={section}
                className={section === "Overview" ? "p-0" : "mt-6 p-0"}
              >
                <SidebarGroupLabel className="mb-0 h-5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/65">
                  {section}
                </SidebarGroupLabel>
                <SidebarMenu className="gap-0">
                  {items.map((item) => (
                    <NavLink
                      key={item.href}
                      href={item.href}
                      icon={item.icon}
                      label={item.label}
                      active={isActive(item.href)}
                      onClick={close}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            );
          })}
        </SidebarContent>

        <SidebarFooter className="p-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg border border-sidebar-foreground/10 bg-sidebar-accent/35 px-3 py-2 text-left outline-none transition-colors duration-150 hover:bg-sidebar-accent/60 focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2"
                  aria-label={`Account menu for ${user.firstName} ${user.lastName}`}
                >
                  <ContactRound className="h-4 w-4 shrink-0 text-sidebar-foreground/70" />
                  <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                    <span className="block truncate text-sm font-medium text-sidebar-foreground">
                      {user.firstName} {user.lastName}
                    </span>
                    <span className="block truncate text-xs text-sidebar-foreground/60">
                      {user.email || user.username}
                    </span>
                  </span>
                  <ChevronUp className="h-4 w-4 shrink-0 text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="truncate text-sm font-medium">{user.firstName} {user.lastName}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email || user.username}</p>
                </div>
                <DropdownMenuItem onSelect={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <SidebarMenu>
              <SidebarMenuItem>
              <button
                type="button"
                className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors w-full text-sm text-sidebar-foreground hover:bg-sidebar-accent/50"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 shrink-0 text-sidebar-foreground/70" />
                <span>Logout</span>
              </button>
              </SidebarMenuItem>
            </SidebarMenu>
          )}
        </SidebarFooter>
      </Sidebar>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {sidebarState === "collapsed" && (
          <SidebarTrigger
            className="fixed left-3 top-3 z-30 hidden h-9 w-9 border border-border bg-background shadow-sm md:inline-flex"
            title="Open sidebar (Ctrl+B)"
            aria-label="Open sidebar"
          />
        )}
        {/* Mobile-only top bar with hamburger to open sidebar */}
        <div className="flex md:hidden sticky top-0 z-10 items-center gap-3 px-4 h-14 border-b border-border bg-background/95 backdrop-blur shrink-0">
          <SidebarTrigger className="h-8 w-8" />
          <div className="min-w-0 flex-1">
            {event ? (
              <p className="font-semibold text-sm truncate">{event.name}</p>
            ) : (
              <div className="h-4 w-32 bg-muted rounded animate-pulse" />
            )}
          </div>
        </div>
        {children}
        <footer className="flex shrink-0 items-center justify-center gap-2 border-t border-border/60 bg-background px-4 py-3 text-xs text-muted-foreground">
          <img src={DEFAULT_APP_LOGO} alt="" className="h-4 w-4 object-contain" aria-hidden="true" />
          <span>Powered by <span className="font-semibold text-foreground/70">{APP_NAME}</span></span>
        </footer>
      </main>
    </div>
  );
}
