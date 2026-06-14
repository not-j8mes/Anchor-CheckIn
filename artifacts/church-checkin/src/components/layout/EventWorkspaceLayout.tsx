import { Link, useLocation, useParams } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenuItem,
  SidebarMenu,
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
} from "lucide-react";

function registrationTypeBadge(type?: string | null) {
  if (!type || type === "child_checkin")
    return <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px]">Child Check-In</Badge>;
  if (type === "family_group")
    return <Badge className="bg-teal-100 text-teal-800 border-teal-200 text-[10px]">Family / Group</Badge>;
  if (type === "individual")
    return <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px]">Individual</Badge>;
  return null;
}

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
    <SidebarMenuItem className="mb-0.5">
      <Link
        href={href}
        className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors w-full text-sm ${
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            : "text-sidebar-foreground hover:bg-sidebar-accent/50"
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
  const { setOpenMobile } = useSidebar();

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

  // Build nav based on registration type
  type NavItem = { href: string; icon: React.ComponentType<{ className?: string }>; label: string };
  const nav: NavItem[] = [];

  nav.push({ href: base, icon: LayoutDashboard, label: "Dashboard" });

  if (isChildCheckin) {
    nav.push({ href: `${base}/checkin`, icon: CheckSquare, label: "Check-In Desk" });
    nav.push({ href: `${base}/registrations`, icon: ClipboardList, label: "Registrations" });
    nav.push({ href: `${base}/rooms`, icon: DoorOpen, label: "Rooms" });
    nav.push({ href: `${base}/form`, icon: FileEdit, label: "Registration Form" });
    nav.push({ href: `${base}/reports`, icon: BarChart2, label: "Reports" });
  } else if (isFamilyGroup) {
    nav.push({ href: `${base}/registrations`, icon: ClipboardList, label: "Registrations" });
    nav.push({ href: `${base}/groups`, icon: Users, label: "Groups" });
    if (trackAttendance) {
      nav.push({ href: `${base}/checkin`, icon: CheckSquare, label: "Check-In Desk" });
    }
    nav.push({ href: `${base}/form`, icon: FileEdit, label: "Registration Form" });
    nav.push({ href: `${base}/reports`, icon: BarChart2, label: "Reports" });
  } else {
    // Individual
    nav.push({ href: `${base}/registrations`, icon: ClipboardList, label: "Registrations" });
    if (trackAttendance) {
      nav.push({ href: `${base}/checkin`, icon: CheckSquare, label: "Check-In Desk" });
    }
    nav.push({ href: `${base}/form`, icon: FileEdit, label: "Registration Form" });
    nav.push({ href: `${base}/reports`, icon: BarChart2, label: "Reports" });
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar>
        <SidebarHeader className="p-3 border-b border-sidebar-border">
          {/* Back to events */}
          <Link href="/" onClick={close}>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground h-8 px-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Events
            </Button>
          </Link>

          {/* Event identity */}
          {event ? (
            <div className="mt-2 px-2">
              <p className="font-serif font-bold text-sidebar-foreground text-base leading-tight line-clamp-2">
                {event.name}
              </p>
              <div className="mt-1">{registrationTypeBadge(event.registrationType)}</div>
            </div>
          ) : (
            <div className="mt-2 px-2 space-y-1.5">
              <div className="h-4 bg-sidebar-accent/40 rounded animate-pulse" />
              <div className="h-3 bg-sidebar-accent/30 rounded w-2/3 animate-pulse" />
            </div>
          )}
        </SidebarHeader>

        <SidebarContent className="px-2 mt-3">
          <SidebarMenu>
            {nav.map((item) => (
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
        </SidebarContent>

        <SidebarFooter className="p-2">
          <SidebarMenu>
            <NavLink
              href={`${base}/settings`}
              icon={Settings}
              label="Event Settings"
              active={isActive(`${base}/settings`)}
              onClick={close}
            />
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
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
      </main>
    </div>
  );
}
