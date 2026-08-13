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

interface AuthContextType {
  currentUser: TestUser;
  switchUser: (userId: string) => void;
  currentOrgId: string;
  currentRole: UserRole;
  orgUsage: OrgUsageSummary | null;
  refreshOrgUsage: () => Promise<void>;
  allUsers: TestUser[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<TestUser>(TEST_USERS[0]);
  const [orgUsage, setOrgUsage] = useState<OrgUsageSummary | null>(null);

  const switchUser = (userId: string) => {
    const user = TEST_USERS.find(u => u.id === userId);
    if (user) {
      setCurrentUser(user);
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
