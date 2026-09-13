import { useAuth } from "./context/AuthContext";
import Auth from "./components/Auth";
import HomePage from "./pages/HomePage";

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        Wird geladen...
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return <HomePage />;
}

export default App;
