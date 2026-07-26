import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

interface AuthUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  username: string | null;
  isSuperAdmin: boolean;
}

interface AuthOrganization {
  id: number;
  name: string;
  role: "owner" | "admin" | "staff";
  permissions: OrganizationPermission[];
  subscriptionStatus: string;
  plan: string;
}

export const ORGANIZATION_PERMISSIONS = [
  "events",
  "checkin",
  "registrations",
  "rooms",
  "staff",
  "forms",
  "reports",
  "event_settings",
  "org_settings",
] as const;

export type OrganizationPermission =
  (typeof ORGANIZATION_PERMISSIONS)[number];

interface AuthResponse {
  user: AuthUser;
  organization: AuthOrganization | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  organization: AuthOrganization | null;
  isLoading: boolean;
  login: (identifier: string, password: string, staySignedIn: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function parseAuthResponse(response: Response): Promise<AuthResponse> {
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Authentication failed");
  }
  return response.json() as Promise<AuthResponse>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [organization, setOrganization] = useState<AuthOrganization | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);

  const applyAuth = useCallback((data: AuthResponse | null) => {
    setUser(data?.user ?? null);
    setOrganization(data?.organization ?? null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "same-origin",
      });
      if (!response.ok) {
        applyAuth(null);
        return;
      }
      applyAuth(await parseAuthResponse(response));
    } catch {
      applyAuth(null);
    } finally {
      setIsLoading(false);
    }
  }, [applyAuth]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (identifier: string, password: string, staySignedIn: boolean) => {
      const data = await parseAuthResponse(
        await fetch("/api/auth/login", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ identifier, password, staySignedIn }),
        }),
      );
      applyAuth(data);
    },
    [applyAuth],
  );

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    applyAuth(null);
  }, [applyAuth]);

  const value = useMemo(
    () => ({ user, organization, isLoading, login, logout, refresh }),
    [user, organization, isLoading, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

export function usePermission(permission: OrganizationPermission): boolean {
  const { organization } = useAuth();
  return Boolean(
    organization &&
      (organization.role === "owner" ||
        organization.permissions.includes(permission)),
  );
}
