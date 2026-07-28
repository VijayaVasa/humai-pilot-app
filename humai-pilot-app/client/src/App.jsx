import { Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Interview from "./pages/Interview.jsx";
import Draft from "./pages/Draft.jsx";
import Review from "./pages/Review.jsx";
import History from "./pages/History.jsx";

export default function App() {
  return (
    <>
      <div className="topbar">
        <div className="badge">HUMAI</div>
        <nav>
          <Link to="/">New piece</Link>
          <Link to="/history">History</Link>
        </nav>
      </div>
      <div className="shell">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/interview/:type/:id" element={<Interview />} />
          <Route path="/draft/:type/:id" element={<Draft />} />
          <Route path="/review/:type/:id" element={<Review />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </div>
    </>
  );
}
