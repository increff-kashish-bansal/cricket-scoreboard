import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  NavLink,
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
import { ArrowPathIcon } from "@heroicons/react/24/solid";
import { Toaster } from 'react-hot-toast';

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
    <div className="flex items-center justify-between bg-neutral-100 shadow-sm px-8 py-4 mb-6 sticky top-0 z-10">
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
          className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark disabled:opacity-50 flex items-center gap-2"
          onClick={reload}
          disabled={loading}
        >
          {loading ? (
            <>
              <ArrowPathIcon className="h-5 w-5 animate-spin" />
              Reloading...
            </>
          ) : (
            "Reload CSV"
          )}
        </button>
        <input
          type="file"
          accept=".csv"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        <button
          className="bg-status-done text-white px-4 py-2 rounded-md hover:bg-primary-dark disabled:opacity-50 flex items-center gap-2"
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
          disabled={loading}
        >
          {loading ? (
            <>
              <ArrowPathIcon className="h-5 w-5 animate-spin" />
              Uploading...
            </>
          ) : (
            "Upload CSV"
          )}
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
    <aside className="bg-neutral-900 text-neutral-100 w-64 min-h-screen flex-shrink-0 hidden md:block">
      <div className="p-6 font-bold text-xl border-b border-neutral-800">Tech Scoreboard</div>
      <nav className="mt-6">
        <ul>
          {navLinks.map(link => (
            <li key={link.path}>
              <NavLink
                to={link.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-6 py-2 rounded-md transition-colors ${
                    isActive
                      ? 'bg-primary-dark text-white font-semibold'
                      : 'text-neutral-300 hover:bg-neutral-800'
                  }`
                }
              >
                <span className="w-4 h-4 bg-current rounded-full opacity-75"></span>
                {link.name}
              </NavLink>
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
      <div className="flex-1 bg-neutral-50">
        <TopBar />
        <main className="p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}

function Placeholder({ title }) {
  return (
    <div className="flex items-center justify-center h-full">
      <h1 className="text-3xl font-bold text-neutral-700">{title}</h1>
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
    <>
      <Toaster position="top-right" />
      <TicketsProvider>
        <Dashboard />
      </TicketsProvider>
    </>
  );
}

export default App;
