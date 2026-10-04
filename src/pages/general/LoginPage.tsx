import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useAppLanguage } from "@/i18n/languageStore";

type LoginMode = "login" | "register";
type Language = "de" | "en";

const translations = {
  de: {
    backHome: "← Zurück zur Startseite",
    back: "← Zurück",
    hubEyebrow: "Dein Spiele-Hub",
    heroTitle: "Pluto",
    heroText:
      "Spiele verschiedene Games mit deinem Konto und behalte deinen persönlichen Spielverlauf an einem Ort.",
    chess: "Schach",
    chessText: "Klassisch und Varianten",
    watten: "Watten",
    wattenText: "Lokal- und Mehrspielermodi",
    schafkopf: "Schafkopf",
    schafkopfText: "Traditionelles bayerisches Kartenspiel",
    medievalKingdoms: "Medieval Kingdoms",
    medievalKingdomsText: "Rundenbasierte mittelalterliche Strategie",
    multiplayerOnly: "Nur angemeldete Benutzer können Multiplayer spielen!",
    continueGuest: "Ohne Konto fortfahren",
    account: "Konto",
    welcome: "Willkommen zurück",
    createAccount: "Konto erstellen",
    loginIntro:
      "Melde dich an, um zu deinem Profil und deinen Spielen zu gelangen.",
    registerIntro: "Erstelle ein Konto, um deinen Fortschritt zu speichern.",
    login: "Anmelden",
    register: "Registrieren",
    email: "E-Mail",
    password: "Passwort",
    confirmPassword: "Passwort bestätigen",
    pleaseEnter: "Bitte gib deine E-Mail-Adresse und dein Passwort ein.",
    mismatch: "Die Passwörter stimmen nicht überein.",
    loginNotConnected: "Die Anmeldung ist noch nicht verbunden.",
    registerNotConnected: "Die Registrierung ist noch nicht verbunden.",
    genericError: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
    wait: "Bitte warten...",
    signIn: "Anmelden",
    create: "Konto erstellen",
    terms:
      "Mit der Nutzung der Website stimmst du den Nutzungsbedingungen zu und bestätigst die Hinweise zu Drittsoftware und verwendeten Assets.",
    credits: "Credits & Lizenzen",
    imprint: "Impressum",
    confirmation: "Prüfe deine E-Mails und bestätige dein Konto über den Bestätigungslink.",
    spam: "Keine E-Mail erhalten? Schau bitte auch in deinem Spam- oder Junk-Ordner nach.",
    created: "Dein Konto wurde erstellt. Du kannst jetzt spielen.",
  },
  en: {
    backHome: "← Back to home",
    back: "← Back",
    hubEyebrow: "Your game hub",
    heroTitle: "Pluto",
    heroText:
      "Play different games with your account and keep your personal game history in one place.",
    chess: "Chess",
    chessText: "Classic and variants",
    watten: "Watten",
    wattenText: "Local and multiplayer modes",
    schafkopf: "Schafkopf",
    schafkopfText: "Traditional Bavarian card game",
    medievalKingdoms: "Medieval Kingdoms",
    medievalKingdomsText: "Turn-based medieval strategy",
    multiplayerOnly: "Only logged in users can play multiplayer!",
    continueGuest: "Continue without account",
    account: "Account",
    welcome: "Welcome back",
    createAccount: "Create your account",
    loginIntro: "Sign in to continue to your profile and games.",
    registerIntro: "Create an account to save your progress.",
    login: "Login",
    register: "Register",
    email: "Email",
    password: "Password",
    confirmPassword: "Confirm password",
    pleaseEnter: "Please enter your email and password.",
    mismatch: "Passwords do not match.",
    loginNotConnected: "Login is not connected yet.",
    registerNotConnected: "Registration is not connected yet.",
    genericError: "Something went wrong. Please try again.",
    wait: "Please wait...",
    signIn: "Sign in",
    create: "Create account",
    terms:
      "By using the site, you agree to the site terms and acknowledge the third-party software and asset credits.",
    credits: "Credits & licenses",
    imprint: "Imprint",
    confirmation: "Check your email and confirm your account using the confirmation link.",
    spam: "No email yet? Please also check your spam or junk folder.",
    created: "Your account has been created. You can now play.",
  },
} as const;

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<LoginMode>(() => searchParams.get("mode") === "register" ? "register" : "login");
  const { language: appLanguage, setLanguage } = useAppLanguage();
  const language: Language = appLanguage === "de" || appLanguage === "bar" ? "de" : "en";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [registrationStatus, setRegistrationStatus] = useState<"confirmation" | "created" | null>(null);

  const t = translations[language];

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);

    setMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setRegistrationStatus(null);

    if (!email.trim() || !password) {
      setMessage(t.pleaseEnter);
      return;
    }

    if (mode === "register" && password !== confirmPassword) {
      setMessage(t.mismatch);
      return;
    }

    setBusy(true);

    try {
      if (mode === "login") {
        const { error } = await signIn(email.trim(), password);

        if (error) {
          throw error;
        }

        navigate("/", { replace: true });
      } else {
        const { error, needsEmailConfirmation } = await signUp(email.trim(), password);

        if (error) {
          throw error;
        }

        setRegistrationStatus(needsEmailConfirmation ? "confirmation" : "created");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.genericError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-transparent px-4 py-8 text-zinc-100 sm:px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[-10%] h-[420px] w-[420px] rounded-full bg-emerald-400/[0.08] blur-3xl" />
        <div className="absolute bottom-[-15%] right-[-10%] h-[460px] w-[460px] rounded-full bg-amber-300/[0.06] blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[var(--app-height)] max-w-6xl items-center justify-center">
        <div className="relative grid w-full overflow-hidden rounded-[32px] border border-white/10 bg-zinc-900/75 shadow-2xl shadow-black/40 backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr]">
          {/* Language switch */}
          <div className="absolute right-5 top-5 z-30 flex rounded-xl border border-white/10 bg-black/35 p-1 backdrop-blur-md">
            {(["de", "en"] as Language[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => changeLanguage(item)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-black uppercase transition ${
                  language === item
                    ? "bg-emerald-300 text-zinc-950"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <section className="relative hidden min-h-[680px] overflow-hidden border-r border-white/10 p-10 lg:block">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(52,211,153,0.12),transparent_34%),radial-gradient(circle_at_80%_75%,rgba(251,191,36,0.08),transparent_28%)]" />

            <div className="relative flex h-full flex-col justify-between">
              <div>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-zinc-300 transition hover:bg-white/10"
                >
                  {t.backHome}
                </Link>

                <p className="mt-12 text-xs font-black uppercase tracking-[0.26em] text-emerald-300">
                  {t.hubEyebrow}
                </p>

                <h1 className="mt-4 max-w-xl text-5xl font-black tracking-tight text-white">
                  {t.heroTitle}
                </h1>
                <p className="mt-12 text-xs font-black uppercase tracking-[0.26em] text-emerald-300">
                  {t.heroText}
                </p>
              </div>

              <div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["♟", t.chess, t.chessText],
                    ["🃏", t.watten, t.wattenText],
                    ["♣", t.schafkopf, t.schafkopfText],
                    ["⚔", t.medievalKingdoms, t.medievalKingdomsText],
                  ].map(([icon, title, text]) => (
                    <div
                      key={title}
                      className="rounded-xl border border-white/10 bg-black/20 p-3"
                    >
                      <div className="text-lg">{icon}</div>

                      <h2 className="mt-2 text-xs font-black text-white">
                        {title}
                      </h2>

                      <p className="mt-1 text-[10px] leading-4 text-zinc-500">
                        {text}
                      </p>
                    </div>
                  ))}
                </div>
                {/* Guest access */}
                <div className="mt-6 flex w-full flex-col items-center border-t border-white/10 pt-5 text-center">
                  <p className="max-w-sm text-xs font-semibold leading-5 text-sky-200/90">
                    {t.multiplayerOnly}
                  </p>

                  <Link
                    to="/"
                    className="mt-3 inline-flex min-w-[220px] items-center justify-center gap-2 rounded-xl border border-sky-300/20 bg-sky-500 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-sky-500/20 transition hover:-translate-y-0.5 hover:bg-sky-400 active:translate-y-0 active:scale-[0.98]"
                  >
                    {t.continueGuest}
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <section className="flex items-center p-6 pt-20 sm:p-10 sm:pt-20 lg:pt-10">
            <div className="mx-auto w-full max-w-md">
              <div className="lg:hidden">
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-zinc-300"
                >
                  {t.back}
                </Link>
              </div>

              <p className="mt-8 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300 lg:mt-0">
                {t.account}
              </p>

              <h2 className="mt-2 text-3xl font-black text-white">
                {mode === "login" ? t.welcome : t.createAccount}
              </h2>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                {mode === "login" ? t.loginIntro : t.registerIntro}
              </p>

              <div className="mt-7 grid grid-cols-2 rounded-xl border border-white/10 bg-black/20 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setMessage(null);
                    setRegistrationStatus(null);
                  }}
                  className={`rounded-lg px-4 py-2.5 text-xs font-black transition ${
                    mode === "login"
                      ? "bg-emerald-300 text-zinc-950"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {t.login}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setMessage(null);
                    setRegistrationStatus(null);
                  }}
                  className={`rounded-lg px-4 py-2.5 text-xs font-black transition ${
                    mode === "register"
                      ? "bg-emerald-300 text-zinc-950"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {t.register}
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <label className="block">
                  <span className="text-xs font-bold text-zinc-400">
                    {t.email}
                  </span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-emerald-300/50 focus:ring-2 focus:ring-emerald-300/10"
                    placeholder="you@example.com"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold text-zinc-400">
                    {t.password}
                  </span>
                  <input
                    type="password"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-emerald-300/50 focus:ring-2 focus:ring-emerald-300/10"
                    placeholder="••••••••"
                  />
                </label>

                {mode === "register" && (
                  <label className="block">
                    <span className="text-xs font-bold text-zinc-400">
                      {t.confirmPassword}
                    </span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-emerald-300/50 focus:ring-2 focus:ring-emerald-300/10"
                      placeholder="••••••••"
                    />
                  </label>
                )}

                {message && (
                  <div role="alert" className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-xs leading-5 text-amber-200">
                    {message}
                  </div>
                )}
                {registrationStatus && (
                  <div role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3 text-xs leading-5 text-emerald-200">
                    <p>{registrationStatus === "confirmation" ? t.confirmation : t.created}</p>
                    {registrationStatus === "confirmation" && <p className="mt-2 font-semibold">{t.spam}</p>}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-xl bg-emerald-300 px-5 py-3.5 text-sm font-black text-zinc-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? t.wait : mode === "login" ? t.signIn : t.create}
                </button>
              </form>

              <p className="mt-6 text-center text-[11px] leading-5 text-zinc-600">
                {t.terms}
              </p>

              <div className="mt-4 flex justify-center gap-5">
                <Link
                  to="/credits"
                  className="text-xs font-bold text-zinc-500 transition hover:text-emerald-300"
                >
                  {t.credits}
                </Link>
                <Link to="/imprint" className="text-xs font-bold text-zinc-500 transition hover:text-emerald-300">{t.imprint}</Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
