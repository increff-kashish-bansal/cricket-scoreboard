import { useEffect, useState } from "react";
import Papa from "papaparse";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell, LineChart, Line } from "recharts";
import { saveAs } from "file-saver";

function parseTime(str) {
  if (!str || str === "-") return 0;
  let days = 0, hours = 0;
  const dMatch = str.match(/(\d+)d/);
  const hMatch = str.match(/(\d+)h/);
  if (dMatch) days = parseInt(dMatch[1], 10);
  if (hMatch) hours = parseInt(hMatch[1], 10);
  return days * 24 + hours;
}

function toCSV(rows) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(",")].concat(
    rows.map(row => keys.map(k => `"${(row[k] || "").replace(/"/g, '""')}"`).join(","))
  ).join("\n");
  return csv;
}

const METRIC_LABELS = {
  tickets: "Tickets Owned",
  timeHeld: "Time Held (h)",
  blocksResolved: "Blocks Resolved",
  blocksCaused: "Blocks Caused",
};
const METRIC_COLORS = {
  tickets: "#8884d8",
  timeHeld: "#82ca9d",
  blocksResolved: "#ffc658",
  blocksCaused: "#ff8042",
};

export default function PeoplePage({ tickets = [], loading }) {
  const [ticketsState, setTickets] = useState([]);
  const [loadingState, setLoading] = useState(true);
  const [tab, setTab] = useState("developers");
  const [sortConfig, setSortConfig] = useState({ key: "tickets", direction: "desc" });
  const [searchTerm, setSearchTerm] = useState("");
  const [sprintFilter, setSprintFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [modalPerson, setModalPerson] = useState(null);

  // Use tickets from props if provided, else load from CSV (legacy)
  const ticketsToUse = tickets.length ? tickets : ticketsState;
  const loadingToUse = tickets.length ? loading : loadingState;

  useEffect(() => {
    if (tickets.length) return;
    setLoading(true);
    Papa.parse("/tickets.csv", {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setTickets(results.data);
        setLoading(false);
      },
      error: () => setLoading(false),
    });
  }, [tickets.length]);

  // --- SPRINTS/TEAMS ---
  const allSprints = Array.from(new Set(ticketsToUse.map(t => t.sprint || "No Sprint")));
  const allTeams = Array.from(new Set(ticketsToUse.map(t => t.team).filter(Boolean)));

  // Aggregate stats for developers and blockers
  const devStats = {};
  const blockerStats = {};
  ticketsToUse.forEach(ticket => {
    // Developers: tickets owned
    if (ticket.owner) {
      if (!devStats[ticket.owner]) {
        devStats[ticket.owner] = { name: ticket.owner, tickets: 0, timeHeld: 0, blocksResolved: 0, blocksCaused: 0, closedBySprint: {}, team: ticket.team };
      }
      devStats[ticket.owner].tickets += 1;
      devStats[ticket.owner].timeHeld += parseTime(ticket.timeInDev);
      if (ticket.status === "Done") {
        devStats[ticket.owner].blocksResolved += 1;
        // Track tickets closed per sprint for sparkline
        const sprint = ticket.sprint || "No Sprint";
        devStats[ticket.owner].closedBySprint[sprint] = (devStats[ticket.owner].closedBySprint[sprint] || 0) + 1;
      }
    }
    // Blockers: blocks caused
    if (ticket.blockedBy) {
      if (!blockerStats[ticket.blockedBy]) {
        blockerStats[ticket.blockedBy] = { name: ticket.blockedBy, tickets: 0, timeHeld: 0, blocksResolved: 0, blocksCaused: 0, team: ticket.team };
      }
      blockerStats[ticket.blockedBy].blocksCaused += 1;
    }
    // For blockers, also show tickets/time held if they were also owners
    if (ticket.blockedBy && devStats[ticket.blockedBy]) {
      blockerStats[ticket.blockedBy].tickets = devStats[ticket.blockedBy].tickets;
      blockerStats[ticket.blockedBy].timeHeld = devStats[ticket.blockedBy].timeHeld;
      blockerStats[ticket.blockedBy].blocksResolved = devStats[ticket.blockedBy].blocksResolved;
    }
  });

  // --- TOP PERFORMERS TAGS ---
  // Top Closer: most tickets closed (Done)
  let topCloser = null, mostUnblocked = null, mostBlocked = null;
  let maxClosed = 0, maxUnblocked = 0, maxBlocked = 0;
  Object.values(devStats).forEach(p => {
    if (p.blocksResolved > maxUnblocked) { mostUnblocked = p.name; maxUnblocked = p.blocksResolved; }
    if (p.tickets > maxClosed) { topCloser = p.name; maxClosed = p.tickets; }
  });
  Object.values(blockerStats).forEach(p => {
    if (p.blocksCaused > maxBlocked) { mostBlocked = p.name; maxBlocked = p.blocksCaused; }
  });

  // Prepare people list for current tab
  let people = Object.values(tab === "developers" ? devStats : blockerStats);
  // --- FILTERING ---
  if (searchTerm.trim()) {
    people = people.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }
  if (sprintFilter) {
    people = people.filter(p => {
      if (tab === "developers") return Object.keys(p.closedBySprint || {}).includes(sprintFilter);
      // For blockers, filter if they blocked tickets in that sprint
      return ticketsToUse.some(t => t.blockedBy === p.name && (t.sprint || "No Sprint") === sprintFilter);
    });
  }
  if (teamFilter) {
    people = people.filter(p => p.team === teamFilter);
  }
  if (sortConfig.key) {
    people = [...people].sort((a, b) => {
      let aVal = a[sortConfig.key] || 0;
      let bVal = b[sortConfig.key] || 0;
      return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
    });
  }

  function handleExport() {
    const csv = toCSV(people);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    saveAs(blob, "people.csv");
  }

  // --- DRILL-DOWN MODAL ---
  function getPersonTickets(person) {
    if (!person) return [];
    if (tab === "developers") {
      return ticketsToUse.filter(t => t.owner === person.name);
    } else {
      return ticketsToUse.filter(t => t.blockedBy === person.name);
    }
  }
  function getPersonSummary(person) {
    const tickets = getPersonTickets(person);
    let totalDev = 0, totalBlocked = 0;
    tickets.forEach(t => {
      totalDev += parseTime(t.timeInDev);
      totalBlocked += parseTime(t.timeBlocked);
    });
    return { totalDev, totalBlocked };
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">People Dashboard</h1>
        <button onClick={handleExport} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Export CSV</button>
      </div>
      {/* Search & Filter */}
      <div className="flex flex-wrap gap-4 items-end mb-6">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium mb-1">Search</label>
          <input
            type="text"
            className="border rounded px-2 py-1 w-full"
            placeholder="Search by name or role"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Sprint</label>
          <select
            className="border rounded px-2 py-1"
            value={sprintFilter}
            onChange={e => setSprintFilter(e.target.value)}
          >
            <option value="">All</option>
            {allSprints.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {allTeams.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1">Team</label>
            <select
              className="border rounded px-2 py-1"
              value={teamFilter}
              onChange={e => setTeamFilter(e.target.value)}
            >
              <option value="">All</option>
              {allTeams.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          className={`px-4 py-2 rounded-t font-semibold border-b-2 ${tab === "developers" ? "border-blue-600 text-blue-700 bg-white" : "border-transparent text-gray-500 bg-gray-100"}`}
          onClick={() => setTab("developers")}
        >
          Developers
        </button>
        <button
          className={`px-4 py-2 rounded-t font-semibold border-b-2 ${tab === "blockers" ? "border-blue-600 text-blue-700 bg-white" : "border-transparent text-gray-500 bg-gray-100"}`}
          onClick={() => setTab("blockers")}
        >
          Blockers
        </button>
      </div>
      {loadingToUse ? (
        <div className="p-8 text-center text-gray-500">Loading data...</div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-4 mb-2">
            {Object.keys(METRIC_LABELS).map(metric => (
              (tab === "developers" || metric !== "tickets") && (
                <button
                  key={metric}
                  className={`px-3 py-1 rounded text-xs border ${sortConfig.key === metric ? "bg-blue-600 text-white border-blue-700" : "bg-white text-blue-700 border-blue-300"}`}
                  onClick={() => setSortConfig(prev => ({ key: metric, direction: prev.key === metric && prev.direction === "desc" ? "asc" : "desc" }))}
                >
                  {METRIC_LABELS[metric]} {sortConfig.key === metric && (sortConfig.direction === "asc" ? "▲" : "▼")}
                </button>
              )
            ))}
          </div>
          {people.length === 0 ? (
            <div className="text-gray-500 text-center py-8">No data available.</div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {people.map(person => {
                // Only show blocksCaused for blockers tab
                const metrics = [
                  { key: "tickets", value: person.tickets },
                  { key: "timeHeld", value: person.timeHeld },
                  { key: "blocksResolved", value: person.blocksResolved },
                ];
                if (tab === "blockers") metrics.push({ key: "blocksCaused", value: person.blocksCaused });
                // Top performer tags
                const tags = [];
                if (tab === "developers" && person.name === topCloser) tags.push(<span className="inline-block px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 text-xs font-semibold border border-yellow-200 ml-1">🏆 Top Closer</span>);
                if (tab === "developers" && person.name === mostUnblocked) tags.push(<span className="inline-block px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-semibold border border-green-200 ml-1">🔧 Most Unblocked</span>);
                if (tab === "blockers" && person.name === mostBlocked) tags.push(<span className="inline-block px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-xs font-semibold border border-red-200 ml-1">🚨 Most Blocked</span>);
                // Sparkline data (tickets closed per sprint)
                let sparkData = [];
                if (tab === "developers") {
                  const sprints = allSprints.slice(-5);
                  sparkData = sprints.map(s => ({ sprint: s, closed: (person.closedBySprint && person.closedBySprint[s]) || 0 }));
                }
                return (
                  <div key={person.name} className="bg-white rounded shadow p-4">
                    <div className="font-semibold mb-2 flex items-center gap-2">
                      <span>{person.name}</span>
                      {tags}
                    </div>
                    {/* Sparkline for developers */}
                    {tab === "developers" && (
                      <div className="w-full h-10 mb-2">
                        <ResponsiveContainer>
                          <LineChart data={sparkData} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                            <Line type="monotone" dataKey="closed" stroke="#8884d8" strokeWidth={2} dot={false} />
                            <XAxis dataKey="sprint" hide />
                            <YAxis hide domain={[0, 'dataMax']} />
                          </LineChart>
                        </ResponsiveContainer>
                        <div className="text-xs text-gray-400 text-right">Last 5 sprints</div>
                      </div>
                    )}
                    <div className="w-full h-32">
                      <ResponsiveContainer>
                        <BarChart
                          data={metrics}
                          layout="vertical"
                          margin={{ left: 40, right: 20, top: 10, bottom: 10 }}
                        >
                          <XAxis type="number" allowDecimals={false} hide />
                          <YAxis dataKey="key" type="category" width={120} tickFormatter={k => METRIC_LABELS[k]} />
                          <Tooltip formatter={(value, key) => [`${value}`, METRIC_LABELS[key]]} />
                          {metrics.map(m => (
                            <Bar
                              key={m.key}
                              dataKey="value"
                              fill={METRIC_COLORS[m.key]}
                              name={METRIC_LABELS[m.key]}
                              barSize={18}
                              radius={[4, 4, 4, 4]}
                              isAnimationActive={false}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Drill-down modal trigger */}
                    <button className="mt-2 text-xs text-blue-600 hover:underline" onClick={() => setModalPerson(person)}>View Details</button>
                  </div>
                );
              })}
            </div>
          )}
          {/* Drill-down Modal */}
          {modalPerson && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
              <div className="bg-white rounded shadow-lg p-6 max-w-2xl w-full relative">
                <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-xl" onClick={() => setModalPerson(null)}>&times;</button>
                <div className="font-bold text-lg mb-2">{modalPerson.name} - Details</div>
                <div className="mb-2 text-sm text-gray-500">{tab === "developers" ? "Tickets Worked On" : "Tickets Blocked"}</div>
                <div className="overflow-x-auto max-h-64 mb-4">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="bg-gray-100 text-left">
                        <th className="px-2 py-1">Ticket ID</th>
                        <th className="px-2 py-1">Status</th>
                        <th className="px-2 py-1">Time Held</th>
                        <th className="px-2 py-1">Block Duration</th>
                        <th className="px-2 py-1">Sprint</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getPersonTickets(modalPerson).map(t => (
                        <tr key={t.id} className="border-t">
                          <td className="px-2 py-1 font-mono">{t.id}</td>
                          <td className="px-2 py-1">{t.status}</td>
                          <td className="px-2 py-1">{t.timeInDev}</td>
                          <td className="px-2 py-1">{t.timeBlocked}</td>
                          <td className="px-2 py-1">{t.sprint || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 text-sm">
                  <span className="font-semibold">Summary:</span> Total Dev Time: <span className="font-mono">{getPersonSummary(modalPerson).totalDev}h</span>, Total Blocked Time: <span className="font-mono">{getPersonSummary(modalPerson).totalBlocked}h</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 