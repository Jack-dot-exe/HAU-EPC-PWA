import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/routes";

import { AuthProvider } from "./app/authStore";
import { ChecksProvider } from "./app/checksStore";
import { ProfilesProvider } from "./app/profileStore";
import { RegistrationsProvider } from "./app/registrationStore";
import { UsersProvider } from "./app/usersStore";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <UsersProvider>
        <ProfilesProvider>
          <RegistrationsProvider>
            <ChecksProvider>
              <RouterProvider router={router} />
            </ChecksProvider>
          </RegistrationsProvider>
        </ProfilesProvider>
      </UsersProvider>
    </AuthProvider>
  </React.StrictMode>
);
 
