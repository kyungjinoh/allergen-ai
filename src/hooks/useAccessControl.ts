import { useAuth } from '../AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';

export const useAccessControl = (checkAccess: boolean = true) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const uniqueId = null as string | null;

  // This app previously used a uniqueId allowlist to gate access to dashboard routes.
  // We intentionally disable that “passkey” behavior: any signed-in user can access.
  const isRestrictedRoute = false;
  const hasAccess = true;

  // Redirect unauthenticated users when access checks are enabled.
  useEffect(() => {
    if (!checkAccess) return;
    if (!user) navigate('/signin');
  }, [checkAccess, user, navigate, location.pathname]);

  return {
    user,
    hasAccess,
    redirectIfNoAccess: () => {
      if (!user) navigate('/signin');
    },
    ALLOWED_UNIQUE_IDS: [] as string[],
    isRestrictedRoute,
    uniqueId,
    loading
  };
}; 
