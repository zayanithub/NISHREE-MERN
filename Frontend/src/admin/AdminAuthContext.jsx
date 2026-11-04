import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi, restoreAdminSession, setAdminAccessToken } from './adminApi';
import { AdminAuthContext } from './adminAuthStore';
import { useIdleLogout } from '../auth/useIdleLogout';

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    restoreAdminSession().then((sessionAdmin) => { if (active) setAdmin(sessionAdmin); }).finally(() => { if (active) setLoading(false); });
    const expire = () => {
      if (active) {
        window.localStorage.removeItem('nishree-admin-last-activity');
        setAdmin(null);
      }
    };
    const refresh = (event) => { if (active && event.detail?.admin) setAdmin(event.detail.admin); };
    window.addEventListener('nishree:admin-session-expired', expire);
    window.addEventListener('nishree:admin-session-refreshed', refresh);
    return () => { active = false; window.removeEventListener('nishree:admin-session-expired', expire); window.removeEventListener('nishree:admin-session-refreshed', refresh); };
  }, []);

  const login = useCallback(async (credentials) => {
    const session = await adminApi.login(credentials);
    if (session.accessToken) {
      setAdminAccessToken(session.accessToken);
      setAdmin(session.admin || null);
    }
    return session;
  }, []);
  const verifyLoginOtp = useCallback(async (challenge) => {
    const session = await adminApi.verifyLoginOtp(challenge);
    window.localStorage.setItem('nishree-admin-last-activity', String(Date.now()));
    setAdminAccessToken(session.accessToken);
    setAdmin(session.admin || null);
    return session.admin || null;
  }, []);
  const resendLoginOtp = useCallback((challenge) => adminApi.resendLoginOtp(challenge), []);
  const logout = useCallback(async () => {
    const request = adminApi.logout();
    window.localStorage.removeItem('nishree-admin-last-activity');
    setAdminAccessToken(null);
    setAdmin(null);
    await request;
  }, []);
  useIdleLogout(Boolean(admin), logout, 'nishree-admin-last-activity');
  const value = useMemo(() => ({ admin, loading, login, verifyLoginOtp, resendLoginOtp, logout }), [admin, loading, login, verifyLoginOtp, resendLoginOtp, logout]);
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}
