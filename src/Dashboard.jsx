import React, { useState } from "react";
import { useTicketsContext } from "./TicketsContext.jsx";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell, CartesianGrid } from "recharts";
import { ExclamationCircleIcon, UserGroupIcon, FireIcon, ArrowPathIcon } from "@heroicons/react/24/solid";
import { Gantt, ViewMode } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import TimeAnalysisChart from './TimeAnalysisChart';
import TicketsPage from "./TicketsPage.jsx";
import BlockersPage from "./BlockersPage.jsx";
import SprintsPage from "./SprintsPage.jsx";
import PeoplePage from "./PeoplePage.jsx";
import InsightsEngine from "./InsightsEngine.jsx";
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

const DEFAULT_LAYOUT = [
  { i: 'insights', x: 0, y: 0, w: 12, h: 3, minH: 2 },
  { i: 'kpi', x: 0, y: 3, w: 12, h: 4, minH: 3 },
  { i: 'team', x: 0, y: 7, w: 6, h: 4, minH: 3 },
  { i: 'time', x: 6, y: 7, w: 6, h: 4, minH: 3 },
  { i: 'blockers', x: 0, y: 11, w: 6, h: 6, minH: 4 },
  { i: 'velocity', x: 6, y: 11, w: 6, h: 6, minH: 4 },
  { i: 'gantt', x: 0, y: 17, w: 12, h: 5, minH: 3 },
  { i: 'workdone', x: 0, y: 22, w: 12, h: 8, minH: 5 },
];

function getStoredLayout() {
  try {
    const l = localStorage.getItem('dashboardLayout');
    return l ? JSON.parse(l) : null;
  } catch {
    return null;
  }
}
function saveLayout(layout) {
  localStorage.setItem('dashboardLayout', JSON.stringify(layout));
}

function groupBySprint(tickets) {
  const sprints = {};
  tickets.forEach(ticket => {
    const sprint = ticket.sprint || "No Sprint";
    if (!sprints[sprint]) sprints[sprint] = [];
    sprints[sprint].push(ticket);
  });
  return sprints;
}

function getLatestSprintName(tickets) {
  // Find the latest sprint name by sorting by date if possible, else by name
  const sprints = Array.from(new Set(tickets.map(t => t.sprintName || t.sprint || 'No Sprint')));
  // Try to sort by date if sprints are date-like
  const dateSprints = sprints.filter(s => /\d{4}-\d{2}-\d{2}/.test(s));
  if (dateSprints.length === sprints.length) {
    return dateSprints.sort().slice(-1)[0];
  }
  // Otherwise, sort by name (assume last is latest)
  return sprints.sort().slice(-1)[0];
}

