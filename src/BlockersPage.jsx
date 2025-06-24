import { useEffect, useState } from "react";
import Papa from "papaparse";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts";
import { saveAs } from "file-saver";
import { Link } from "react-router-dom";
import { ArrowPathIcon, InformationCircleIcon } from "@heroicons/react/24/solid";

const COLORS = [
  "#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#8dd1e1", "#a4de6c", "#d0ed57", "#d8854f"
];

function parseTimeBlocked(str) {
  // Accepts formats like '1d 2h', '4h', '-', etc.
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

export default function BlockersPage({ tickets = [], loading }) {
  const [ticketsState, setTickets] = useState([]);
  const [loadingState, setLoading] = useState(true);
  const [selectedBlocker, setSelectedBlocker] = useState(null);
  const [barMode, setBarMode] = useState("time"); // "time" or "count"
  const [blockerSearch, setBlockerSearch] = useState("");
  const [sprintFilter, setSprintFilter] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "totalHours", direction: "desc" });
  const [activeTab, setActiveTab] = useState('clarification'); // 'clarification' or 'deprioritization'

  // Use tickets from props if provided, else load from CSV (legacy)
  const ticketsToUse = tickets.length ? tickets : ticketsState;
  const loadingToUse = tickets.length ? loading : loadingState;

  useEffect(() => {
    if (tickets.length) return; // skip if using props
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

  // Aggregate blockers
  const blockerStats = {};
  let totalBlockedHours = 0;
  ticketsToUse.forEach(ticket => {
    const eventLog = ticket.eventLogParsed || [];
    const sprint = ticket.sprintName || ticket.sprint || "No Sprint";
    // Find all block events in eventLogParsed
    const blockEvents = eventLog.filter(ev => ev.status === 'Blocked');
    blockEvents.forEach(ev => {
      const entity = ticket.blockedBy || ev.blockedBy || ev.by || "Unknown";
      if (!blockerStats[entity]) {
        blockerStats[entity] = {
          entity,
          count: 0,
          totalHours: 0,
          maxHours: 0,
          blockDurations: [],
          mostRecent: null,
          mostRecentDate: null,
          sprints: new Set(),
          ticketIds: new Set(),
          blockTimestamps: [],
          blockSprints: new Set(),
        };
      }
      // Find the end of this block (next non-blocked event or end of log)
      let blockEnd = null;
      for (let i = eventLog.indexOf(ev) + 1; i < eventLog.length; i++) {
        if (eventLog[i].status !== 'Blocked') {
          blockEnd = eventLog[i].timestamp;
          break;
        }
      }
      // If still blocked, use now
      if (!blockEnd) blockEnd = ticket.status === 'Blocked' ? new Date() : null;
      let durationH = null;
      if (blockEnd && ev.timestamp) {
        durationH = Math.max(1, Math.round((new Date(blockEnd) - new Date(ev.timestamp)) / 36e5));
      }
      if (durationH) {
        blockerStats[entity].blockDurations.push(durationH);
        blockerStats[entity].totalHours += durationH;
        blockerStats[entity].maxHours = Math.max(blockerStats[entity].maxHours, durationH);
        totalBlockedHours += durationH;
      }
      blockerStats[entity].count += 1;
      blockerStats[entity].sprints.add(sprint);
      blockerStats[entity].ticketIds.add(ticket.id);
      blockerStats[entity].blockTimestamps.push(ev.timestamp);
      blockerStats[entity].blockSprints.add(sprint);
      // Most recent block event timestamp
      if (!blockerStats[entity].mostRecentDate || (ev.timestamp && ev.timestamp > blockerStats[entity].mostRecentDate)) {
        blockerStats[entity].mostRecentDate = ev.timestamp;
        blockerStats[entity].mostRecent = ticket;
      }
    });
  });

  // Prepare table data
  let tableData = Object.values(blockerStats).map(b => ({
    ...b,
    avgHours: b.blockDurations.length ? Math.round((b.totalHours / b.blockDurations.length) * 10) / 10 : 0,
    sprints: Array.from(b.sprints),
    repeatOffender: b.count > 3 && b.blockSprints.size > 1,
    ticketIds: Array.from(b.ticketIds),
  }));

  // --- FILTERING ---
  if (selectedBlocker) {
    tableData = tableData.filter(b => b.entity === selectedBlocker);
  }
  if (blockerSearch.trim()) {
    tableData = tableData.filter(b => b.entity.toLowerCase().includes(blockerSearch.toLowerCase()));
  }
  if (sprintFilter) {
    tableData = tableData.filter(b => b.sprints.includes(sprintFilter));
  }

  // --- SORTING ---
  if (sortConfig.key) {
    tableData = [...tableData].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      if (sortConfig.key === "entity") {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      } else {
        return sortConfig.direction === "asc"
          ? aVal.toString().localeCompare(bVal.toString())
          : bVal.toString().localeCompare(aVal.toString());
      }
    });
  }

  // Pie/bar chart data (not filtered by search/sprint)
  const pieData = Object.values(blockerStats).map(b => ({
    name: b.entity,
    value: b.totalHours,
    count: b.count,
  }));
  const barData = [...pieData]
    .sort((a, b) =>
      barMode === "time" ? b.value - a.value : b.count - a.count
    );

  function handleExport() {
    const csv = toCSV(tableData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    saveAs(blob, "blockers.csv");
  }

  // Pie slice click handler
  function handlePieClick(data, idx) {
    if (!data || !data.name) return;
    setSelectedBlocker(prev => (prev === data.name ? null : data.name));
  }

  function handleSort(key) {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      } else {
        return { key, direction: "desc" };
      }
    });
  }

  // --- SPRINTS ---
  const allSprints = Array.from(new Set(ticketsToUse.map(t => t.sprint || "No Sprint")));

  // --- Blocked Hours Trend Data (Line Chart) ---
  // Group by sprint (chronological order)
  const sprintBlockedHours = {};
  ticketsToUse.forEach(ticket => {
    const sprint = ticket.sprintName || ticket.sprint || "No Sprint";
    const blockedH = ticket.calculatedTotalTimeBlockedHours || 0;
    if (!sprintBlockedHours[sprint]) sprintBlockedHours[sprint] = 0;
    sprintBlockedHours[sprint] += blockedH;
  });
  // Prepare data for last 8 sprints (or all)
  const sprintNamesChrono = Object.keys(sprintBlockedHours).sort();
  const lastSprints = sprintNamesChrono.slice(-8);
  const lineChartData = lastSprints.map(sprint => ({
    sprint,
    totalBlocked: sprintBlockedHours[sprint] || 0,
  }));

  // --- SUMMARY METRICS ---
  const totalTicketsBlocked = Object.values(blockerStats).reduce((acc, b) => acc + b.ticketIds.size, 0);

  // --- Clarification Blockers Data ---
  const clarificationTickets = ticketsToUse.filter(ticket => {
    const log = ticket.eventLogParsed || [];
    return log.length && log[log.length - 1].status === 'Blocked for Clarification';
  });
  // Aggregate by blocker entity for clarification
  const clarificationStats = {};
  clarificationTickets.forEach(ticket => {
    const log = ticket.eventLogParsed || [];
    const last = log[log.length - 1];
    const entity = last && (last.blockedBy || last.by || last.user || ticket.blockedBy || 'Unknown');
    if (!clarificationStats[entity]) clarificationStats[entity] = { entity, count: 0, totalHours: 0, tickets: [] };
    // Duration in clarification
    let clarStart = null;
    for (let i = log.length - 1; i >= 0; i--) {
      if (log[i].status === 'Blocked for Clarification') {
        clarStart = log[i].timestamp;
        break;
      }
    }
    let clarHours = 0;
    if (clarStart) {
      clarHours = Math.max(1, Math.round((new Date() - new Date(clarStart)) / 36e5));
    }
    clarificationStats[entity].count++;
    clarificationStats[entity].totalHours += clarHours;
    clarificationStats[entity].tickets.push({ ...ticket, clarHours });
  });
  const clarificationTable = Object.values(clarificationStats).sort((a, b) => b.totalHours - a.totalHours);

  // --- Deprioritization Events Data ---
  // Find all tickets that have ever entered 'Deprioritized' state
  const deprioritizedTickets = ticketsToUse.filter(ticket => (ticket.eventLogParsed || []).some(ev => ev.status === 'Deprioritized'));
  // Sprints with most deprioritized tickets
  const sprintDeprioritized = {};
  deprioritizedTickets.forEach(ticket => {
    const sprint = ticket.sprintName || ticket.sprint || 'No Sprint';
    if (!sprintDeprioritized[sprint]) sprintDeprioritized[sprint] = 0;
    sprintDeprioritized[sprint]++;
  });
  const sprintDeprioritizedData = Object.entries(sprintDeprioritized).map(([sprint, count]) => ({ sprint, count })).sort((a, b) => b.count - a.count);
  // Most common reasons for deprioritization
  const deprioritizeReasons = {};
  deprioritizedTickets.forEach(ticket => {
    const log = ticket.eventLogParsed || [];
    log.forEach(ev => {
      if (ev.status === 'Deprioritized' && ev.note) {
        const reason = ev.note.trim() || 'Unspecified';
        if (!deprioritizeReasons[reason]) deprioritizeReasons[reason] = 0;
        deprioritizeReasons[reason]++;
      }
    });
  });
  const deprioritizeReasonsData = Object.entries(deprioritizeReasons).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
  // Tickets most frequently deprioritized (by count of 'Deprioritized' events)
  const ticketDeprioritizeCounts = deprioritizedTickets.map(ticket => {
    const count = (ticket.eventLogParsed || []).filter(ev => ev.status === 'Deprioritized').length;
    return { id: ticket.id, title: ticket.title, count };
  }).sort((a, b) => b.count - a.count);

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold text-neutral-800 mb-6">Blocker & Delay Analysis</h1>
      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          className={`px-4 py-2 rounded-t-lg font-semibold border-b-2 transition-all ${activeTab === 'clarification' ? 'border-primary text-primary bg-white' : 'border-transparent text-neutral-500 bg-neutral-100'}`}
          onClick={() => setActiveTab('clarification')}
        >
          Clarification Blockers
        </button>
        <button
          className={`px-4 py-2 rounded-t-lg font-semibold border-b-2 transition-all ${activeTab === 'deprioritization' ? 'border-primary text-primary bg-white' : 'border-transparent text-neutral-500 bg-neutral-100'}`}
          onClick={() => setActiveTab('deprioritization')}
        >
          Deprioritization Events
        </button>
      </div>
      {activeTab === 'clarification' ? (
        <div>
          <h2 className="text-lg font-semibold mb-4">Tickets Blocked for Clarification</h2>
          <div className="overflow-x-auto bg-white rounded shadow p-4 mb-8">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-neutral-100 text-left">
                  <th className="px-4 py-2">Blocker Entity</th>
                  <th className="px-4 py-2"># Tickets</th>
                  <th className="px-4 py-2">Total Hours Blocked</th>
                  <th className="px-4 py-2">Tickets</th>
                </tr>
              </thead>
              <tbody>
                {clarificationTable.length === 0 ? (
                  <tr><td colSpan={4} className="text-center text-neutral-400 py-4">No clarification blockers found.</td></tr>
                ) : clarificationTable.map(row => (
                  <tr key={row.entity} className="border-t">
                    <td className="px-4 py-2 font-mono">{row.entity}</td>
                    <td className="px-4 py-2">{row.count}</td>
                    <td className="px-4 py-2">{row.totalHours}</td>
                    <td className="px-4 py-2">
                      {row.tickets.map(t => (
                        <span key={t.id} className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-mono mr-1 mb-1">{t.id} ({t.clarHours}h)</span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div>
          <h2 className="text-lg font-semibold mb-4">Deprioritization Events</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="bg-white rounded shadow p-4">
              <h3 className="font-semibold mb-2">Sprints with Most Deprioritized Tickets</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={sprintDeprioritizedData} layout="vertical" margin={{ left: 80, right: 24, top: 24, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="sprint" type="category" width={80} />
                  <Tooltip formatter={v => `${v} tickets`} />
                  <Bar dataKey="count" fill="#fb923c" name="# Deprioritized" radius={[4, 4, 4, 4]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded shadow p-4">
              <h3 className="font-semibold mb-2">Most Common Reasons for Deprioritization</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={deprioritizeReasonsData} dataKey="count" nameKey="reason" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} (${Math.round(percent * 100)}%)`}>
                    {deprioritizeReasonsData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value} tickets`, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white rounded shadow p-4">
            <h3 className="font-semibold mb-2">Tickets Most Frequently Deprioritized</h3>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-neutral-100 text-left">
                  <th className="px-4 py-2">Ticket ID</th>
                  <th className="px-4 py-2">Title</th>
                  <th className="px-4 py-2"># Times Deprioritized</th>
                </tr>
              </thead>
              <tbody>
                {ticketDeprioritizeCounts.length === 0 ? (
                  <tr><td colSpan={3} className="text-center text-neutral-400 py-4">No deprioritization events found.</td></tr>
                ) : ticketDeprioritizeCounts.map(row => (
                  <tr key={row.id} className="border-t">
                    <td className="px-4 py-2 font-mono">{row.id}</td>
                    <td className="px-4 py-2">{row.title}</td>
                    <td className="px-4 py-2">{row.count}</td>
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