import { ui, useUiLanguage } from "@/i18n/ui";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function Auth() {
  useUiLanguage();
  const { signIn, signUp } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // /login?register opens on the Register tab, for links that say "create an account".
  const [isRegistering, setIsRegistering] = useState(() => new URLSearchParams(window.location.search).has("register"));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter an email and password.");
      return;
    }

    setBusy(true);

    try {
      if (isRegistering) {
        const { error, needsEmailConfirmation } = await signUp(email.trim(), password);

        if (error) {
          setError(error.message);
          return;
        }

        setMessage(needsEmailConfirmation ? "Check your email and confirm your account using the confirmation link. No email yet? Please also check your spam or junk folder." : "Account created successfully!");
      } else {
        const { error } = await signIn(email.trim(), password);

        if (error) {
          setError(error.message);
          return;
        }

        setMessage("Logged in successfully!");
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  function toggleMode() {
    setIsRegistering((value) => !value);
    setError("");
    setMessage("");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-transparent px-4 py-8 text-zinc-100 sm:px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[-10%] h-[420px] w-[420px] rounded-full bg-emerald-400/[0.08] blur-3xl" />
        <div className="absolute bottom-[-15%] right-[-10%] h-[460px] w-[460px] rounded-full bg-amber-300/[0.06] blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[var(--app-height)] max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[32px] border border-white/10 bg-zinc-900/75 shadow-2xl shadow-black/40 backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr]">
          <section className="relative hidden min-h-[680px] overflow-hidden border-r border-white/10 p-10 lg:block">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(52,211,153,0.12),transparent_34%),radial-gradient(circle_at_80%_75%,rgba(251,191,36,0.08),transparent_28%)]" />

            <div className="relative flex h-full flex-col justify-between">
              <div>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-zinc-300 transition hover:bg-white/10 hover:text-white"
                >{ui("← Back to home")}</Link>

                <p className="mt-12 text-xs font-black uppercase tracking-[0.26em] text-emerald-300">{ui("Game Hub")}</p>

                <h1 className="mt-4 max-w-xl text-5xl font-black tracking-tight text-white">{ui("One account for your games, ratings and progress.")}</h1>

                <p className="mt-5 max-w-lg text-base leading-7 text-zinc-400">{ui("Sign in to keep your chess and Watten experience connected across the site.")}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["♟", "Chess", "Classic, 3D and variants"],
                  ["🃏", "Watten", "Local and multiplayer modes"],
                  ["★", "Profile", "Ratings and saved progress"],
                ].map(([icon, title, description]) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="text-2xl">{icon}</div>

                    <h2 className="mt-3 text-sm font-black text-white">
                      {ui(title)}
                    </h2>

                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      {ui(description)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="flex items-center p-6 sm:p-10">
            <div className="mx-auto w-full max-w-md">
              <div className="lg:hidden">
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-zinc-300 transition hover:bg-white/10"
                >{ui("← Back")}</Link>
              </div>

              <p className="mt-8 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300 lg:mt-0">{ui("Account")}</p>

              <h2 className="mt-2 text-3xl font-black text-white">
                {isRegistering ? ui("Create your account") : ui("Welcome back")}
              </h2>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                {isRegistering ? ui("Create an account to save your profile and progress.") : ui("Sign in to continue to your profile and games.")}
              </p>

              <div className="mt-7 grid grid-cols-2 rounded-xl border border-white/10 bg-black/20 p-1">
                <button
                  type="button"
                  onClick={() => {
                    if (isRegistering) {
                      toggleMode();
                    }
                  }}
                  className={`rounded-lg px-4 py-2.5 text-xs font-black transition ${
                    !isRegistering
                      ? "bg-emerald-300 text-zinc-950"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >{ui("Login")}</button>

                <button
                  type="button"
                  onClick={() => {
                    if (!isRegistering) {
                      toggleMode();
                    }
                  }}
                  className={`rounded-lg px-4 py-2.5 text-xs font-black transition ${
                    isRegistering
                      ? "bg-emerald-300 text-zinc-950"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >{ui("Register")}</button>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <label className="block">
                  <span className="text-xs font-bold text-zinc-400">{ui("Email")}</span>

                  <input
                    type="email"
                    placeholder={ui("you@example.com")}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-emerald-300/50 focus:ring-2 focus:ring-emerald-300/10"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold text-zinc-400">{ui("Password")}</span>

                  <input
                    type="password"
                    placeholder={ui("••••••••")}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={
                      isRegistering ? "new-password" : "current-password"
                    }
                    className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-emerald-300/50 focus:ring-2 focus:ring-emerald-300/10"
                  />
                </label>

                {error && (
                  <div className="rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-xs leading-5 text-red-200">
                    {ui(error)}
                  </div>
                )}

                {message && (
                  <div role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3 text-xs leading-5 text-emerald-200">
                    {ui(message)}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-xl bg-emerald-300 px-5 py-3.5 text-sm font-black text-zinc-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? ui("Please wait...") : isRegistering ? ui("Create Account") : ui("Login")}
                </button>
              </form>
              {!isRegistering && <Link to="/login?mode=forgot" className="mt-4 inline-block text-sm font-bold text-emerald-300 hover:underline">{ui("Forgot password?")}</Link>}

              <button
                type="button"
                onClick={toggleMode}
                className="mt-5 w-full text-center text-xs font-bold text-zinc-500 transition hover:text-emerald-300"
              >
                {isRegistering ? ui("Already have an account? Login") : ui("Need an account? Sign up")}
              </button>

              <div className="mt-8 border-t border-white/5 pt-5 text-center">
                <Link
                  to="/credits"
                  className="text-xs font-bold text-zinc-600 transition hover:text-zinc-300"
                >{ui("Credits & licenses")}</Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
