import { useEffect, useState, useMemo } from "react";
import Papa from "papaparse";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, LineChart, Line } from "recharts";
import { saveAs } from "file-saver";
import { ArrowPathIcon, InformationCircleIcon } from "@heroicons/react/24/solid";
import { formatHoursToDuration } from "./utils.js";
import { Link } from "react-router-dom";

function toCSV(rows) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(",")].concat(
    rows.map(row => keys.map(k => `"${(row[k] || "").replace(/"/g, '""')}"`).join(","))
  ).join("\n");
  return csv;
}

const STATUS_COLORS = {
  "In Progress": "#fbbf24",
  "Blocked": "#f87171",
  "In Review": "#2563eb",
  "Done": "#22c55e",
  "Deployed": "#0ea5e9",
  "Backlog": "#a3a3a3",
};

const TEAM_WORKLOAD_STATUSES = [
  "In Development",
  "Blocked for Clarification",
  "Tech QC",
  "Business QC"
];
const TEAM_WORKLOAD_COLORS = {
  "In Development": "#2563eb",
  "Blocked for Clarification": "#f87171",
  "Tech QC": "#fbbf24",
  "Business QC": "#a3e635"
};

// PersonCard component
function PersonCard({ person, onShowUserDetail, workloadStatuses, workloadColors, onViewDetails }) {
  // Calculate metrics
  const openTickets = workloadStatuses.reduce((sum, status) => sum + (person.workload[status] || 0), 0);
  const avgCloseTimeDays = person.avgCloseTimeDays != null ? person.avgCloseTimeDays : '-';
  // Prepare workload bar data
  const barData = workloadStatuses.map(status => ({ status, value: person.workload[status] || 0 }));
  // Role
  const role = person.role || person.team || 'Developer';
  return (
    <div className="bg-white rounded-lg shadow p-5 flex flex-col gap-2" tabIndex={0} aria-label={`Person card for ${person.name}`}> 
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => onShowUserDetail && onShowUserDetail(person.name)} className="text-indigo-700 hover:text-indigo-900 font-bold text-lg p-0 bg-transparent text-left">{person.name}</button>
        <span className="text-xs bg-neutral-200 text-neutral-700 rounded px-2 py-0.5 font-semibold ml-2">{role}</span>
      </div>
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-2 text-sm mb-2">
        <div className="bg-neutral-50 rounded p-2 flex flex-col items-center">
          <div className="text-xs text-neutral-500">Open Tickets</div>
          <div className="font-bold text-primary text-lg">{openTickets}</div>
        </div>
        <div className="bg-neutral-50 rounded p-2 flex flex-col items-center">
          <div className="text-xs text-neutral-500">Avg. Close Time</div>
          <div className="font-bold text-blue-700 text-lg">{avgCloseTimeDays}d</div>
        </div>
        <div className="bg-neutral-50 rounded p-2 flex flex-col items-center">
          <div className="text-xs text-neutral-500">Blocks Caused</div>
          <div className="font-bold text-red-500 text-lg">{person.blocksCaused}</div>
        </div>
        <div className="bg-neutral-50 rounded p-2 flex flex-col items-center">
          <div className="text-xs text-neutral-500">Blocks Resolved</div>
          <div className="font-bold text-green-600 text-lg">{person.blocksResolved}</div>
        </div>
      </div>
      {/* Workload Bar */}
      <div className="w-full h-6 mb-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData} layout="horizontal" margin={{ left: 0, right: 0, top: 0, bottom: 0 }} barCategoryGap={2}>
            <XAxis dataKey="status" hide />
            <YAxis hide />
            {barData.map((entry, idx) => (
              <Bar key={entry.status} dataKey="value" stackId="a" fill={workloadColors[entry.status] || '#a3a3a3'} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="text-xs text-neutral-400 text-right">Current workload</div>
      <button className="mt-2 text-sm text-primary hover:underline self-end" onClick={() => onViewDetails(person)} aria-label={`View details for ${person.name}`}>View Details</button>
    </div>
  );
}

// DeveloperCard component
function DeveloperCard({ developer, onShowUserDetail, assignedTickets, isExpanded, onToggleDetails, showTicketDetail }) {
  return (
    <div className="bg-white rounded-lg shadow p-5 flex flex-col gap-2" tabIndex={0} aria-label={`Developer card for ${developer.name}`}> 
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => onShowUserDetail && onShowUserDetail(developer.name)} className="text-indigo-700 hover:text-indigo-900 font-bold text-lg p-0 bg-transparent text-left">{developer.name}</button>
        <span className="text-xs bg-neutral-200 text-neutral-700 rounded px-2 py-0.5 font-semibold ml-2">Developer</span>
      </div>
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-2 text-sm mb-2">
        <div className="bg-neutral-50 rounded p-2 flex flex-col items-center">
          <div className="text-xs text-neutral-500">Open Tickets</div>
          <div className="font-bold text-primary text-lg">{developer.openTickets}</div>
        </div>
        <div className="bg-neutral-50 rounded p-2 flex flex-col items-center">
          <div className="text-xs text-neutral-500">Avg. Close Time</div>
          <div className="font-bold text-blue-700 text-lg">{developer.avgCloseTimeDays != null ? developer.avgCloseTimeDays + 'd' : '-'}</div>
        </div>
        <div className="bg-neutral-50 rounded p-2 flex flex-col items-center">
          <div className="text-xs text-neutral-500">Throughput (30d)</div>
          <div className="font-bold text-green-600 text-lg">{developer.throughput30d}</div>
        </div>
        <div className="bg-neutral-50 rounded p-2 flex flex-col items-center">
          <div className="text-xs text-neutral-500">Code Revisions</div>
          <div className="font-bold text-yellow-600 text-lg">{developer.codeRevisions}</div>
        </div>
      </div>
      <button
        className="mt-2 text-sm text-primary hover:underline self-end"
        onClick={onToggleDetails}
        aria-label={`View assigned tickets for ${developer.name}`}
      >
        {isExpanded ? 'Hide Assigned Tickets' : 'View Assigned Tickets'}
      </button>
      {isExpanded && (
        <div className="mt-3 border-t pt-3">
          <div className="text-xs font-semibold mb-2">Assigned Tickets</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-neutral-100 text-neutral-700">
                  <th className="px-2 py-1">Ticket ID</th>
                  <th className="px-2 py-1">Title</th>
                  <th className="px-2 py-1">Status</th>
                  <th className="px-2 py-1">Sprint</th>
                  <th className="px-2 py-1">Time in Dev</th>
                  <th className="px-2 py-1">Time Blocked</th>
                </tr>
              </thead>
              <tbody>
                {assignedTickets.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-neutral-400 py-2">No open tickets assigned.</td></tr>
                ) : assignedTickets.map(t => (
                  <tr key={t.id} className="border-t border-neutral-200 hover:bg-neutral-50">
                    <td className="px-2 py-1 font-mono">
                      <button type="button" onClick={() => showTicketDetail && showTicketDetail(t.id)} className="text-indigo-600 hover:text-indigo-800 font-medium text-left p-0 bg-transparent">{t.id}</button>
                    </td>
                    <td className="px-2 py-1">{t.title}</td>
                    <td className="px-2 py-1">{t.status}</td>
                    <td className="px-2 py-1">{t.sprintName || t.sprint || '-'}</td>
                    <td className="px-2 py-1">{t.calculatedTotalTimeInDevHours != null ? formatHoursToDuration(t.calculatedTotalTimeInDevHours) : '-'}</td>
                    <td className="px-2 py-1">{t.calculatedTotalTimeBlockedHours != null ? formatHoursToDuration(t.calculatedTotalTimeBlockedHours) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PeoplePage({ tickets = [], loading, onShowUserDetail, showTicketDetail }) {
  const [ticketsState, setTickets] = useState([]);
  const [loadingState, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: "ticketsOwned", direction: "desc" });
  const [searchTerm, setSearchTerm] = useState("");
  const [sprintFilter, setSprintFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [modalPerson, setModalPerson] = useState(null);
  const [expandedDeveloper, setExpandedDeveloper] = useState(null);

  // Use tickets from props if provided, else load from CSV (legacy)
  const ticketsToUse = tickets.length ? tickets : ticketsState;
  const loadingToUse = tickets.length ? loading : loadingState;

  useEffect(() => {
    if (tickets.length) return;
    setLoading(true);
    Papa.parse("/ticket.csv", {
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
  const allSprints = useMemo(() => Array.from(new Set(ticketsToUse.map(t => t.sprint || "No Sprint"))), [ticketsToUse]);
  const allTeams = useMemo(() => Array.from(new Set(ticketsToUse.map(t => t.team).filter(Boolean))), [ticketsToUse]);

  // --- AGGREGATE DEVELOPERS ONLY ---
  // Only include unique owners (developers) from tickets
  const allDeveloperNames = useMemo(() => {
    return Array.from(new Set(ticketsToUse.map(t => t.owner).filter(Boolean)));
  }, [ticketsToUse]);

  // --- METRICS PER DEVELOPER ---
  const peopleStats = useMemo(() => {
    const stats = {};
    const now = new Date();
    const ms30d = 30 * 24 * 60 * 60 * 1000;
    allDeveloperNames.forEach(name => {
      stats[name] = {
        name,
        openTickets: 0,
        avgCloseTimeDays: null,
        throughput30d: 0,
        codeRevisions: 0,
        closeTimes: [],
      };
    });
  ticketsToUse.forEach(ticket => {
      if (!ticket.owner || !stats[ticket.owner]) return;
      // Open Tickets: not Released
      if (ticket.status !== 'Released') {
        stats[ticket.owner].openTickets += 1;
      }
      // Avg. Close Time: from first 'In Development' to 'Released'
      if (ticket.status === 'Released' && ticket.eventLogParsed) {
        const inDevEvent = ticket.eventLogParsed.find(ev => ev.status === 'In Development');
        const releasedEvent = ticket.eventLogParsed.find(ev => ev.status === 'Released');
        if (inDevEvent && releasedEvent && inDevEvent.timestamp && releasedEvent.timestamp) {
          const ms = new Date(releasedEvent.timestamp) - new Date(inDevEvent.timestamp);
          if (ms > 0) stats[ticket.owner].closeTimes.push(ms / (1000 * 60 * 60 * 24));
        }
      }
      // Throughput (Last 30d): Released in last 30 days
      if (ticket.status === 'Released' && ticket.eventLogParsed) {
        const releasedEvent = ticket.eventLogParsed.find(ev => ev.status === 'Released');
        if (releasedEvent && releasedEvent.timestamp && (now - new Date(releasedEvent.timestamp)) <= ms30d) {
          stats[ticket.owner].throughput30d += 1;
        }
      }
      // Code Revisions: count transitions from QC (Tech QC or Business QC) back to In Development
      if (ticket.eventLogParsed) {
        let lastStatus = null;
        ticket.eventLogParsed.forEach(ev => {
          if ((lastStatus === 'Tech QC' || lastStatus === 'Business QC') && ev.status === 'In Development') {
            stats[ticket.owner].codeRevisions += 1;
          }
          lastStatus = ev.status;
        });
      }
    });
    Object.values(stats).forEach(dev => {
      if (dev.closeTimes.length > 0) {
        const avg = dev.closeTimes.reduce((a, b) => a + b, 0) / dev.closeTimes.length;
        dev.avgCloseTimeDays = Math.round(avg * 10) / 10;
      }
    });
    return Object.values(stats);
  }, [allDeveloperNames, ticketsToUse]);

  // --- TEAM WORKLOAD OVERVIEW DATA (Developers only) ---
  const teamWorkloadData = useMemo(() => {
    // Only include developers with at least one open ticket in the tracked statuses
    const peopleMap = {};
    ticketsToUse.forEach(ticket => {
      if (!TEAM_WORKLOAD_STATUSES.includes(ticket.status)) return;
      const owner = ticket.owner;
      if (!owner || !allDeveloperNames.includes(owner)) return;
      if (!peopleMap[owner]) {
        peopleMap[owner] = { name: owner };
        TEAM_WORKLOAD_STATUSES.forEach(status => {
          peopleMap[owner][status] = 0;
        });
        }
      peopleMap[owner][ticket.status] += 1;
    });
    // Only show developers with at least one open ticket in these statuses
    return Object.values(peopleMap).filter(person => TEAM_WORKLOAD_STATUSES.some(status => person[status] > 0));
  }, [ticketsToUse, allDeveloperNames]);

  // --- SPRINTS FOR TRENDLINE ---
  const allSprintsChrono = useMemo(() => {
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
  }, [ticketsToUse]);

  // --- DEVELOPER WORKLOAD CHART DATA ---
  const developerWorkloadData = useMemo(() => {
    // Only include developers with at least one open ticket in the tracked statuses
    const peopleMap = {};
    ticketsToUse.forEach(ticket => {
      if (!TEAM_WORKLOAD_STATUSES.includes(ticket.status)) return;
      const owner = ticket.owner;
      if (!owner || !allDeveloperNames.includes(owner)) return;
      if (!peopleMap[owner]) {
        peopleMap[owner] = { name: owner };
        TEAM_WORKLOAD_STATUSES.forEach(status => {
          peopleMap[owner][status] = 0;
        });
      }
      peopleMap[owner][ticket.status] += 1;
    });
    // Only show developers with at least one open ticket in these statuses
    return Object.values(peopleMap).filter(person => TEAM_WORKLOAD_STATUSES.some(status => person[status] > 0));
  }, [ticketsToUse, allDeveloperNames]);

  // --- FILTERING ---
  let filteredPeople = peopleStats;
  if (searchTerm.trim()) {
    filteredPeople = filteredPeople.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }
  if (sprintFilter) {
    filteredPeople = filteredPeople.filter(p =>
      ticketsToUse.some(t =>
        t.owner === p.name && (t.sprint || "No Sprint") === sprintFilter
      )
    );
  }
  if (teamFilter) {
    filteredPeople = filteredPeople.filter(p => p.team === teamFilter);
  }
  if (sortConfig.key) {
    filteredPeople = [...filteredPeople].sort((a, b) => {
      let aVal = a[sortConfig.key] || 0;
      let bVal = b[sortConfig.key] || 0;
      return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
    });
  }

  function handleExport() {
    const csv = toCSV(filteredPeople);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    saveAs(blob, "people.csv");
  }

  // --- DRILL-DOWN MODAL ---
  function getPersonTickets(person) {
    if (!person) return [];
    return ticketsToUse.filter(t =>
      t.owner === person.name && TEAM_WORKLOAD_STATUSES.includes(t.status)
    );
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

  // --- WORKLOAD STATUS KEYS ---
  const statusKeys = ["In Progress", "Blocked", "In Review", "Done", "Deployed", "Backlog"];

  const handleToggleDetails = (developerName) => {
    setExpandedDeveloper(prevExpanded => prevExpanded === developerName ? null : developerName);
  };

  return (
    <div>
      {/* DEVELOPER WORKLOAD CHART */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-neutral-700 mb-2">Current Open Workload per Developer</h2>
        <div className="w-full h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={developerWorkloadData}
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
              {TEAM_WORKLOAD_STATUSES.map(status => (
                <Bar
                  key={status}
                  dataKey={status}
                  stackId="a"
                  fill={TEAM_WORKLOAD_COLORS[status]}
                  name={status}
                  radius={[4, 4, 4, 4]}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="text-xs text-gray-500 mt-2">Shows the number of currently open tickets assigned to each developer, segmented by status. Helps spot overload and blocked work.</div>
      </div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-neutral-800 mb-6">People Resource Dashboard</h1>
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
        {/* SORT BUTTONS */}
        <div className="flex gap-2 mb-4">
          {[
            { key: "ticketsOwned", label: "Tickets Owned" },
            { key: "blocksResolved", label: "Blocks Resolved" },
            { key: "blocksCaused", label: "Blocks Caused" },
            { key: "timeHeld", label: "Time Held" },
          ].map(metric => (
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
        {/* PEOPLE CARDS GRID */}
        {loadingToUse ? (
          <div className="flex flex-col items-center justify-center py-8 text-neutral-500">
            <ArrowPathIcon className="h-10 w-10 animate-spin mb-2" />
            <div>Loading data...</div>
          </div>
        ) : filteredPeople.length === 0 ? (
          <div className="text-center py-8 text-neutral-500 flex flex-col items-center justify-center">
            <InformationCircleIcon className="h-10 w-10 mb-2" />
            <div>No data available. Try adjusting your filters or search.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPeople.map(developer => (
              <DeveloperCard
                key={developer.name}
                developer={developer}
                onShowUserDetail={onShowUserDetail}
                assignedTickets={ticketsToUse.filter(t => t.owner === developer.name && t.status !== 'Released')}
                isExpanded={expandedDeveloper === developer.name}
                onToggleDetails={() => handleToggleDetails(developer.name)}
                showTicketDetail={showTicketDetail}
              />
            ))}
          </div>
        )}
        {/* MODAL for Person Details */}
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
              <div className="font-bold text-xl text-neutral-800 mb-3">{modalPerson.name} - Details</div>
              {/* Mini Trendline Chart */}
              <div className="mb-4">
                <div className="text-sm font-semibold mb-1">Ticket Closures (Last 5 Sprints)</div>
                <div className="w-full h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={(() => {
                      // Get last 5 sprints
                      const sprints = allSprintsChrono.slice(-5);
                      // Count tickets closed by this person per sprint
                      return sprints.map(sprint => ({
                        sprint,
                        closed: ticketsToUse.filter(t => t.owner === modalPerson.name && (t.sprintName || t.sprint) === sprint && (t.status === 'Done' || t.status === 'Deployed')).length
                      }));
                    })()}>
                      <XAxis dataKey="sprint" tick={{ fontSize: 10 }} />
                      <YAxis hide domain={[0, 'dataMax']} />
                      <Line type="monotone" dataKey="closed" stroke="#2563eb" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* Tickets Table */}
              <div className="overflow-x-auto mb-4">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-neutral-200 text-neutral-700">
                      <th className="px-2 py-2">Ticket ID</th>
                      <th className="px-2 py-2">Title</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Sprint</th>
                      <th className="px-2 py-2">Time in Dev</th>
                      <th className="px-2 py-2">Time Blocked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ticketsToUse.filter(t => t.owner === modalPerson.name && TEAM_WORKLOAD_STATUSES.includes(t.status)).map(t => (
                      <tr key={t.id} className="border-t border-neutral-200 hover:bg-neutral-50 cursor-pointer">
                        <td className="px-2 py-1 font-mono">{t.id}</td>
                        <td className="px-2 py-1">{t.title}</td>
                        <td className="px-2 py-1">{t.status}</td>
                        <td className="px-2 py-1">{t.sprintName || t.sprint || '-'}</td>
                        <td className="px-2 py-1">{t.calculatedTotalTimeInDevHours != null ? formatHoursToDuration(t.calculatedTotalTimeInDevHours) : '-'}</td>
                        <td className="px-2 py-1">{t.calculatedTotalTimeBlockedHours != null ? formatHoursToDuration(t.calculatedTotalTimeBlockedHours) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 