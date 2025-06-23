import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link
} from "react-router-dom";
import TicketsPage from "./TicketsPage.jsx";
import TicketDetailPage from "./TicketDetailPage.jsx";
import SprintsPage from "./SprintsPage.jsx";
import PeoplePage from "./PeoplePage.jsx";
import BlockersPage from "./BlockersPage.jsx";
import { TicketsProvider, useTicketsContext } from "./TicketsContext.jsx";
import Dashboard from "./Dashboard.jsx";
import React from "react";

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
      <div className="flex gap-2">
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
        <Layout>
          <AppRoutes />
        </Layout>
      </Router>
    </TicketsProvider>
  );
}

export default App;