function Dashboard({ onShowTicketDetail, onShowUserDetail }) {
  const { tickets, loading } = useTicketsContext();
  const [velocityMode, setVelocityMode] = useState('tickets'); // 'tickets' or 'hours'
  const [blockedThresholdDays, setBlockedThresholdDays] = useState(3); // user-defined threshold
  const [ganttViewMode, setGanttViewMode] = useState(ViewMode.Week);
  const [workdoneSearch, setWorkdoneSearch] = useState('');
  const [workdoneSort, setWorkdoneSort] = useState({ key: 'id', direction: 'asc' });
  // New: filter state for dashboard interactivity
  const [barFilter, setBarFilter] = useState(null); // { sprint: string, status: string } | null
  // Modal state
  const [modal, setModal] = useState(null); // { type: 'tickets'|'blockers'|'sprints'|'people' }
  const [layout, setLayout] = React.useState(getStoredLayout() || DEFAULT_LAYOUT);

  // Default handlers if props are not provided
  const showTicketDetail = onShowTicketDetail || (() => {});
  const showUserDetail = onShowUserDetail || (() => {});

  // Auto-detect current sprint
  const currentSprintName = getLatestSprintName(tickets);

  // Total tickets
  const totalTickets = tickets.length;

  // Group by sprint
  const sprints = groupBySprint(tickets);
  const sprintNames = Object.keys(sprints).sort();
  const currentSprint = sprintNames[sprintNames.length - 1];

  // Helper: filter tickets by barFilter if set
  const filteredTickets = barFilter
    ? tickets.filter(t => {
        const sprintName = t.sprintName || t.sprint || 'No Sprint';
        if (sprintName !== barFilter.sprint) return false;
        if (barFilter.status === 'Completed') return t.status === 'Done';
        if (barFilter.status === 'Blocked') return t.isBlocked || t.blocked === 'TRUE' || t.blocked === true;
        if (barFilter.status === 'Open') return !((t.status === 'Done') || t.isBlocked || t.blocked === 'TRUE' || t.blocked === true);
        return false;
      })
    : tickets;

  // Top 3 blockers (by count, across filtered tickets)
  const blockerStats = {};
  filteredTickets.forEach(t => {
    // Calculate total blocked time using new granular properties
    const totalBlockedTime = (t.timeInClarificationHours || 0) + (t.timeDeprioritizedHours || 0);
    if (t.isBlocked || totalBlockedTime > 0) {
      const entity = t.blockedBy || "Unknown";
      if (!blockerStats[entity]) blockerStats[entity] = { count: 0, totalBlocked: 0 };
      blockerStats[entity].count += 1;
      blockerStats[entity].totalBlocked += totalBlockedTime;
    }
  });
  const topBlockers = Object.entries(blockerStats)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3);

  // Developer velocity chart (tickets closed per sprint, filtered)
  const completedStatuses = ['Done', 'Deployed'];
  const velocityData = sprintNames.map(sprint => {
    // If filtered, only show for the selected sprint
    if (barFilter && barFilter.sprint !== sprint) return { sprint, value: 0 };
    const sprintTickets = sprints[sprint] || [];
    // If filtered, only include tickets matching the status
    const filteredSprintTickets = barFilter
      ? sprintTickets.filter(t => {
          if (barFilter.status === 'Completed') return t.status === 'Done';
          if (barFilter.status === 'Blocked') return t.isBlocked || t.blocked === 'TRUE' || t.blocked === true;
          if (barFilter.status === 'Open') return !((t.status === 'Done') || t.isBlocked || t.blocked === 'TRUE' || t.blocked === true);
          return false;
        })
      : sprintTickets;
    if (velocityMode === 'tickets') {
      const closed = filteredSprintTickets.filter(t => completedStatuses.includes(t.status)).length;
      return { sprint, value: closed };
    } else {
      const hours = filteredSprintTickets
        .filter(t => completedStatuses.includes(t.status))
        .reduce((sum, t) => {
          // Calculate total development time using new granular properties
          const devTime = (t.timeInDevelopmentHours || 0) + 
                         (t.timeInTechQCHours || 0) + 
                         (t.timeInBusinessQCHours || 0) +
                         (t.timeInSprintBacklogHours || 0);
          return sum + devTime;
        }, 0);
      return { sprint, value: hours };
    }
  });

  // --- ENHANCEMENT 8: More Granular Dashboard Metrics ---
  // Average Time to Close (for Done tickets)
  const doneTickets = filteredTickets.filter(t => t.status === 'Done' && typeof t.totalCycleTimeHours === 'number');
  const avgTimeToClose = doneTickets.length
    ? Math.round(doneTickets.reduce((sum, t) => sum + t.totalCycleTimeHours, 0) / doneTickets.length)
    : null;

  // Tickets Blocked > X Days (user-defined threshold)
  const ticketsBlockedOverXDays = filteredTickets.filter(t => {
    const thresholdHours = blockedThresholdDays * 24;
    if (t.isBlocked && t.currentBlockDurationHours > thresholdHours) return true;
    // Calculate total blocked time using new granular properties
    const totalBlockedTime = (t.timeInClarificationHours || 0) + (t.timeDeprioritizedHours || 0);
    if (!t.isBlocked && totalBlockedTime > thresholdHours) return true;
    return false;
  }).length;

  // --- ENHANCEMENT 9: Refine Blocked This Sprint ---
  // Use isBlocked and sprintName
  const currentSprintTickets = filteredTickets.filter(t => t.sprintName === currentSprintName);
  const blockedThisSprint = currentSprintTickets.filter(t => t.isBlocked).length;

  // --- Sprint Timeline (Gantt) Data ---
  // Each sprint is a bar from earliest to latest ticket in that sprint
  let sprintGanttTasks = sprintNames.map((sprint, idx) => {
    const sprintTickets = sprints[sprint];
    if (!sprintTickets.length) return null;
    // Find earliest and latest ticket dates in this sprint
    const dates = sprintTickets
      .map(t => t.Created_On_Date || t.createdAt || t.created_on || t.created || t.eventLogParsed?.[0]?.timestamp)
      .filter(Boolean)
      .map(d => new Date(d));
    const endDates = sprintTickets
      .map(t => t.Completed_At_Date || t.completedAt || t.completed_on || t.eventLogParsed?.find(ev => ['Done', 'Deployed'].includes(ev.status))?.timestamp)
      .filter(Boolean)
      .map(d => new Date(d));
    const minDate = dates.length ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
    const maxDate = endDates.length ? new Date(Math.max(...endDates.map(d => d.getTime()))) : null;
    if (!minDate || !maxDate || isNaN(minDate.getTime()) || isNaN(maxDate.getTime())) return null;
    return {
      id: `sprint-${sprint}`,
      name: sprint,
      start: minDate,
      end: maxDate,
      type: 'task',
      progress: 100,
      dependencies: [],
      barColor: '#2563eb',
      backgroundColor: '#2563eb',
    };
  }).filter(task => task && task.start && task.end && !isNaN(task.start.getTime()) && !isNaN(task.end.getTime()));

  // --- Stacked Bar Chart Data (Blockers/Status by Sprint) ---
  const sprintChartData = sprintNames.map(sprint => {
    const sprintTickets = sprints[sprint];
    let completed = 0, blocked = 0, open = 0;
    sprintTickets.forEach(ticket => {
      if (ticket.status === "Done") completed++;
      else if (ticket.isBlocked || ticket.blocked === "TRUE" || ticket.blocked === true) blocked++;
      else open++;
    });
    return {
      sprint,
      Completed: completed,
      Blocked: blocked,
      Open: open,
    };
  });

  // Workdone Table Section
  const workdoneColumns = [
    { key: 'id', label: 'Ticket ID' },
    { key: 'title', label: 'Title' },
    { key: 'status', label: 'Status' },
    { key: 'owner', label: 'Owner' },
    { key: 'timeInDev', label: 'Time in Dev' },
    { key: 'timeBlocked', label: 'Time Blocked' },
    { key: 'sprint', label: 'Sprint' },
  ];

  const handleWorkdoneSort = (key) => {
    setWorkdoneSort({ key, direction: workdoneSort.direction === 'asc' ? 'desc' : 'asc' });
  };

  const filteredWorkdoneTickets = filteredTickets.filter(ticket =>
    ticket.id.toString().includes(workdoneSearch) ||
    ticket.title.toLowerCase().includes(workdoneSearch.toLowerCase())
  );

  const statusPillClass = (status) => {
    switch (status) {
      case 'Done':
        return 'bg-green-100 text-green-800';
      case 'Deployed':
        return 'bg-blue-100 text-blue-800';
      case 'In Progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'Blocked':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Handler for clicking a bar segment
  const handleBarSegmentClick = (data, index, status) => {
    setBarFilter({ sprint: data.sprint, status });
  };

  // Handler for resetting the filter
  const handleResetFilter = () => setBarFilter(null);

  // Top 3 developers by tickets closed
  const devStats = {};
  tickets.forEach(t => {
    if (t.owner) {
      if (!devStats[t.owner]) devStats[t.owner] = { name: t.owner, closed: 0 };
      if (t.status === 'Done' || t.status === 'Deployed') devStats[t.owner].closed++;
    }
  });
  const topDevs = Object.values(devStats).sort((a, b) => b.closed - a.closed).slice(0, 3);

  // Add to Dashboard function, after handleBarSegmentClick and handleResetFilter
  const handleVelocityBarClick = (data, index) => {
    if (data && data.sprint) {
      setBarFilter({ sprint: data.sprint, status: null });
    }
  };

  const handleLayoutChange = (newLayout) => {
    setLayout(newLayout);
    saveLayout(newLayout);
  };

  // --- New KPI Calculations for granular lifecycle ---
  // Blocked (Clarification): tickets currently in 'Blocked for Clarification'
  const blockedClarificationCount = tickets.filter(t => t.eventLogParsed && t.eventLogParsed.length && t.eventLogParsed[t.eventLogParsed.length-1].status === 'Blocked for Clarification').length;
  // Deprioritized: tickets currently in 'Deprioritized'
  const deprioritizedCount = tickets.filter(t => t.eventLogParsed && t.eventLogParsed.length && t.eventLogParsed[t.eventLogParsed.length-1].status === 'Deprioritized').length;

  return (
    <div className="min-h-screen bg-neutral-50 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold text-neutral-800">Dashboard</h1>
        <button 
          onClick={() => {
            setLayout(DEFAULT_LAYOUT);
            saveLayout(DEFAULT_LAYOUT);
          }}
          className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark transition-colors"
        >
          Reset Layout
        </button>
      </div>
      
      <ResponsiveGridLayout
        className="layout"
        layouts={{ lg: layout }}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={80}
        onLayoutChange={handleLayoutChange}
        measureBeforeMount={false}
        draggableHandle=".widget-drag-handle"
        margin={[16, 16]}
        containerPadding={[0, 0]}
      >
        <div key="insights" className="bg-white rounded-lg shadow-sm border border-neutral-200 h-full flex flex-col">
          <div className="widget-drag-handle bg-neutral-50 px-4 py-2 border-b border-neutral-200 cursor-move flex-shrink-0">
            <h3 className="font-semibold text-neutral-700">Proactive Insights</h3>
          </div>
          <div className="p-4 flex-1">
            <InsightsEngine tickets={tickets} />
          </div>
        </div>
        
        <div key="kpi" className="bg-white rounded-lg shadow-sm border border-neutral-200 h-full flex flex-col">
          <div className="widget-drag-handle bg-neutral-50 px-4 py-2 border-b border-neutral-200 cursor-move flex-shrink-0">
            <h3 className="font-semibold text-neutral-700">Key Performance Indicators</h3>
          </div>
          <div className="p-4 flex-1">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 h-full">
              {/* Total Tickets (clickable) */}
              <div className="flex flex-col items-center justify-center gap-3 bg-neutral-50 rounded-lg p-4 cursor-pointer hover:bg-neutral-100 transition" onClick={() => setModal('tickets')} title="View all tickets">
                <UserGroupIcon className="w-8 h-8 text-primary mb-2" />
                <div className="text-3xl font-bold text-neutral-800">{totalTickets}</div>
                <div className="text-xs text-neutral-500 font-semibold uppercase tracking-wide">Total Tickets</div>
              </div>
              {/* Blocked (Clarification) */}
              <div className="flex flex-col items-center justify-center gap-3 bg-neutral-50 rounded-lg p-4">
                <ExclamationCircleIcon className="w-8 h-8 text-yellow-500 mb-2" />
                <div className="text-3xl font-bold text-neutral-800">{blockedClarificationCount}</div>
                <div className="text-xs text-neutral-500 font-semibold uppercase tracking-wide text-center">Blocked (Clarification)</div>
              </div>
              {/* Deprioritized */}
              <div className="flex flex-col items-center justify-center gap-3 bg-neutral-50 rounded-lg p-4">
                <ArrowPathIcon className="w-8 h-8 text-gray-500 mb-2" />
                <div className="text-3xl font-bold text-neutral-800">{deprioritizedCount}</div>
                <div className="text-xs text-neutral-500 font-semibold uppercase tracking-wide text-center">Deprioritized</div>
              </div>
              {/* Avg Time to Close */}
              <div className="flex flex-col items-center justify-center gap-3 bg-neutral-50 rounded-lg p-4">
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-green-100 mb-2">
                  <span className="text-green-700 text-2xl font-bold">⏱️</span>
                </div>
                <div className="text-2xl font-bold text-neutral-800">{avgTimeToClose != null ? avgTimeToClose + 'h' : '-'}</div>
                <div className="text-xs text-neutral-500 font-semibold uppercase tracking-wide text-center">Avg Time to Close</div>
              </div>
              {/* Tickets Blocked > X Days */}
              <div className="flex flex-col gap-2 items-center justify-center bg-neutral-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 flex items-center justify-center rounded-full bg-red-100">
                    <span className="text-red-700 text-2xl font-bold">⏳</span>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-neutral-800">{ticketsBlockedOverXDays}</div>
                    <div className="text-xs text-neutral-500 font-semibold uppercase tracking-wide">Blocked &gt; {blockedThresholdDays} Days</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <label htmlFor="blocked-threshold" className="block text-sm font-medium text-neutral-600 mb-1">Threshold:</label>
                  <input
                    id="blocked-threshold"
                    type="number"
                    min={1}
                    value={blockedThresholdDays}
                    onChange={e => setBlockedThresholdDays(Number(e.target.value) || 1)}
                    className="border border-neutral-300 rounded-md px-3 py-2 w-full text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div key="team" className="bg-white rounded-lg shadow-sm border border-neutral-200 h-full flex flex-col">
          <div className="widget-drag-handle bg-neutral-50 px-4 py-2 border-b border-neutral-200 cursor-move flex-shrink-0">
            <h3 className="font-semibold text-neutral-700">Team Performance</h3>
          </div>
          <div className="p-4 flex-1 flex flex-col">
            {/* Team Performance Widget */}
            <div className="flex flex-col gap-3 h-full">
              <div className="flex items-center justify-between">
                <div className="text-lg font-bold text-neutral-800">Top Developers</div>
                <button className="text-xs text-primary underline hover:text-primary-dark" onClick={() => setModal('people')}>View All People</button>
              </div>
              <div className="flex gap-4 flex-1 items-center">
                {topDevs.length === 0 ? <div className="text-neutral-500">No data</div> : topDevs.map(dev => (
                  <div key={dev.name} className="flex flex-col items-center gap-1 bg-neutral-50 rounded-lg p-3 min-w-[100px]">
                    <div className="text-xl font-bold text-primary">{dev.closed}</div>
                    <div className="text-xs text-neutral-700 font-semibold">{dev.name}</div>
                    <div className="text-xs text-neutral-400">Tickets Closed</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        <div key="time" className="bg-white rounded-lg shadow-sm border border-neutral-200 h-full flex flex-col">
          <div className="widget-drag-handle bg-neutral-50 px-4 py-2 border-b border-neutral-200 cursor-move flex-shrink-0">
            <h3 className="font-semibold text-neutral-700">Time Analysis</h3>
          </div>
          <div className="p-4 flex-1">
            <TimeAnalysisChart sprints={sprints} sprintNames={sprintNames} filter={barFilter} onSprintClick={sprint => setBarFilter({ sprint, status: null })} />
          </div>
        </div>
        
        <div key="blockers" className="bg-white rounded-lg shadow-sm border border-neutral-200 h-full flex flex-col">
          <div className="widget-drag-handle bg-neutral-50 px-4 py-2 border-b border-neutral-200 cursor-move flex-shrink-0">
            <h3 className="font-semibold text-neutral-700">Blockers & Status by Sprint</h3>
          </div>
          <div className="p-4 flex-1">
            {/* Blockers & Status by Sprint Chart */}
            <div className="h-full flex flex-col">
              {barFilter && (
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-sm">Filtering for:</span>
                  <span className="inline-block px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold border border-blue-200">{barFilter.status} in {barFilter.sprint}</span>
                  <button
                    className="bg-transparent text-primary border border-primary px-3 py-1 rounded-md hover:bg-primary-light hover:text-white transition-all ml-2 text-xs"
                    onClick={handleResetFilter}
                  >
                    Reset Filter
                  </button>
                </div>
              )}
              <div className="flex-1">
                <ResponsiveContainer>
                  <BarChart
                    data={sprintChartData}
                    layout="vertical"
                    margin={{ left: 80, right: 24, top: 24, bottom: 24 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tickLine={{ stroke: '#9ca3af' }}
                      axisLine={{ stroke: '#9ca3af' }}
                      tick={{ fontSize: 14, fill: '#374151' }}
                    />
                    <YAxis
                      dataKey="sprint"
                      type="category"
                      width={100}
                      tickLine={{ stroke: '#9ca3af' }}
                      axisLine={{ stroke: '#9ca3af' }}
                      tick={{ fontSize: 14, fill: '#374151' }}
                    />
                    <Tooltip
                      contentStyle={{ background: '#f5f5f5', border: '1px solid #d1d5db', borderRadius: 8, boxShadow: '0 2px 8px 0 rgba(0,0,0,0.04)', padding: 12, color: '#374151', fontSize: 14 }}
                      wrapperClassName="!z-50"
                      labelClassName="text-neutral-700"
                      itemStyle={{ color: '#374151' }}
                    />
                    <Legend
                      wrapperStyle={{ color: '#52525b', fontSize: 14, paddingBottom: 8 }}
                      iconType="circle"
                      align="right"
                      verticalAlign="top"
                      layout="horizontal"
                    />
                    <Bar
                      dataKey="Completed"
                      stackId="a"
                      fill="#22c55e"
                      name="Completed"
                      radius={[4, 4, 4, 4]}
                      cursor="pointer"
                      onClick={(data, index) => handleBarSegmentClick(data, index, 'Completed')}
                    />
                    <Bar
                      dataKey="Blocked"
                      stackId="a"
                      fill="#f87171"
                      name="Blocked"
                      radius={[4, 4, 4, 4]}
                      cursor="pointer"
                      onClick={(data, index) => handleBarSegmentClick(data, index, 'Blocked')}
                    />
                    <Bar
                      dataKey="Open"
                      stackId="a"
                      fill="#fbbf24"
                      name="Open"
                      radius={[4, 4, 4, 4]}
                      cursor="pointer"
                      onClick={(data, index) => handleBarSegmentClick(data, index, 'Open')}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
        
        <div key="velocity" className="bg-white rounded-lg shadow-sm border border-neutral-200 h-full flex flex-col">
          <div className="widget-drag-handle bg-neutral-50 px-4 py-2 border-b border-neutral-200 cursor-move flex-shrink-0">
            <h3 className="font-semibold text-neutral-700">Developer Velocity</h3>
          </div>
          <div className="p-4 flex-1">
            {/* Developer Velocity Chart */}
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2">
                  <button
                    className={`px-4 py-2 rounded-t-lg font-semibold border-b-2 transition-all ${velocityMode === 'tickets' ? 'border-primary text-primary bg-white' : 'border-transparent text-neutral-500 bg-neutral-100'}`}
                    onClick={() => setVelocityMode('tickets')}
                    title="Show number of tickets closed per sprint"
                  >
                    Total Tickets Done
                  </button>
                  <button
                    className={`px-4 py-2 rounded-t-lg font-semibold border-b-2 transition-all ${velocityMode === 'hours' ? 'border-primary text-primary bg-white' : 'border-transparent text-neutral-500 bg-neutral-100'}`}
                    onClick={() => setVelocityMode('hours')}
                    title="Show development hours completed per sprint"
                  >
                    Dev Hours Done
                  </button>
                </div>
              </div>
              <div className="flex-1">
                <ResponsiveContainer>
                  <BarChart
                    data={velocityData}
                    margin={{ left: 24, right: 24, top: 24, bottom: 24 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="sprint"
                      tickLine={{ stroke: '#9ca3af' }}
                      axisLine={{ stroke: '#9ca3af' }}
                      tick={{ fontSize: 14, fill: '#374151' }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={{ stroke: '#9ca3af' }}
                      axisLine={{ stroke: '#9ca3af' }}
                      tick={{ fontSize: 14, fill: '#374151' }}
                    />
                    <Tooltip
                      contentStyle={{ background: '#f5f5f5', border: '1px solid #d1d5db', borderRadius: 8, boxShadow: '0 2px 8px 0 rgba(0,0,0,0.04)', padding: 12, color: '#374151', fontSize: 14 }}
                      wrapperClassName="!z-50"
                      labelClassName="text-neutral-700"
                      itemStyle={{ color: '#374151' }}
                      formatter={(value) => velocityMode === 'tickets' ? `${value} tickets` : `${value}h`}
                    />
                    <Legend
                      wrapperStyle={{ color: '#52525b', fontSize: 14, paddingBottom: 8 }}
                      iconType="circle"
                      align="right"
                      verticalAlign="top"
                      layout="horizontal"
                    />
                    <Bar
                      dataKey="value"
                      fill="#22c55e"
                      name={velocityMode === 'tickets' ? 'Tickets Closed' : 'Dev Hours Done'}
                      radius={[4, 4, 0, 0]}
                      cursor="pointer"
                      onClick={handleVelocityBarClick}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
        
        <div key="gantt" className="bg-white rounded-lg shadow-sm border border-neutral-200 h-full flex flex-col">
          <div className="widget-drag-handle bg-neutral-50 px-4 py-2 border-b border-neutral-200 cursor-move flex-shrink-0">
            <h3 className="font-semibold text-neutral-700">Sprint Timeline (Gantt)</h3>
          </div>
          <div className="p-4 flex-1">
            {/* Sprint Timeline (Gantt) Chart */}
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <button className="text-xs text-primary underline hover:text-primary-dark ml-2" onClick={() => setModal('sprints')}>View All Sprints</button>
                <div className="flex items-center gap-2">
                  <label className="font-medium text-neutral-600" htmlFor="gantt-view-mode">View Mode:</label>
                  <select
                    id="gantt-view-mode"
                    className="border border-neutral-300 rounded-md px-3 py-2 text-neutral-700"
                    value={ganttViewMode}
                    onChange={e => setGanttViewMode(e.target.value)}
                  >
                    <option value={ViewMode.Day}>Day</option>
                    <option value={ViewMode.Week}>Week</option>
                    <option value={ViewMode.Month}>Month</option>
                  </select>
                </div>
              </div>
              <div className="flex-1 bg-white rounded border">
                {sprintGanttTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-neutral-400 py-12">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                ) : (
                  <Gantt
                    tasks={sprintGanttTasks}
                    viewMode={ganttViewMode}
                    fontFamily="Inter, system-ui, sans-serif"
                    fontSize={16}
                    barHeight={36}
                    columnWidth={ganttViewMode === ViewMode.Day ? 80 : ganttViewMode === ViewMode.Week ? 120 : 180}
                    listCellWidth={120}
                    barCornerRadius={6}
                    TooltipContent={({ task }) => {
                      // Calculate duration in ms
                      const start = task.start ? new Date(task.start) : null;
                      const end = task.end ? new Date(task.end) : null;
                      let durationMs = null;
                      if (start && end) durationMs = end - start;
                      // Format duration as 'Xd Yh'
                      let durationStr = '-';
                      if (durationMs != null && !isNaN(durationMs)) {
                        const totalHours = Math.round(durationMs / 36e5);
                        const days = Math.floor(totalHours / 24);
                        const hours = totalHours % 24;
                        durationStr = (days ? days + 'd ' : '') + hours + 'h';
                      }
                      return (
                        <div style={{ padding: 12, fontSize: 15, minWidth: 220, background: 'rgba(255,255,255,0.98)', borderRadius: 8, boxShadow: '0 2px 8px 0 rgba(0,0,0,0.08)', color: '#1e293b' }}>
                          <div className="font-bold mb-1" style={{fontSize: 16, fontWeight: 700, color: '#0f172a'}} title={task.name}>{task.name}</div>
                          <div><span className="text-neutral-500">Start:</span> {start ? start.toLocaleString() : '-'}</div>
                          <div><span className="text-neutral-500">End:</span> {end ? end.toLocaleString() : '-'}</div>
                          <div><span className="text-neutral-500">User:</span> {task.user || '-'}</div>
                          <div><span className="text-neutral-500">Duration:</span> {durationStr}</div>
                          {task.name === 'Blocked' && task.reason && (
                            <div className="mt-2 p-2 rounded bg-red-50 border border-red-200 text-red-800 font-semibold text-sm">
                              <span className="block mb-1">Blocker Reason:</span>
                              <span>{task.reason}</span>
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                )}
              </div>
              {/* Custom Gantt Legend */}
              <div className="flex gap-6 mt-4 flex-wrap">
                <div className="flex items-center gap-2"><span className="inline-block w-4 h-4 rounded" style={{background: '#2563eb', border: '2px solid #222'}}></span><span className="text-sm text-neutral-700">Sprint Duration</span></div>
              </div>
            </div>
          </div>
        </div>
        
        <div key="workdone" className="bg-white rounded-lg shadow-sm border border-neutral-200 h-full flex flex-col">
          <div className="widget-drag-handle bg-neutral-50 px-4 py-2 border-b border-neutral-200 cursor-move flex-shrink-0">
            <h3 className="font-semibold text-neutral-700">All Tickets Overview</h3>
          </div>
          <div className="p-4 flex-1">
            {/* Workdone Table Section */}
            <div className="h-full flex flex-col">
              <div className="flex flex-wrap gap-4 mb-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-neutral-600 mb-1">Search</label>
                  <input
                    type="text"
                    className="border border-neutral-300 rounded-md px-3 py-2 w-full text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    placeholder="Search by Ticket ID or Title"
                    value={workdoneSearch || ''}
                    onChange={e => setWorkdoneSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="h-full overflow-auto bg-white rounded shadow">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-neutral-200 text-neutral-700 text-left sticky top-0">
                        {workdoneColumns.map(col => (
                          <th
                            key={col.key}
                            className="px-4 py-2 cursor-pointer select-none group"
                            onClick={() => handleWorkdoneSort(col.key)}
                          >
                            <span className="flex items-center gap-1">
                              {col.label}
                              {workdoneSort.key === col.key && (
                                <span className="text-xs">
                                  {workdoneSort.direction === "asc" ? "\u25b2" : "\u25bc"}
                                </span>
                              )}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWorkdoneTickets.length === 0 ? (
                        <tr>
                          <td colSpan={workdoneColumns.length}>
                            <div className="flex flex-col items-center justify-center p-8 text-neutral-500">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-2 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              <div>No tickets found. Try adjusting your search.</div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredWorkdoneTickets.map((ticket, idx) => (
                          <tr
                            key={ticket.id}
                            className={`border-t border-neutral-200 hover:bg-neutral-100 ${idx % 2 === 1 ? 'even:bg-neutral-50' : ''}`}
                          >
                            <td className="px-4 py-2 font-mono">
                              <button type="button" onClick={() => showTicketDetail(ticket.id)} className="text-indigo-600 hover:text-indigo-800 font-medium text-left p-0 bg-transparent">{ticket.id}</button>
                            </td>
                            <td className="px-4 py-2">{ticket.title}</td>
                            <td className="px-4 py-2">
                              <span className={`inline-block px-2 py-0.5 rounded-full border text-xs font-semibold ${statusPillClass(ticket.status)}`}>{ticket.status}</span>
                            </td>
                            <td className="px-4 py-2">
                              <button type="button" onClick={() => showUserDetail(ticket.owner)} className="text-indigo-600 hover:text-indigo-800 font-medium text-left p-0 bg-transparent">{ticket.owner}</button>
                            </td>
                            <td className="px-4 py-2">
                              {(() => {
                                // Calculate total development time using new granular properties
                                const devTime = (ticket.timeInDevelopmentHours || 0) + 
                                               (ticket.timeInTechQCHours || 0) + 
                                               (ticket.timeInBusinessQCHours || 0) +
                                               (ticket.timeInSprintBacklogHours || 0);
                                return devTime > 0 ? devTime + 'h' : '-';
                              })()}
                            </td>
                            <td className="px-4 py-2">
                              {(() => {
                                // Calculate total blocked time using new granular properties
                                const blockedTime = (ticket.timeInClarificationHours || 0) + 
                                                   (ticket.timeDeprioritizedHours || 0);
                                return blockedTime > 0 ? blockedTime + 'h' : '-';
                              })()}
                            </td>
                            <td className="px-4 py-2">{ticket.sprintName || ticket.sprint || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Add Lifecycle Funnel/Sankey Chart */}
        <div key="lifecycle-funnel" className="bg-white rounded-lg shadow-sm border border-neutral-200 h-full flex flex-col">
          <div className="widget-drag-handle bg-neutral-50 px-4 py-2 border-b border-neutral-200 cursor-move flex-shrink-0">
            <h3 className="font-semibold text-neutral-700">Ticket Lifecycle Funnel</h3>
          </div>
          <div className="p-4 flex-1 flex items-center justify-center">
            {/* TODO: Implement LifecycleFunnelChart component */}
            <div className="text-neutral-400">Lifecycle funnel or Sankey chart coming soon...</div>
          </div>
        </div>
      </ResponsiveGridLayout>
      
      {/* MODALS */}
      {modal === 'tickets' && (
        <Modal onClose={() => setModal(null)} title="All Tickets">
          <TicketsPage tickets={tickets} loading={loading} />
        </Modal>
      )}
      {modal === 'blockers' && (
        <Modal onClose={() => setModal(null)} title="All Blockers">
          <BlockersPage tickets={tickets} loading={loading} />
        </Modal>
      )}
      {modal === 'sprints' && (
        <Modal onClose={() => setModal(null)} title="All Sprints">
          <SprintsPage tickets={tickets} loading={loading} />
        </Modal>
      )}
      {modal === 'people' && (
        <Modal onClose={() => setModal(null)} title="All People">
          <PeoplePage tickets={tickets} loading={loading} />
        </Modal>
      )}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-8 text-neutral-500">
          <ArrowPathIcon className="h-10 w-10 animate-spin mb-2" />
          <div>Loading data...</div>
        </div>
      ) : null}
    </div>
  );
}

// Modal component
function Modal({ children, onClose, title }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-5xl w-full relative animate-fadein overflow-y-auto max-h-[90vh]">
        <button className="absolute top-3 right-3 text-neutral-500 hover:text-neutral-700 text-2xl" onClick={onClose} aria-label="Close">&times;</button>
        {title && <div className="font-bold text-xl text-neutral-800 mb-3">{title}</div>}
        {children}
      </div>
    </div>
  );
}

export default Dashboard; 