import { Link } from "react-router-dom";
import ContinentMap from "../../../components/MedievalKingdoms/ContinentMap";
import "./medievalWorld.css";

export default function MedievalKingdomsWorldPage() {
  return (
    <main className="medieval-world">
      <Link to="/games/medieval-kingdoms" style={{position:"absolute",top:10,right:20,zIndex:10,color:"#efdcba",fontSize:12}}>Edravane campaign →</Link>
      <ContinentMap />
    </main>
  );
}
