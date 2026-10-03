import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";

/** Invoke the selected lobby's own creator after authentication and settings are ready. */
export function useInviteAutoCreate(create: () => unknown, ready = true) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const latest = useRef(create);
  const started = useRef<string | null>(null);
  useEffect(() => { latest.current = create; });
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!user || loading || !ready || params.get("create") !== "1" || started.current === location.pathname) return;
    started.current = location.pathname;
    params.delete("create");
    // Consume the action so refresh/back cannot create a second room.
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    void latest.current();
  }, [user, loading, ready, location, navigate]);
}
