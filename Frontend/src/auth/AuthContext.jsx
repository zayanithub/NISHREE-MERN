import { useCallback, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/authApi';
import { setAccessToken } from '../api/client';
import { AuthContext } from './AuthStore';
import { useIdleLogout } from './useIdleLogout';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const acceptSession = useCallback((data) => {
    setAccessToken(data?.accessToken);
    setUser(data?.user || null);
    return data?.user || null;
  }, []);

  useEffect(() => {
    let active = true;
    const restore = async () => {
      try {
        const refreshed = await authApi.refresh();
        if (!active) return;
        acceptSession(refreshed);
      } catch (error) {
        if (active) {
          setAccessToken(null);
          setUser(null);
          console.error('Customer session restore failed:', error.message);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    const onExpired = () => {
      if (active) {
        window.localStorage.removeItem('nishree-customer-last-activity');
        setUser(null);
      }
    };
    const onRefreshed = (event) => {
      if (active && event.detail?.user) setUser(event.detail.user);
    };
    window.addEventListener('nishree:session-expired', onExpired);
    window.addEventListener('nishree:session-refreshed', onRefreshed);
    restore();

    return () => {
      active = false;
      window.removeEventListener('nishree:session-expired', onExpired);
      window.removeEventListener('nishree:session-refreshed', onRefreshed);
    };
  }, [acceptSession]);

  const login = useCallback(async (credentials) => {
    const session = await authApi.login(credentials);
    window.localStorage.setItem('nishree-customer-last-activity', String(Date.now()));
    acceptSession(session);
    return session;
  }, [acceptSession]);
  const register = useCallback((details) => authApi.register(details), []);
  const verifyRegistrationEmail = useCallback(async (challenge) => {
    const session = await authApi.verifyRegistrationEmail(challenge);
    window.localStorage.setItem('nishree-customer-last-activity', String(Date.now()));
    acceptSession(session);
    return session;
  }, [acceptSession]);
  const resendRegistrationOtp = useCallback(
    (challenge) => authApi.resendRegistrationOtp(challenge),
    [],
  );
  const verifyGoogleOtp = useCallback(async (challenge) => {
    const session = await authApi.verifyGoogleOtp(challenge);
    window.localStorage.setItem('nishree-customer-last-activity', String(Date.now()));
    acceptSession(session);
    return session;
  }, [acceptSession]);
  const resendGoogleOtp = useCallback(
    (challenge) => authApi.resendGoogleOtp(challenge),
    [],
  );
  const logout = useCallback(async () => {
    const request = authApi.logout();
    window.localStorage.removeItem('nishree-customer-last-activity');
    setAccessToken(null);
    setUser(null);
    await request;
  }, []);
  useIdleLogout(Boolean(user), logout, 'nishree-customer-last-activity');

  const updateUser = useCallback((changes) => {
    setUser((current) => current ? { ...current, ...changes } : current);
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    login,
    register,
    verifyRegistrationEmail,
    resendRegistrationOtp,
    verifyGoogleOtp,
    resendGoogleOtp,
    logout,
    updateUser,
  }), [user, loading, login, register, verifyRegistrationEmail, resendRegistrationOtp, verifyGoogleOtp, resendGoogleOtp, logout, updateUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
