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

const navLinks = [
  { name: "Dashboard", path: "/" },
  { name: "Tickets", path: "/tickets" },
  { name: "Blockers", path: "/blockers" },
  { name: "Sprints", path: "/sprints" },
  { name: "People", path: "/people" },
];

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
      <main className="flex-1 bg-gray-100 p-8">{children}</main>
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

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Placeholder title="Dashboard" />} />
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
          <Route path="/blockers" element={<Placeholder title="Blockers" />} />
          <Route path="/sprints" element={<SprintsPage />} />
          <Route path="/people" element={<PeoplePage />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
