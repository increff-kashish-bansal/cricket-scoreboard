import React from 'react';
import { useTicketsContext } from './TicketsContext.jsx';

function UserDetailPage({ userName }) {
  const { tickets } = useTicketsContext();
  // Find all tickets where user is owner, assignee, or reporter
  const userTickets = tickets.filter(t =>
    t.owner === userName || t.assignee === userName || t.reporter === userName
  );
  // KPIs
  const totalAssigned = userTickets.length;
  const ticketsClosed = userTickets.filter(t => t.status === 'Done' || t.status === 'Deployed').length;
  const blocksCaused = userTickets.reduce((sum, t) => {
    const log = t.eventLogParsed || [];
    return sum + log.filter(ev => ev.status === 'Blocked' && (ev.blockedBy === userName || ev.by === userName)).length;
  }, 0);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">User: {userName}</h1>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center">
          <div className="text-xs text-neutral-500 uppercase font-semibold mb-1">Total Tickets Assigned</div>
          <div className="text-3xl font-bold text-primary">{totalAssigned}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center">
          <div className="text-xs text-neutral-500 uppercase font-semibold mb-1">Tickets Closed</div>
          <div className="text-3xl font-bold text-green-600">{ticketsClosed}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center">
          <div className="text-xs text-neutral-500 uppercase font-semibold mb-1">Blocks Caused</div>
          <div className="text-3xl font-bold text-red-500">{blocksCaused}</div>
        </div>
      </div>
      {/* Tickets Table */}
      <div className="bg-white rounded-lg shadow p-4 overflow-x-auto">
        <h2 className="text-lg font-semibold mb-4">Associated Tickets</h2>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-neutral-100 text-left">
              <th className="px-4 py-2">Ticket ID</th>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Owner</th>
              <th className="px-4 py-2">Assignee</th>
              <th className="px-4 py-2">Reporter</th>
              <th className="px-4 py-2">Sprint</th>
            </tr>
          </thead>
          <tbody>
            {userTickets.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-neutral-400 py-4">No tickets found for this user.</td></tr>
            ) : userTickets.map(t => (
              <tr key={t.id} className="border-t border-neutral-200 hover:bg-neutral-50">
                <td className="px-4 py-2 font-mono">{t.id}</td>
                <td className="px-4 py-2">{t.title}</td>
                <td className="px-4 py-2">{t.status}</td>
                <td className="px-4 py-2">{t.owner}</td>
                <td className="px-4 py-2">{t.assignee || '-'}</td>
                <td className="px-4 py-2">{t.reporter || '-'}</td>
                <td className="px-4 py-2">{t.sprintName || t.sprint || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default UserDetailPage; 