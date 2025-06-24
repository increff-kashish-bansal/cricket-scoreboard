import { useEffect, useState } from "react";
import Papa from "papaparse";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell, LineChart, Line, CartesianGrid } from "recharts";
import { saveAs } from "file-saver";
import { ArrowPathIcon, InformationCircleIcon } from "@heroicons/react/24/solid";
import { formatHoursToDuration } from "./utils.js";

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

  // --- METRICS TO SHOW FOR SORT BUTTONS ---
  const metricsToShow = tab === "developers"
    ? [
        { key: "tickets", label: "Tickets" },
        { key: "timeHeld", label: "Time Held" },
        { key: "blocksResolved", label: "Blocks Resolved" }
      ]
    : [
        { key: "tickets", label: "Tickets" },
        { key: "timeHeld", label: "Time Held" },
        { key: "blocksCaused", label: "Blocks Caused" }
      ];

  // Aggregate stats for developers and blockers
  const devStats = {};
  const blockerStats = {};
  ticketsToUse.forEach(ticket => {
    const eventLog = ticket.eventLogParsed || [];
    // Developers: tickets owned
    if (ticket.owner) {
      if (!devStats[ticket.owner]) {
        devStats[ticket.owner] = { name: ticket.owner, tickets: 0, timeHeld: 0, blocksResolved: 0, blocksCaused: 0, closedBySprint: {}, team: ticket.team };
      }
      devStats[ticket.owner].tickets += 1;
      devStats[ticket.owner].timeHeld += ticket.calculatedTotalTimeInDevHours || 0;
      // blocksResolved: count 'unblocked' events in eventLogParsed where event.user or event.by matches owner
      devStats[ticket.owner].blocksResolved += eventLog.filter(ev => (ev.status === 'In Progress' || ev.status === 'Unblocked') && (ev.user === ticket.owner || ev.by === ticket.owner)).length;
      // blocksCaused: count 'Blocked' events in eventLogParsed where ev.blockedBy matches owner
      devStats[ticket.owner].blocksCaused += eventLog.filter(ev => ev.status === 'Blocked' && ev.blockedBy === ticket.owner).length;
      // Sparkline: count 'Done' status_change events per sprint
      eventLog.forEach(ev => {
        if (ev.type === 'status_change' && ev.status === 'Done' && ev.timestamp) {
          // Derive sprint from event timestamp (find closest sprint by date)
          const sprint = ticket.sprintName || ticket.sprint || 'No Sprint';
          devStats[ticket.owner].closedBySprint[sprint] = (devStats[ticket.owner].closedBySprint[sprint] || 0) + 1;
        }
      });
    }
    // Blockers: blocks caused (across all tickets)
    eventLog.forEach(ev => {
      if (ev.status === 'Blocked' && ev.blockedBy) {
        const blocker = ev.blockedBy;
        if (!blockerStats[blocker]) {
          blockerStats[blocker] = { name: blocker, tickets: 0, timeHeld: 0, blocksResolved: 0, blocksCaused: 0, team: ticket.team };
        }
        blockerStats[blocker].blocksCaused += 1;
      }
    });
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
      totalDev += t.calculatedTotalTimeInDevHours || 0;
      totalBlocked += t.calculatedTotalTimeBlockedHours || 0;
    });
    return { totalDev: formatHoursToDuration(totalDev), totalBlocked: formatHoursToDuration(totalBlocked) };
  }

  // --- Sparkline: Chronological sprints ---
  function getChronologicalSprints() {
    // Collect all unique sprints with at least one ticket, sort by first event timestamp
    const sprintDates = {};
    ticketsToUse.forEach(ticket => {
      const sprint = ticket.sprintName || ticket.sprint || 'No Sprint';
      const firstEvent = (ticket.eventLogParsed && ticket.eventLogParsed[0]) ? ticket.eventLogParsed[0].timestamp : null;
      if (sprint && firstEvent && (!sprintDates[sprint] || firstEvent < sprintDates[sprint])) {
        sprintDates[sprint] = firstEvent;
      }
    });
    return Object.entries(sprintDates)
      .sort((a, b) => new Date(a[1]) - new Date(b[1]))
      .map(([s]) => s);
  }
  const allSprintsChrono = getChronologicalSprints();

  // --- Workload Stacked Bar Chart Data (Developers tab) ---
  let workloadData = [];
  if (tab === "developers") {
    // For each developer, count tickets by status
    const statusKeys = ["In Progress", "Blocked", "In Review"];
    workloadData = Object.values(devStats).map(dev => {
      const ownedTickets = ticketsToUse.filter(t => t.owner === dev.name);
      const statusCounts = { name: dev.name };
      statusKeys.forEach(status => {
        statusCounts[status] = ownedTickets.filter(t => t.status === status).length;
      });
      return statusCounts;
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-neutral-800 mb-6">People Dashboard</h1>
        <button onClick={handleExport} className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark focus:ring-2 focus:ring-primary focus:ring-opacity-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed">Export CSV</button>
      </div>
      <div className="bg-neutral-100 rounded-lg shadow-sm p-6 mb-6">
        {/* FILTERS */}
        <div className="bg-neutral-100 rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-sm font-medium text-neutral-600 mb-1 block" htmlFor="people-search">Search</label>
              <input
                id="people-search"
                type="text"
                className="border border-neutral-300 rounded-md px-3 py-2 w-full text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                placeholder="Search by name"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                aria-label="Search people by name"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-600 mb-1 block" htmlFor="people-sprint">Sprint</label>
              <select
                id="people-sprint"
                className="border border-neutral-300 rounded-md px-3 py-2 w-full text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                value={sprintFilter}
                onChange={e => setSprintFilter(e.target.value)}
                aria-label="Filter by sprint"
              >
                <option value="">All</option>
                {allSprints.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-600 mb-1 block" htmlFor="people-team">Team</label>
              <select
                id="people-team"
                className="border border-neutral-300 rounded-md px-3 py-2 w-full text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                value={teamFilter}
                onChange={e => setTeamFilter(e.target.value)}
                aria-label="Filter by team"
              >
                <option value="">All</option>
                {allTeams.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        {/* TABS */}
        <div className="flex gap-2 mb-6" role="tablist">
          <button
            className={`px-4 py-2 rounded-t-lg border-b-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${tab === "developers" ? "text-primary-dark font-semibold bg-neutral-100 border-primary" : "text-neutral-500 bg-neutral-50 hover:bg-neutral-100 border-b-2 border-transparent"}`}
            onClick={() => setTab("developers")}
            aria-label="Show developers tab"
            aria-selected={tab === "developers"}
            role="tab"
          >
            Developers
          </button>
          <button
            className={`px-4 py-2 rounded-t-lg border-b-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${tab === "blockers" ? "text-primary-dark font-semibold bg-neutral-100 border-primary" : "text-neutral-500 bg-neutral-50 hover:bg-neutral-100 border-b-2 border-transparent"}`}
            onClick={() => setTab("blockers")}
            aria-label="Show blockers tab"
            aria-selected={tab === "blockers"}
            role="tab"
          >
            Blockers
          </button>
        </div>
        {/* SORT BUTTONS */}
        <div className="flex gap-2 mb-4">
          {metricsToShow.map(metric => (
            <button
              key={metric.key}
              className={`px-3 py-1 rounded text-xs border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${sortConfig.key === metric.key ? 'bg-primary text-white border-primary' : 'text-neutral-700 border-neutral-300 bg-neutral-50 hover:bg-neutral-100'}`}
              onClick={() => setSortConfig(prev => ({ key: metric.key, direction: prev.key === metric.key && prev.direction === "desc" ? "asc" : "desc" }))}
              aria-label={`Sort by ${metric.label}`}
            >
              {metric.label} {sortConfig.key === metric.key && (sortConfig.direction === "asc" ? "▲" : "▼")}
            </button>
          ))}
        </div>
        {/* WORKLOAD STACKED BAR CHART (Developers tab only) */}
        {tab === "developers" && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-neutral-700 mb-2">Current Workload by Developer</h2>
            <div className="w-full h-80">
              <ResponsiveContainer>
                <BarChart
                  data={workloadData}
                  layout="vertical"
                  margin={{ left: 120, right: 24, top: 24, bottom: 24 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 14, fill: '#374151' }} label={{ value: 'Number of Tickets', position: 'insideBottomRight', offset: -5, fill: '#374151', fontSize: 14 }} />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 14, fill: '#374151' }} />
                  <Tooltip
                    contentStyle={{ background: '#f5f5f5', border: '1px solid #d1d5db', borderRadius: 8, boxShadow: '0 2px 8px 0 rgba(0,0,0,0.04)', padding: 12, color: '#374151', fontSize: 14 }}
                    wrapperClassName="!z-50"
                    labelClassName="text-neutral-700"
                    itemStyle={{ color: '#374151' }}
                  />
                  <Legend wrapperStyle={{ color: '#52525b', fontSize: 14, paddingBottom: 8 }} iconType="circle" align="right" verticalAlign="top" layout="horizontal" />
                  <Bar dataKey="In Progress" stackId="a" fill="#fbbf24" name="In Progress" radius={[4, 4, 4, 4]} />
                  <Bar dataKey="Blocked" stackId="a" fill="#f87171" name="Blocked" radius={[4, 4, 4, 4]} />
                  <Bar dataKey="In Review" stackId="a" fill="#2563eb" name="In Review" radius={[4, 4, 4, 4]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-xs text-gray-500 mt-2">Shows the number of tickets each developer currently owns, segmented by status. Helps spot overload and available capacity.</div>
          </div>
        )}
        {/* PEOPLE CARDS */}
        {loadingToUse ? (
          <div className="flex flex-col items-center justify-center py-8 text-neutral-500">
            <ArrowPathIcon className="h-10 w-10 animate-spin mb-2" />
            <div>Loading data...</div>
          </div>
        ) : people.length === 0 ? (
          <div className="text-center py-8 text-neutral-500 flex flex-col items-center justify-center">
            <InformationCircleIcon className="h-10 w-10 mb-2" />
            <div>No data available. Try adjusting your filters or search.</div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-8">
            {people.map(person => {
              // Only show blocksCaused for blockers tab
              const metrics = [
                { label: "Tickets", value: person.tickets, tooltip: "Total tickets owned or blocked by this person." },
                { label: "Time Held", value: formatHoursToDuration(person.timeHeld), tooltip: "Total hours the person actively worked on tickets." },
              ];
              if (tab === "developers") metrics.push({ label: "Blocks Resolved", value: person.blocksResolved, tooltip: "Number of times this person resolved a block on a ticket." });
              if (tab === "blockers") metrics.push({ label: "Blocks Caused", value: person.blocksCaused, tooltip: "Number of times this person/entity caused a block on a ticket." });
              // Top performer tags
              const tags = [];
              if (tab === "developers" && person.name === topCloser) tags.push(<span key="topCloser" title="Top Closer: Most tickets closed" className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold border bg-status-done/10 text-status-done-darker border-status-done/20 ml-1" tabIndex={0} aria-label="Top Closer: Most tickets closed">🏆 Top Closer</span>);
              if (tab === "developers" && person.name === mostUnblocked) tags.push(<span key="mostUnblocked" title="Most Unblocked: Most blocks resolved" className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold border bg-green-100 text-green-800 border-green-200 ml-1" tabIndex={0} aria-label="Most Unblocked: Most blocks resolved">🔧 Most Unblocked</span>);
              if (tab === "blockers" && person.name === mostBlocked) tags.push(<span key="mostBlocked" title="Most Blocked: Most blocks caused" className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold border bg-red-100 text-red-800 border-red-200 ml-1" tabIndex={0} aria-label="Most Blocked: Most blocks caused">🚨 Most Blocked</span>);
              // Sparkline data (tickets closed per sprint)
              let sparkData = [];
              if (tab === "developers") {
                const sprints = allSprintsChrono.slice(-5);
                sparkData = sprints.map(s => ({ sprint: s, closed: (person.closedBySprint && person.closedBySprint[s]) || 0 }));
              }
              return (
                <div key={person.name} className="bg-neutral-100 rounded-lg shadow-sm p-6" tabIndex={0} aria-label={`Person card for ${person.name}`}> 
                  <div className="font-semibold text-lg mb-2 flex items-center justify-between">
                    <span>{person.name}</span>
                    <div className="flex gap-1">{tags}</div>
                  </div>
                  {tab === "developers" && (
                    <div className="w-full h-10 mb-2">
                      <ResponsiveContainer>
                        <LineChart data={sparkData} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                          <Line type="monotone" dataKey="closed" stroke="#2563eb" strokeWidth={2} dot={false} />
                          <XAxis dataKey="sprint" hide />
                          <YAxis hide domain={[0, 'dataMax']} />
                        </LineChart>
                      </ResponsiveContainer>
                      <div className="text-xs text-neutral-400 text-right">Last 5 sprints</div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-neutral-700 mb-2">
                    {metrics.map(m => (
                      <div key={m.label} title={m.tooltip} tabIndex={0} aria-label={m.tooltip}><span className="font-medium">{m.label}:</span> {m.value}</div>
                    ))}
                  </div>
                  <button className="mt-4 text-sm text-primary hover:underline" onClick={() => setModalPerson(person)} aria-label={`View details for ${person.name}`}>View Details</button>
                </div>
              );
            })}
          </div>
        )}
        {/* MODAL */}
        {modalPerson && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
            <div className="bg-neutral-100 rounded-lg shadow-xl p-6 relative max-w-2xl w-full">
              <button
                className="absolute top-3 right-3 text-neutral-500 hover:text-neutral-700 text-2xl"
                onClick={() => setModalPerson(null)}
                aria-label="Close"
              >
                &times;
              </button>
              <div className="font-bold text-xl text-neutral-800 mb-3">{modalPerson.name}</div>
              <div className="overflow-x-auto mb-4">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-neutral-200 text-neutral-700">
                      <th className="px-2 py-2">Ticket ID</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Time in Dev</th>
                      <th className="px-2 py-2">Time Blocked</th>
                      <th className="px-2 py-2">Sprint</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getPersonTickets(modalPerson).map(t => (
                      <tr key={t.id} className="border-t border-neutral-200 hover:bg-neutral-50">
                        <td className="px-2 py-1 font-mono">{t.id}</td>
                        <td className="px-2 py-1">{t.status}</td>
                        <td className="px-2 py-1">{t.calculatedTotalTimeInDevHours != null ? formatHoursToDuration(t.calculatedTotalTimeInDevHours) : '-'}</td>
                        <td className="px-2 py-1">{t.calculatedTotalTimeBlockedHours != null ? formatHoursToDuration(t.calculatedTotalTimeBlockedHours) : '-'}</td>
                        <td className="px-2 py-1">{t.sprintName || t.sprint || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 text-sm text-neutral-700">
                <span className="font-semibold">Summary:</span> Total Dev Time: <span className="font-mono">{getPersonSummary(modalPerson).totalDev}</span>, Total Blocked Time: <span className="font-mono">{getPersonSummary(modalPerson).totalBlocked}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 