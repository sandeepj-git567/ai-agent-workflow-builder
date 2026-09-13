import React, { createContext, useContext, useState, useEffect } from 'react';
import { TEST_USERS } from '@/pages/api/auth/users';
import { UserRole, OrgUsageSummary } from '@/types';
import { fetchGraphQL } from '@/lib/graphqlClient';

export interface TestUser {
  id: string;
  email: string;
  name: string;
  orgId: string;
  orgName: string;
  role: string;
}

export interface RealtimeEvent {
  id: string;
  type: string;
  orgId: string;
  userId: string;
  payload: any;
  timestamp: string;
}

interface AuthContextType {
  currentUser: TestUser;
  switchUser: (userId: string) => void;
  currentOrgId: string;
  currentRole: UserRole;
  orgUsage: OrgUsageSummary | null;
  refreshOrgUsage: () => Promise<void>;
  allUsers: TestUser[];
  lastRealtimeEvent: RealtimeEvent | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<TestUser>(() => {
    if (typeof window !== 'undefined') {
      const savedId = localStorage.getItem('agentflow_active_user');
      const found = TEST_USERS.find(u => u.id === savedId);
      if (found) return found;
    }
    return TEST_USERS[0];
  });

  const [orgUsage, setOrgUsage] = useState<OrgUsageSummary | null>(null);
  const [lastRealtimeEvent, setLastRealtimeEvent] = useState<RealtimeEvent | null>(null);

  const switchUser = (userId: string) => {
    const user = TEST_USERS.find(u => u.id === userId);
    if (user) {
      setCurrentUser(user);
      if (typeof window !== 'undefined') {
        localStorage.setItem('agentflow_active_user', user.id);
      }
    }
  };

  const refreshOrgUsage = async () => {
    try {
      const data = await fetchGraphQL({
        query: `
          query GetUsageSummary($org_id: uuid!) {
            organization_usage_summary(where: { org_id: { _eq: $org_id } }) {
              org_id
              name
              calls_used
              calls_allowed
              remaining
            }
          }
        `,
        variables: { org_id: currentUser.orgId },
        userId: currentUser.id,
        role: currentUser.role,
      });

      if (data?.organization_usage_summary?.[0]) {
        setOrgUsage(data.organization_usage_summary[0]);
      }
    } catch (err) {
      console.warn('[AuthContext] Error loading org usage:', err);
    }
  };

  useEffect(() => {
    refreshOrgUsage();
  }, [currentUser]);

  // Real-time Event Connection (SSE + Polling Fallback)
  useEffect(() => {
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(`/api/events/notification?org_id=${currentUser.orgId}&user_id=${currentUser.id}`);
      eventSource.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed.type && parsed.type !== 'ping' && parsed.type !== 'connected') {
            setLastRealtimeEvent(parsed);
            refreshOrgUsage();
          }
        } catch {}
      };
    } catch (err) {
      console.warn('SSE EventSource not supported, using poll fallback');
    }

    // Interval polling backup every 3 seconds for real-time syncing
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/events/notification?org_id=${currentUser.orgId}&poll=true`);
        const data = await res.json();
        if (data.events && data.events.length > 0) {
          const latest = data.events[0];
          setLastRealtimeEvent(prev => (prev?.id !== latest.id ? latest : prev));
        }
      } catch {}
    }, 3000);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(interval);
    };
  }, [currentUser.orgId, currentUser.id]);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        switchUser,
        currentOrgId: currentUser.orgId,
        currentRole: currentUser.role as UserRole,
        orgUsage,
        refreshOrgUsage,
        allUsers: TEST_USERS,
        lastRealtimeEvent,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
