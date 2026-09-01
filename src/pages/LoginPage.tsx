import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/authStore";
import { useUsers } from "../app/usersStore";
import { isSupabaseEnabled } from "../lib/supabase";
import EmailCheckForm from "../components/EmailCheckForm";
import PasswordPolicyChecklist from "../components/PasswordPolicyChecklist";
import {
  evaluatePasswordPolicy,
  isPasswordPolicyValid,
  PASSWORD_POLICY_ERROR_TEXT,
} from "../security/passwordPolicy";

import epclogo from "../assets/epclogo.svg";
import haulogo from "../assets/HAU-logo-schwarz.svg";
import backgroundImg from "../assets/ec135_top.svg";

type LoginFormProps = {
  email: string;
  password: string;
  showPassword: boolean;
  busy: boolean;
  onPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onBack: () => void;
  onSubmit: () => void;
};

function LoginForm(props: LoginFormProps) {
  return (
    <fieldset className="fieldset">
      <div className="text-sm opacity-70">Login for</div>
      <div className="font-mono mb-2">{props.email}</div>

      <label className="label">Password</label>
      <div className="relative">
        <input
          type={props.showPassword ? "text" : "password"}
          className="input w-full input-bordered pr-12"
          autoComplete="current-password"
          value={props.password}
          onChange={(e) => props.onPasswordChange(e.target.value)}
          placeholder="Password"
          onKeyDown={(e) => {
            if (e.key === "Enter" && props.password) props.onSubmit();
          }}
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm absolute right-1 top-1/2 -translate-y-1/2"
          onClick={props.onTogglePassword}
          aria-label={props.showPassword ? "Hide password" : "Show password"}
        >
          {props.showPassword ? "Hide" : "Show"}
        </button>
      </div>
      <div className="mt-4 flex gap-2">
        <button type="button" className="btn btn-outline flex-1" onClick={props.onBack} disabled={props.busy}>
          Back
        </button>
        <button
          className="btn btn-neutral flex-1"
          onClick={props.onSubmit}
          disabled={!props.password || props.busy}
        >
          {props.busy ? "Logging in..." : "Log in"}
        </button>
      </div>
    </fieldset>
  );
}

type InitialPasswordFormProps = {
  email: string;
  pw1: string;
  pw2: string;
  showPw1: boolean;
  showPw2: boolean;
  busy: boolean;
  onPw1Change: (value: string) => void;
  onPw2Change: (value: string) => void;
  onTogglePw1: () => void;
  onTogglePw2: () => void;
  onBack: () => void;
  onSubmit: () => void;
};

function InitialPasswordForm(props: InitialPasswordFormProps) {
  const rules = evaluatePasswordPolicy(props.pw1);
  const passwordValid = isPasswordPolicyValid(rules);
  const passwordsMatch = props.pw1.length > 0 && props.pw1 === props.pw2;

  return (
    <fieldset className="fieldset">
      <div className="text-sm opacity-70">Set initial password for</div>
      <div className="font-mono mb-2">{props.email}</div>

      <label className="label">New password</label>
      <div className="relative">
        <input
          type={props.showPw1 ? "text" : "password"}
          className="input input-bordered w-full pr-12"
          value={props.pw1}
          onChange={(e) => props.onPw1Change(e.target.value)}
          autoComplete="new-password"
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm absolute right-1 top-1/2 -translate-y-1/2"
          onClick={props.onTogglePw1}
          aria-label={props.showPw1 ? "Hide password" : "Show password"}
        >
          {props.showPw1 ? "Hide" : "Show"}
        </button>
      </div>

      <PasswordPolicyChecklist result={rules} />

      <label className="label mt-2">Confirm password</label>
      <div className="relative">
        <input
          type={props.showPw2 ? "text" : "password"}
          className="input input-bordered w-full pr-12"
          value={props.pw2}
          onChange={(e) => props.onPw2Change(e.target.value)}
          autoComplete="new-password"
          onKeyDown={(e) => {
            if (e.key === "Enter") props.onSubmit();
          }}
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm absolute right-1 top-1/2 -translate-y-1/2"
          onClick={props.onTogglePw2}
          aria-label={props.showPw2 ? "Hide password" : "Show password"}
        >
          {props.showPw2 ? "Hide" : "Show"}
        </button>
      </div>

      {props.pw2.length > 0 && !passwordsMatch && (
        <div className="mt-1 text-xs text-error">Passwords do not match.</div>
      )}

      <div className="mt-4 flex gap-2">
        <button type="button" className="btn btn-outline flex-1" onClick={props.onBack} disabled={props.busy}>
          Back
        </button>
        <button
          type="button"
          className="btn btn-primary flex-1"
          onClick={props.onSubmit}
          disabled={props.busy || !passwordValid || !passwordsMatch}
        >
          {props.busy ? "Saving..." : "Set Password"}
        </button>
      </div>
    </fieldset>
  );
}

