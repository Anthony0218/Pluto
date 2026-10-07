import { useAuth } from "./context/AuthContext";
import DashboardPage from "./pages/general/DashboardPage";

function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        Wird geladen...
      </div>
    );
  }

  return <DashboardPage />;
}

export default App;
