import { BrowserRouter, HashRouter, Routes, Route } from "react-router-dom";
import PortfolioView from "./PortfolioView";

const isStatic = import.meta.env.VITE_STATIC_PORTFOLIO === "1";
const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

const routes = (
  <Routes>
    <Route path="/" element={<PortfolioView />} />
  </Routes>
);

export default function App() {
  if (isStatic) {
    return <HashRouter>{routes}</HashRouter>;
  }
  return <BrowserRouter basename={basename}>{routes}</BrowserRouter>;
}
