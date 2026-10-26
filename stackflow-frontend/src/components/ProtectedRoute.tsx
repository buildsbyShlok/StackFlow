import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/auth";
import { ErrorState, Loading } from "./common";
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.loading)
    return (
      <div className="boot-screen">
        <Loading />
      </div>
    );
  if (auth.error)
    return (
      <div className="boot-screen">
        <ErrorState message={auth.error} retry={auth.retry} />
      </div>
    );
  if (!auth.user)
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}
