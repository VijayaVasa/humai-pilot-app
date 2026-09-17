import { Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Interview from "./pages/Interview.jsx";
import Draft from "./pages/Draft.jsx";
import Review from "./pages/Review.jsx";
import History from "./pages/History.jsx";
import HowItWorks from "./pages/HowItWorks.jsx";

export default function App() {
  return (
    <>
      <div className="topbar">
        <Link to="/" className="badge">HUMAI</Link>
        <nav>
          <Link to="/">Get started</Link>
          <Link to="/how-it-works">How it works</Link>
          <Link to="/history">History</Link>
        </nav>
      </div>
      <div className="shell">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/interview/:type/:id" element={<Interview />} />
          <Route path="/draft/:type/:id" element={<Draft />} />
          <Route path="/review/:type/:id" element={<Review />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </div>
    </>
  );
}

