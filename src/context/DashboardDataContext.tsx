import type { ReactNode } from "react";
import { DashboardDataContext, useDashboardDataSource } from "@/hooks/useDashboardData";
export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const data = useDashboardDataSource();
  return <DashboardDataContext.Provider value={data}>{children}</DashboardDataContext.Provider>;
}