export default function LoginPage() {
  const nav = useNavigate();
  const { loginWithToken, loginWithPassword, registerWithPassword } = useAuth();
  const { users, loginWithEmailPassword, ensureUserFromAuth, setUserPassword, updateUser } = useUsers();

  const [mode, setMode] = useState<"email" | "login" | "set-password">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const [initPw1, setInitPw1] = useState("");
  const [initPw2, setInitPw2] = useState("");
  const [showInitPw1, setShowInitPw1] = useState(false);
  const [showInitPw2, setShowInitPw2] = useState(false);

  const selectedUser = useMemo(
    () => users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase()) ?? null,
    [users, email]
  );

  function onCheckEmail() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    const u = users.find((x) => x.email.toLowerCase() === normalizedEmail) ?? null;
    if (!u) {
      alert("User not found");
      return;
    }
    if (!u.isActive) {
      alert("User is disabled");
      return;
    }

    const needsInitialPassword = isSupabaseEnabled
      ? u.passwordSalt === "__PENDING_INITIAL_PASSWORD__" || u.id.startsWith("u_")
      : !u.passwordSalt || !u.passwordHash || !u.passwordIterations;

    setPassword("");
    setShowPassword(false);
    setInitPw1("");
    setInitPw2("");
    setShowInitPw1(false);
    setShowInitPw2(false);
    setMode(needsInitialPassword ? "set-password" : "login");
  }

  async function onLogin() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    setBusy(true);
    try {
      if (isSupabaseEnabled) {
        const authUser = await loginWithPassword(normalizedEmail, password);
        const appUser = await ensureUserFromAuth(authUser.id, authUser.email);
        if (!appUser.isActive) {
          throw new Error("User is disabled");
        }
      } else {
        await loginWithEmailPassword(normalizedEmail, password);
        loginWithToken(`local_${Date.now()}`);
      }
      nav("/", { replace: true });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSetInitialPassword() {
    const normalizedEmail = email.trim().toLowerCase();
    const rules = evaluatePasswordPolicy(initPw1);
    const passwordValid = isPasswordPolicyValid(rules);
    const passwordsMatch = initPw1.length > 0 && initPw1 === initPw2;

    if (!normalizedEmail) {
      alert("Email is required.");
      return;
    }
    if (!passwordValid) {
      alert(PASSWORD_POLICY_ERROR_TEXT);
      return;
    }
    if (!passwordsMatch) {
      alert("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      if (isSupabaseEnabled) {
        const authUser = await registerWithPassword(normalizedEmail, initPw1);
        const appUser = await ensureUserFromAuth(authUser.id, authUser.email);
        if (!appUser.isActive) {
          throw new Error("User is disabled");
        }
        updateUser(appUser.id, {
          passwordSalt: "__SUPABASE_AUTH__",
          passwordHash: undefined,
          passwordIterations: undefined,
        });
      } else {
        if (!selectedUser) throw new Error("User not found.");
        await setUserPassword(selectedUser.id, initPw1);
      }

      setInitPw1("");
      setInitPw2("");
      setShowInitPw1(false);
      setShowInitPw2(false);
      setPassword("");
      setShowPassword(false);
      setMode("login");
      alert("Password set successfully. Please log in.");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to set password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">

      <div className="fixed inset-10 pointer-events-none overflow-visible">
        <img src={backgroundImg} className="object-cover h-full -translate-x-1/2"/>
      </div>

      <div className="hero flex-1">
        <div className="hero-content md:mx-25 flex-col lg:flex-row-reverse">
          <div className="grid grid-cols-1 m-5">
            <div className="justify-self-center lg:justify-self-start bg-base-200">
              <img src={epclogo} className="min-h-24 " />
            </div>

            <div className="text-center lg:text-left lg:w-sm max-w-sm">
              <h1 className="text-5xl font-bold py-6 bg-base-200">Login now!</h1>
              <p className="bg-base-200">
                A dream come true. Log-In and experience Engine Power Checks at a new level. Enter your EPCs now or stay silent forever!
              </p>
            </div>
          </div>

          <div className="card bg-base-100 w-full max-w-sm shrink-0 shadow-2xl">
            <div className="card-body">
              {mode === "email" && (
                <EmailCheckForm
                  email={email}
                  busy={busy}
                  onEmailChange={setEmail}
                  onSubmit={onCheckEmail}
                />
              )}

              {mode === "login" && (
                <LoginForm
                  email={email}
                  password={password}
                  showPassword={showPassword}
                  busy={busy}
                  onPasswordChange={setPassword}
                  onTogglePassword={() => setShowPassword((v) => !v)}
                  onBack={() => {
                    setMode("email");
                    setPassword("");
                    setShowPassword(false);
                  }}
                  onSubmit={onLogin}
                />
              )}

              {mode === "set-password" && (
                <InitialPasswordForm
                  email={email}
                  pw1={initPw1}
                  pw2={initPw2}
                  showPw1={showInitPw1}
                  showPw2={showInitPw2}
                  busy={busy}
                  onPw1Change={setInitPw1}
                  onPw2Change={setInitPw2}
                  onTogglePw1={() => setShowInitPw1((v) => !v)}
                  onTogglePw2={() => setShowInitPw2((v) => !v)}
                  onBack={() => {
                    setMode("email");
                    setInitPw1("");
                    setInitPw2("");
                  }}
                  onSubmit={onSetInitialPassword}
                />
              )}

              <div className="text-xs opacity-70 pt-5">
                <p className="">For first time log-in's:</p>
                <p>A new password can be selected after a profile with your email adress has been created by an admin.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pb-4 pt-2 flex justify-center">
        <img src={haulogo} className="w-40" />
      </div>
    </div>
  );
}
