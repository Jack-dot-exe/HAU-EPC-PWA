import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./AppShell";
import NewCheckPage from "../pages/NewCheckPage";
import HistoryPage from "../pages/HistoryPage";
import AdminPage from "../pages/AdminPage";
import LoginPage from "../pages/LoginPage";
import RequireAuth from "./RequireAuth";
import RequireAdmin from "./RequireAdmin";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <NewCheckPage /> },
      { path: "history", element: <HistoryPage /> },
      {
        path: "admin",
        element: (
          <RequireAdmin>
            <AdminPage />
          </RequireAdmin>
        ),
      },
    ],
  },
]);
