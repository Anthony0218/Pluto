import { ui, useUiLanguage } from "@/i18n/ui";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

type ProtectedRouteProps = {
  children: React.ReactNode;
};

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  useUiLanguage();
  const { user, loading } = useAuth();

  if (loading) {
    return <div>{ui("Loading...")}</div>;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return children;
}
