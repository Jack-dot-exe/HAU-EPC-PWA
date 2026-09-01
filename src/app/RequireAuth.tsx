import { useEffect, type ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./authStore";
import { useUsers } from "./usersStore";
import LoadingAnimation from "../components/LoadingAnimation";

export default function RequireAuth({ children }: { children: ReactElement }) {
  const { isAuthenticated, logout } = useAuth();
  const { currentUser, usersReady } = useUsers();
  const loc = useLocation();
  const hasValidAccess = !!currentUser && currentUser.isActive;

  useEffect(() => {
    if (usersReady && isAuthenticated && !hasValidAccess) {
      logout();
    }
  }, [hasValidAccess, isAuthenticated, logout, usersReady]);

  if (!usersReady) {
    return (
      <div className="grid place-items-center h-screen"> 
        <div className="flex flex-col items-center gap-5">
          <LoadingAnimation />
          <div className="opacity-75">
            Authenticating ...
          </div> 
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  if (!hasValidAccess) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  return children;
}
