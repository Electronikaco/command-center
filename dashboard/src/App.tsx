import { BrowserRouter, Routes, Route } from "react-router-dom";
import PortfolioView from "./PortfolioView";
import DosmentesView from "./DosmentesView";

const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/" element={<PortfolioView />} />
        <Route path="/project/dosmentes" element={<DosmentesView />} />
      </Routes>
    </BrowserRouter>
  );
}
