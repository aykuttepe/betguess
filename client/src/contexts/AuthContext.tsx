import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User } from '../lib/auth-types';
import { OtpDeliveryResult, RegisterResponse, apiGetMe, apiLogin, apiRegister, apiLogout } from '../lib/auth-api';
import { UNAUTHORIZED_EVENT } from '../lib/http';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string, phoneNumber?: string) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  lastRegisterOtpDelivery: OtpDeliveryResult | null;
  clearLastRegisterOtpDelivery: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRegisterOtpDelivery, setLastRegisterOtpDelivery] = useState<OtpDeliveryResult | null>(null);

  useEffect(() => {
    apiGetMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    function handleUnauthorized() {
      setUser(null);
      setLastRegisterOtpDelivery(null);
    }

    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await apiLogin(email, password);
    setUser(u);
  }, []);

  const register = useCallback(async (email: string, username: string, password: string, phoneNumber?: string) => {
    const result = await apiRegister(email, username, password, phoneNumber);
    setUser(result.user);
    setLastRegisterOtpDelivery(result.otpDelivery);
    return result;
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    setLastRegisterOtpDelivery(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const u = await apiGetMe();
      setUser(u);
    } catch { /* ignore */ }
  }, []);

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAdmin,
        login,
        register,
        logout,
        refreshUser,
        lastRegisterOtpDelivery,
        clearLastRegisterOtpDelivery: () => setLastRegisterOtpDelivery(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
