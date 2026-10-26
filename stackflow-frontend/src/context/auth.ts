import { createContext, useContext } from "react";
import type { Session, User } from "@/types";
export const AuthContext = createContext<{
  user: User | null;
  loading: boolean;
  error: string;
  notice: string;
  endSession: (notice: string) => void;
  accept: (session: Session) => void;
  signOut: () => Promise<void>;
  retry: () => void;
}>({
  user: null,
  loading: true,
  error: "",
  notice: "",
  endSession: () => { },
  accept: () => { },
  signOut: async () => { },
  retry: () => { },
});
export const useAuth = () => useContext(AuthContext);
