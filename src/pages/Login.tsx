/* Sign-in against the Worksuite API.
   The form validates locally, reports whatever the server says when it refuses,
   and only navigates once a session actually exists. */
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { isEmail } from "@/lib/mail";
import { login, setCurrentUser } from "@/lib/store";
import { roleById, roleIdFromKeys } from "@/lib/roles";

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const from = (loc.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/dashboard";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isEmail(email)) return setError("Enter a valid email address");
    if (!password) return setError("Enter your password");

    setBusy(true);
    let session: Awaited<ReturnType<typeof api.login>>;
    try {
      session = await api.login(email.trim(), password);
    } catch (err) {
      setBusy(false);
      // The server deliberately gives the same message for a wrong password and
      // an unknown address, so pass it through rather than guessing.
      return setError(
        err instanceof ApiError && err.status !== 0
          ? err.message
          : "Can't reach the server. Check that the API is running."
      );
    }
    setBusy(false);

    const user = session.user;
    const roleId = roleIdFromKeys(user.roles);
    setCurrentUser({ id: user.id, name: user.name, email: user.email, roleId });
    login();
    // Land on the portal for the widest role this account holds.
    nav(from === "/dashboard" ? roleById(roleId).home : from, { replace: true });
  };

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="card w-full max-w-sm p-7 sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[#4cc3ff] text-2xl font-black text-white">
            W
          </span>
          <h1 className="font-display text-xl font-bold">Sign in to Worksuite</h1>
          <p className="text-sm text-muted">Use your Worksuite account</p>
        </div>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <label className="block">
            <span className="lbl">Email</span>
            <input
              className="input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(error) && !isEmail(email)}
            />
          </label>

          <label className="block">
            <span className="lbl">Password</span>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && (
            <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" defaultChecked className="accent-primary" /> Remember me
            </label>
            <button
              type="button"
              className="cursor-pointer text-primary hover:underline"
              onClick={() => setError("Ask an administrator to reset your password")}
            >
              Forgot password?
            </button>
          </div>

          <button className="btn-primary w-full justify-center py-2.5" disabled={busy}>
            {busy && <Loader2 size={15} className="animate-spin" />}
            {busy ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
