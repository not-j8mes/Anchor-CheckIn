import { Link, useLocation } from "wouter";
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
import { useGetOrganization } from "@workspace/api-client-react";
import {
  LayoutDashboard,
  Settings,
  CalendarDays,
  LogOut,
} from "lucide-react";
import appLogo from "@assets/image_1781393408862.png";
import { useAuth } from "@/lib/auth";

const DEFAULT_ORGANIZATION_NAME = "Anchor Events - Check In and Registration";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: org } = useGetOrganization();
  const { user, logout } = useAuth();
  const { setOpenMobile } = useSidebar();
  const brandLogo = org?.logoUrl || appLogo;
  const brandName = org?.name || DEFAULT_ORGANIZATION_NAME;

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Events", href: "/events", icon: CalendarDays },
  ];

  async function handleLogout() {
    await logout();
    window.location.href = "/login";
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar>
        <SidebarHeader className="p-4 flex flex-row items-center gap-2 text-sidebar-primary">
          <img src={brandLogo} alt={`${brandName} logo`} className="w-8 h-8 object-contain" />
          <span className="font-serif font-bold text-lg text-sidebar-foreground">
            {brandName}
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
            {user && (
              <SidebarMenuItem className="mb-2 px-3 py-2 rounded-md border border-sidebar-border bg-sidebar-accent/20">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-sidebar-foreground/60 truncate">{user.email}</p>
              </SidebarMenuItem>
            )}
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
            <SidebarMenuItem>
              <button
                type="button"
                className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors w-full text-sidebar-foreground hover:bg-sidebar-accent/50"
                onClick={handleLogout}
              >
                <LogOut className="w-5 h-5 text-sidebar-foreground/70" />
                <span>Logout</span>
              </button>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile-only top bar with hamburger to open sidebar */}
        <div className="flex md:hidden sticky top-0 z-10 items-center gap-3 px-4 h-14 border-b border-border bg-background/95 backdrop-blur shrink-0">
          <SidebarTrigger className="h-8 w-8" />
          <span className="font-semibold text-sm">{brandName}</span>
        </div>
        {children}
      </main>
    </div>
  );
}
