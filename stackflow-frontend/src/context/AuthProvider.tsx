import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import axios from "axios";
import { AuthContext } from "./auth";
import {
  clearSession,
  errorMessage,
  refreshSession,
  saveSession,
} from "@/utils/api";
import { logout } from "@/services/workspace";
import type { Session, User } from "@/types";
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    refreshSession()
      .then((session) => {
        if (current) setUser(session.user);
      })
      .catch((e) => {
        if (!current) return;
        if (!axios.isAxiosError(e) || e.response?.status !== 401)
          setError(errorMessage(e));
        clearSession();
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    const expired = () => {
      setUser(null);
      setError("");
    };
    window.addEventListener("session-expired", expired);
    return () => {
      current = false;
      window.removeEventListener("session-expired", expired);
    };
  }, [attempt]);
  const accept = (session: Session) => {
    setNotice("");
    saveSession(session);
    setUser(session.user);
    setError("");
  };
  const signOut = async () => {
    await logout();
    clearSession();
    setUser(null);
  };
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        notice,
        endSession: (message) => { clearSession(); setUser(null); setError(""); setNotice(message); },
        accept,
        signOut,
        retry: () => {
          setLoading(true);
          setError("");
          setAttempt((a) => a + 1);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
