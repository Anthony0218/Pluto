import "./App.css";
import { Link } from "react-router";

function App() {
  return (
    <main>
      Willkommen!
      <Link to="/chessGame">
        <button>Play Chess</button>
      </Link>
    </main>
  );
}

export default App;
