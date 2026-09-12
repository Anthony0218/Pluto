import { Link } from "react-router";
import { useAuth } from "./context/AuthContext";
import Auth from "./components/Auth";

function App() {
  const { user, profile, loading, signOut } = useAuth();

  if (loading) {
    return <p>Loading...</p>;
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="flex flex-col items-center justify-center text-center">
      <h1 className="text-5xl font-bold text-zinc-900 dark:text-white">
        Willkommen!
      </h1>

      <h2 className="mt-4 text-2xl font-semibold text-zinc-800 dark:text-zinc-200">
        Welcome, {profile?.username ?? user.email}
      </h2>

      <p className="mt-2 text-zinc-500 dark:text-zinc-400">
        Rating: {profile?.rating ?? 1200}
      </p>

      <div className="mt-8 flex gap-3">
        <Link
          to="/chessGame"
          className="rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-700"
        >
          Play Chess
        </Link>

        <Link
          to="/profile"
          className="rounded-lg border border-zinc-300 bg-white px-5 py-3 font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Profile
        </Link>

        <Link
          to="/onlineGame"
          className="rounded-lg bg-zinc-900 px-5 py-3 font-medium text-white hover:bg-zinc-800"
        >
          Play Online
        </Link>
        <Link
          to="/watten"
          className="rounded-lg bg-zinc-900 px-5 py-3 font-medium text-white hover:bg-zinc-800"
        >
          Play Watten
        </Link>

        <button
          onClick={signOut}
          className="rounded-lg border border-red-200 bg-white px-5 py-3 font-medium text-red-600 hover:bg-red-50"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

export default App;
