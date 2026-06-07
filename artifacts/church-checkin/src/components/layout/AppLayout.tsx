import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenuItem,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar";
import { useGetOrganization } from "@workspace/api-client-react";
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Settings,
  Church,
  CalendarDays,
} from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: org } = useGetOrganization();
  const { setOpenMobile } = useSidebar();

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Events", href: "/events", icon: CalendarDays },
    { name: "Check-In Kiosk", href: "/checkin", icon: CheckSquare },
  ];

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar>
        <SidebarHeader className="p-4 flex flex-row items-center gap-2 text-sidebar-primary">
          <Church className="w-8 h-8" />
          <span className="font-serif font-bold text-lg text-sidebar-foreground">
            {org?.name || "Church Check-In"}
          </span>
        </SidebarHeader>
        <SidebarContent className="px-2 mt-4">
          <SidebarMenu>
            {navigation.map((item) => {
              const isActive =
                location === item.href ||
                (item.href !== "/" && location.startsWith(item.href));
              return (
                <SidebarMenuItem key={item.name} className="mb-1">
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors w-full ${
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    }`}
                    onClick={() => setOpenMobile(false)}
                  >
                    <item.icon
                      className={`w-5 h-5 ${
                        isActive ? "text-sidebar-primary" : "text-sidebar-foreground/70"
                      }`}
                    />
                    <span>{item.name}</span>
                  </Link>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <Link
                href="/settings"
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors w-full ${
                  location.startsWith("/settings")
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                }`}
                onClick={() => setOpenMobile(false)}
              >
                <Settings
                  className={`w-5 h-5 ${
                    location.startsWith("/settings")
                      ? "text-sidebar-primary"
                      : "text-sidebar-foreground/70"
                  }`}
                />
                <span>Settings</span>
              </Link>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
