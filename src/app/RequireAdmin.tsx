import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { useUsers } from "./usersStore";

export default function RequireAdmin({ children }: { children: ReactElement }) {
  const { currentUser, usersReady } = useUsers();

  if (!usersReady) {
    return <div className="p-4 text-sm opacity-70">Checking permissions...</div>;
  }

  if (currentUser?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}
