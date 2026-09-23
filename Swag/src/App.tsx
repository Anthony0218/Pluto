import { useAuth } from "./context/AuthContext";
import HomePage from "./pages/general/HomePage";

function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        Wird geladen...
      </div>
    );
  }

  return <HomePage />;
}

export default App;
