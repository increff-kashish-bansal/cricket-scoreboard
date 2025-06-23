import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation
} from "react-router-dom";
import TicketsPage from "./TicketsPage.jsx";
import TicketDetailPage from "./TicketDetailPage.jsx";
import SprintsPage from "./SprintsPage.jsx";
import PeoplePage from "./PeoplePage.jsx";
import BlockersPage from "./BlockersPage.jsx";
import { TicketsProvider, useTicketsContext } from "./TicketsContext.jsx";
import Dashboard from "./Dashboard.jsx";
import React, { useEffect, useState } from "react";

const navLinks = [
  { name: "Dashboard", path: "/" },
  { name: "Tickets", path: "/tickets" },
  { name: "Blockers", path: "/blockers" },
  { name: "Sprints", path: "/sprints" },
  { name: "People", path: "/people" },
];

function TopBar() {
  const { reload, loading, uploadTickets } = useTicketsContext();
  const fileInputRef = React.useRef();
  const [csvFiles, setCsvFiles] = useState(["tickets.csv"]);
  const [selectedCsv, setSelectedCsv] = useState("tickets.csv");

  // Auto-detect CSV files in /public (simulate for now)
  useEffect(() => {
    // In a real app, you might fetch this from the server or a manifest
    setCsvFiles(["tickets.csv"]); // Add more files if present
  }, []);

  // Allow user to select and load a CSV from the dropdown
  const handleCsvSelect = (e) => {
    setSelectedCsv(e.target.value);
    // Simulate loading a different CSV (in real app, pass to context)
    window.location.href = `/${e.target.value}`; // Or trigger context reload
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      uploadTickets(file);
      e.target.value = null; // reset input
    }
  };

  return (
    <div className="flex items-center justify-between bg-white shadow px-6 py-3 mb-6 sticky top-0 z-10">
      <div className="font-bold text-lg">Tech Scoreboard</div>
      <div className="flex gap-2 items-center">
        <select
          className="border rounded px-2 py-1 text-sm"
          value={selectedCsv}
          onChange={handleCsvSelect}
          disabled={loading}
        >
          {csvFiles.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          onClick={reload}
          disabled={loading}
        >
          {loading ? "Reloading..." : "Reload CSV"}
        </button>
        <input
          type="file"
          accept=".csv"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        <button
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
          disabled={loading}
        >
          Upload CSV
        </button>
      </div>
    </div>
  );
}

function SidebarNav() {
  const location = useLocation();
  return (
    <nav className="flex gap-2 mb-4">
      {navLinks.map(link => (
        <a
          key={link.path}
          href={link.path}
          className={`px-3 py-2 rounded font-semibold transition-colors duration-200 ${location.pathname === link.path ? 'bg-blue-600 text-white shadow' : 'text-gray-700 hover:bg-blue-100'}`}
          aria-current={location.pathname === link.path ? 'page' : undefined}
        >
          {link.name}
        </a>
      ))}
    </nav>
  );
}

function Sidebar() {
  return (
    <aside className="bg-gray-800 text-white w-64 min-h-screen flex-shrink-0 hidden md:block">
      <div className="p-6 font-bold text-xl border-b border-gray-700">Tech Scoreboard</div>
      <nav className="mt-6">
        <ul>
          {navLinks.map(link => (
            <li key={link.path}>
              <Link
                to={link.path}
                className="block px-6 py-3 hover:bg-gray-700 transition-colors rounded"
              >
                {link.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

function Layout({ children }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 bg-gray-100">
        <TopBar />
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}

function Placeholder({ title }) {
  return (
    <div className="flex items-center justify-center h-full">
      <h1 className="text-3xl font-bold text-gray-800">{title}</h1>
    </div>
  );
}

function AppRoutes() {
  const { tickets, loading } = useTicketsContext();
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/tickets" element={<TicketsPage tickets={tickets} loading={loading} />} />
      <Route path="/tickets/:id" element={<TicketDetailPage tickets={tickets} loading={loading} />} />
      <Route path="/blockers" element={<BlockersPage tickets={tickets} loading={loading} />} />
      <Route path="/sprints" element={<SprintsPage tickets={tickets} loading={loading} />} />
      <Route path="/people" element={<PeoplePage tickets={tickets} loading={loading} />} />
    </Routes>
  );
}

function App() {
  return (
    <TicketsProvider>
      <Router>
        <TopBar />
        <div className="max-w-7xl mx-auto px-4">
          <SidebarNav />
          <div className="min-h-[60vh] bg-white rounded shadow p-6 mb-8 animate-fadein">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/tickets" element={<TicketsPage />} />
              <Route path="/tickets/:id" element={<TicketDetailPage />} />
              <Route path="/blockers" element={<BlockersPage />} />
              <Route path="/sprints" element={<SprintsPage />} />
              <Route path="/people" element={<PeoplePage />} />
            </Routes>
          </div>
        </div>
      </Router>
    </TicketsProvider>
  );
}

export default App;
