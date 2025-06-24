import React from "react";

function getInsights(tickets) {
  if (!tickets || tickets.length === 0) return ["No ticket data available."];
  const insights = [];

  // 1. Ticket blocked much longer than average
  const blockedTickets = tickets.filter(t => t.isBlocked && t.currentBlockDurationHours != null);
  if (blockedTickets.length > 0) {
    const avgBlocked = blockedTickets.reduce((sum, t) => sum + t.currentBlockDurationHours, 0) / blockedTickets.length;
    const outlier = blockedTickets.reduce((max, t) => t.currentBlockDurationHours > max.currentBlockDurationHours ? t : max, blockedTickets[0]);
    if (outlier.currentBlockDurationHours > avgBlocked * 1.8 && outlier.currentBlockDurationHours > 24) {
      insights.push(`Ticket #${outlier.id} has been blocked for ${Math.round(outlier.currentBlockDurationHours)} hours, which is ${(Math.round((outlier.currentBlockDurationHours / avgBlocked) * 100))}% longer than the average blocked ticket (${Math.round(avgBlocked)}h).`);
    }
  }

  // 2. Person who resolved the most blocked tickets this week
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const resolvedBlockers = {};
  tickets.forEach(t => {
    (t.eventLogParsed || []).forEach(ev => {
      if ((ev.status === "Unblocked" || ev.status === "In Progress") && ev.timestamp && new Date(ev.timestamp) > weekAgo) {
        const user = ev.user || t.owner;
        if (user) resolvedBlockers[user] = (resolvedBlockers[user] || 0) + 1;
      }
    });
  });
  const topResolver = Object.entries(resolvedBlockers).sort((a, b) => b[1] - a[1])[0];
  if (topResolver && topResolver[1] > 0) {
    const second = Object.entries(resolvedBlockers).sort((a, b) => b[1] - a[1])[1];
    const diff = second ? topResolver[1] - second[1] : topResolver[1];
    if (diff > 0) {
      insights.push(`${topResolver[0]} has resolved ${topResolver[1]} blocked tickets this week${second ? ", " + diff + " more than anyone else." : "."}`);
    }
  }

  // 3. Sprint with highest % blocked tickets
  const sprints = {};
  tickets.forEach(t => {
    const sprint = t.sprintName || t.sprint || "No Sprint";
    if (!sprints[sprint]) sprints[sprint] = [];
    sprints[sprint].push(t);
  });
  let maxBlockedSprint = null;
  let maxBlockedPct = 0;
  Object.entries(sprints).forEach(([sprint, ts]) => {
    const blocked = ts.filter(t => t.isBlocked).length;
    const pct = ts.length > 0 ? (blocked / ts.length) * 100 : 0;
    if (pct > maxBlockedPct && ts.length > 3) {
      maxBlockedPct = pct;
      maxBlockedSprint = sprint;
    }
  });
  if (maxBlockedSprint && maxBlockedPct > 30) {
    insights.push(`Sprint "${maxBlockedSprint}" currently has ${Math.round(maxBlockedPct)}% of its tickets blocked.`);
  }

  // 4. Ticket with longest cycle time
  const ticketsWithCycle = tickets.filter(t => t.totalCycleTimeHours != null);
  if (ticketsWithCycle.length > 0) {
    const maxCycle = ticketsWithCycle.reduce((max, t) => t.totalCycleTimeHours > max.totalCycleTimeHours ? t : max, ticketsWithCycle[0]);
    if (maxCycle.totalCycleTimeHours > 72) {
      insights.push(`Ticket #${maxCycle.id} has the longest cycle time: ${maxCycle.totalCycleTimeHours} hours from creation to resolution.`);
    }
  }

  // 5. Person with most tickets currently blocked
  const blockedByPerson = {};
  blockedTickets.forEach(t => {
    const owner = t.owner || t.ownerName || "?";
    blockedByPerson[owner] = (blockedByPerson[owner] || 0) + 1;
  });
  const mostBlocked = Object.entries(blockedByPerson).sort((a, b) => b[1] - a[1])[0];
  if (mostBlocked && mostBlocked[1] > 1) {
    insights.push(`${mostBlocked[0]} currently has ${mostBlocked[1]} tickets blocked.`);
  }

  if (insights.length === 0) insights.push("No critical insights detected at this time.");
  return insights;
}

export default function InsightsEngine({ tickets }) {
  const insights = React.useMemo(() => getInsights(tickets), [tickets]);
  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-md p-4 mb-6 shadow-sm">
      <div className="font-bold text-yellow-900 mb-2 text-lg flex items-center gap-2">
        <span role="img" aria-label="lightbulb">💡</span> Proactive Insights
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-min">
        {insights.map((insight, i) => (
          <div key={i} className="p-4 border-b border-gray-200">
            {insight}
          </div>
        ))}
      </div>
    </div>
  );
} 