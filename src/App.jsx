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
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import Modal from './Modal.jsx';

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
  const [csvFiles, setCsvFiles] = useState(["ticket.csv"]);
  const [selectedCsv, setSelectedCsv] = useState("ticket.csv");

  // Auto-detect CSV files in /public (simulate for now)
  useEffect(() => {
    // In a real app, you might fetch this from the server or a manifest
    setCsvFiles(["ticket.csv"]); // Add more files if present
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
        <NavLink
          key={link.path}
          to={link.path}
          className={`px-3 py-2 rounded font-semibold transition-colors duration-200 ${location.pathname === link.path ? 'bg-blue-600 text-white shadow' : 'text-gray-700 hover:bg-blue-100'}`}
          aria-current={location.pathname === link.path ? 'page' : undefined}
        >
          {link.name}
        </NavLink>
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

function AppRoutes({ handleShowTicketDetail, handleShowUserDetail }) {
  const { tickets, loading } = useTicketsContext();
  return (
    <Routes>
      <Route path="/" element={<Dashboard tickets={tickets} loading={loading} onShowTicketDetail={handleShowTicketDetail} onShowUserDetail={handleShowUserDetail} />} />
      <Route path="/tickets" element={<TicketsPage tickets={tickets} loading={loading} onShowTicketDetail={handleShowTicketDetail} />} />
      <Route path="/blockers" element={<BlockersPage tickets={tickets} loading={loading} />} />
      <Route path="/sprints" element={<SprintsPage tickets={tickets} loading={loading} />} />
      <Route path="/people" element={<PeoplePage tickets={tickets} loading={loading} onShowUserDetail={handleShowUserDetail} />} />
    </Routes>
  );
}

function CommandPalette({ tickets, onOpenTicket, people, onOpenPerson, sprints, onOpenSprint, open, onClose }) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState([]);
  const inputRef = React.useRef();

  React.useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
    if (!open) setQuery("");
  }, [open]);

  React.useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }
    const q = query.toLowerCase();
    const ticketResults = tickets.filter(t => t.id?.toLowerCase().includes(q) || t.title?.toLowerCase().includes(q)).map(t => ({
      type: "ticket",
      id: t.id,
      title: t.title,
      status: t.status,
      owner: t.owner,
      ticket: t,
    }));
    const peopleResults = people.filter(p => p.toLowerCase().includes(q)).map(name => ({
      type: "person",
      name,
    }));
    const sprintResults = sprints.filter(s => s.toLowerCase().includes(q)).map(name => ({
      type: "sprint",
      name,
    }));
    setResults([...ticketResults, ...peopleResults, ...sprintResults]);
  }, [query, tickets, people, sprints]);

  function handleSelect(result) {
    if (result.type === "ticket") {
      onOpenTicket(result.ticket);
    } else if (result.type === "person") {
      onOpenPerson(result.name);
    } else if (result.type === "sprint") {
      onOpenSprint(result.name);
    }
    onClose();
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-xl p-4 w-full max-w-lg relative animate-fadein">
        <button className="absolute top-3 right-3 text-neutral-500 hover:text-neutral-700 text-2xl" onClick={onClose} aria-label="Close">&times;</button>
        <div className="flex items-center gap-2 mb-2">
          <MagnifyingGlassIcon className="w-5 h-5 text-neutral-400" />
          <input
            ref={inputRef}
            className="w-full px-2 py-2 border-b border-neutral-200 focus:outline-none text-lg"
            placeholder="Search tickets, people, sprints..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter" && results.length > 0) handleSelect(results[0]);
            }}
          />
        </div>
        <div className="max-h-80 overflow-y-auto mt-2">
          {results.length === 0 ? (
            <div className="text-neutral-400 text-center py-6">No results</div>
          ) : (
            <ul>
              {results.map((r, i) => (
                <li key={i} className="px-3 py-2 hover:bg-blue-50 rounded cursor-pointer flex items-center gap-2" onClick={() => handleSelect(r)}>
                  {r.type === "ticket" && <span className="font-mono text-blue-700">#{r.id}</span>}
                  {r.type === "ticket" && <span className="text-neutral-700">{r.title}</span>}
                  {r.type === "person" && <span className="text-green-700 font-semibold">👤 {r.name}</span>}
                  {r.type === "sprint" && <span className="text-purple-700 font-semibold">🏁 {r.name}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <TicketsProvider>
      <AppWithContext />
    </TicketsProvider>
  );
}

function AppWithContext() {
  const { tickets, loading } = useTicketsContext();
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [modal, setModal] = React.useState(null); // { type, data }
  const [detailView, setDetailView] = React.useState({ type: null, payload: null });

  // Gather people and sprints for search
  const people = React.useMemo(() => Array.from(new Set(tickets.map(t => t.owner).filter(Boolean))), [tickets]);
  const sprints = React.useMemo(() => Array.from(new Set(tickets.map(t => t.sprintName || t.sprint).filter(Boolean))), [tickets]);

  // Keyboard shortcut: Ctrl+K
  React.useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(o => !o);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handler functions
  function handleShowTicketDetail(ticketId) {
    setDetailView({ type: 'ticket', payload: ticketId });
  }
  function handleShowUserDetail(userName) {
    setDetailView({ type: 'user', payload: userName });
  }
  function handleCloseDetailView() {
    setDetailView({ type: null, payload: null });
  }

  return (
    <>
      <Toaster position="top-right" />
      <Router>
        <CommandPalette
          tickets={tickets}
          people={people}
          sprints={sprints}
          open={commandOpen}
          onClose={() => setCommandOpen(false)}
          onOpenTicket={handleShowTicketDetail}
          onOpenPerson={handleShowUserDetail}
          onOpenSprint={handleShowTicketDetail}
        />
        {/* Centralized Modal Controller */}
        {detailView.type === 'ticket' && (
          <Modal onClose={handleCloseDetailView} title={`Ticket #${detailView.payload}`}>
            <TicketDetailPage tickets={tickets} loading={loading} id={detailView.payload} />
          </Modal>
        )}
        {detailView.type === 'user' && (
          <Modal onClose={handleCloseDetailView} title={`User: ${detailView.payload}`}>
            <PeoplePage tickets={tickets.filter(t => t.owner === detailView.payload)} loading={loading} />
          </Modal>
        )}
        <Layout>
          <AppRoutes handleShowTicketDetail={handleShowTicketDetail} handleShowUserDetail={handleShowUserDetail} />
        </Layout>
      </Router>
    </>
  );
}

export default App;
