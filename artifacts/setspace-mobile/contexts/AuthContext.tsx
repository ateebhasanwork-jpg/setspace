import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

const TOKEN_KEY = "setspace_auth_token";

let _currentToken: string | null = null;

export function getStoredToken(): string | null {
  return _currentToken;
}

type AuthContextType = {
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  token: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(TOKEN_KEY).then((t) => {
      if (t) {
        _currentToken = t;
        setToken(t);
      }
      setIsLoading(false);
    });
  }, []);

  const login = async (username: string, password: string) => {
    const res = await fetch(
      `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/mobile-auth/token-exchange`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    _currentToken = data.token;
    await AsyncStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
  };

  const logout = async () => {
    try {
      if (_currentToken) {
        await fetch(
          `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/mobile-auth/logout`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${_currentToken}` },
          },
        );
      }
    } catch {}
    _currentToken = null;
    await AsyncStorage.removeItem(TOKEN_KEY);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
