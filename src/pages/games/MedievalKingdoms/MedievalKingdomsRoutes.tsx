import {
  Route,
} from "react-router-dom";

import MedievalKingdomsBattlePage from "./MedievalKingdomsBattlePage";
import MedievalKingdomsRegionPage from "./MedievalKingdomsRegionPage";
import MedievalKingdomsWorldPage from "./MedievalKingdomsWorldPage";

/**
 * Render this component inside your app's existing <Routes>.
 *
 * If you already define routes centrally, copy these three <Route> entries
 * into that file instead.
 */
export default function MedievalKingdomsRoutes() {
  return (
    <>
      <Route
        path="/games/medieval-kingdoms"
        element={
          <MedievalKingdomsWorldPage />
        }
      />

      <Route
        path="/games/medieval-kingdoms/campaign/:campaignId"
        element={
          <MedievalKingdomsRegionPage />
        }
      />

      <Route
        path="/games/medieval-kingdoms/campaign/:campaignId/battle/:battleNodeId"
        element={
          <MedievalKingdomsBattlePage />
        }
      />
    </>
  );
}
