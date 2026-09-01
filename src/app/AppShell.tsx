import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "./authStore";
import { useUsers } from "./usersStore";
import { useChecks } from "./checksStore";
import ThemeToggle from "../components/ThemeToggle";
import epclogo from "../assets/epclogo.svg";
import haulogo from "../assets/HAU-logo-schwarz.svg";
import htlogo from "../assets/HT-logo-schwarz.svg";

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? "btn btn-ghost btn-sm font-semibold" : "btn btn-ghost btn-sm";
}

export function AppShell() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { currentUser } = useUsers();
  const { notifications, pendingSyncCount, dismissNotification, syncPendingChecks } = useChecks();
  const isAdmin = currentUser?.role === "admin";
  const hasPendingSync = pendingSyncCount > 0;

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <div className="navbar bg-base-100 shadow-sm p-4 mx-auto">
        <div className="navbar-start">
          <div className="dropdown">
            <div tabIndex={0} role="button" className="btn btn-ghost lg:hidden">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h8m-8 6h16" /> </svg>
            </div>
            <ul tabIndex={-1} className="menu menu-sm dropdown-content bg-base-300 rounded-box z-1 mt-3 w-52 p-2 shadow-lg">
              <li><NavLink to="/" className={navClass} end>New Check</NavLink></li>
              <li><NavLink to="/history" className={navClass}>History</NavLink></li>
              {isAdmin && <li><NavLink to="/admin" className={navClass}>Admin</NavLink></li>}
            </ul>
          </div>
          <Link to="/">
            <img src={epclogo} className="min-w-32 mx-6"/>
          </Link>
        </div>

        <div className="navbar-center hidden lg:flex">
          <ul className="menu menu-horizontal px-1">
            <li><NavLink to="/" className={navClass} end>New Check</NavLink></li>
            <li><NavLink to="/history" className={navClass}>History</NavLink></li>
            {isAdmin && <li><NavLink to="/admin" className={navClass}>Admin</NavLink></li>}
          </ul>
        </div>

        <div className="navbar-end gap-3">
          <ThemeToggle />

          <div className="dropdown dropdown-end">
            <button className="btn btn-ghost btn-circle" tabIndex={0} type="button">
              <div className="indicator">
                <svg xmlns="http://www.w3.org/2000/svg" className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"> 
                  <path strokeLinecap="round" strokeLinejoin="round" 
                  strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /> 
                  </svg>
                {(pendingSyncCount > 0 || notifications.length > 0) && (
                  <span className="badge badge-xs badge-primary indicator-item">
                    {pendingSyncCount > 0 ? pendingSyncCount : ""}
                  </span>
                )}
              </div>
            </button>

            <div tabIndex={0} className="card card-compact dropdown-content bg-base-100 text-base-content z-20 mt-3 w-80 shadow-xl border border-base-300">
              <div className="card-body gap-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">Notifications</h3>
                  {hasPendingSync && (
                    <button className="btn btn-xs btn-outline" type="button" onClick={() => void syncPendingChecks()}>
                      Retry Sync
                    </button> 
                  )}
                </div>

                {notifications.length === 0 ? (
                  <p className="text-sm opacity-70">You are doing a great job! {<br/>} So does this app. {":)"} LLY</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {notifications.map((item) => (
                      <div key={item.id} className={`alert ${item.kind === "success" ? "alert-success" : "alert-warning"}`}>
                        <div className="flex w-full items-start">
                          <span className="text-sm flex-1 pr-2">{item.message}</span>
                          <button
                            className="btn btn-ghost btn-xs shrink-0 justify-end-safe"
                            type="button"
                            onClick={() => dismissNotification(item.id)}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <details className="dropdown dropdown-end">
            <summary className="btn btn-ghost btn-circle">
              <div className=" rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="size-6">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>

              </div>
            </summary>
            <ul className="menu dropdown-content z-10 mt-2 w-52 rounded-box bg-base-200 m-2 gap-4 shadow-xl">
              <li className="p-2 text-xs">
                  {currentUser?.email}
              </li>
              <li>
                <button className=" btn btn-outline"
                  type="button"
                  onClick={() => {
                    logout();
                    navigate("/login", { replace: true });
                  }}
                >
                  Logout
                </button>
              </li>
            </ul>
          </details>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl flex-1 p-4">
        <Outlet />
      </main>

      <footer className="footer footer-center text-base-content rounded p-4 mt-auto">
        <aside>
          <label className="swap swap-flip">
            <input type="checkbox" />
            <div className="swap-on ">
              <img src={htlogo} className="max-h-12" />
            </div>
            <div className="swap-off">
              <img src={haulogo} className="max-h-15" />
            </div>
          </label>

          <p>© {new Date().getFullYear()} - Heli Austria GmbH - DEV VERSION 0.5.1</p>
        </aside>
      </footer>
    </div>
  );
}