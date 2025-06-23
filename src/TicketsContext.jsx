import React from "react";
import { createContext, useContext, useState, useCallback } from "react";
import Papa from "papaparse";
import { parseDurationStringToHours, formatHoursToDuration, formatDate, validateTicket, calculateWorkingHours } from './utils.js';
import toast from 'react-hot-toast';

const TicketsContext = createContext();

export function TicketsProvider({ children }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const preprocessTickets = (ticketsRaw) => {
    return ticketsRaw.map(ticket => {
      ticket.dataIssues = [];
      // --- 2.1 Parse Dates ---
      function safeDate(val, field) {
        if (!val) return null;
        const d = new Date(val);
        if (isNaN(d)) {
          ticket.dataIssues.push(`Invalid date in ${field}: ${val}`);
          console.error(`Invalid date in ${field}:`, val, ticket);
          return null;
        }
        return d;
      }
      ticket.Created_On_Date = safeDate(ticket.createdOn || ticket.Created_On, 'createdOn/Created_On');
      ticket.Resolved_At_Date = safeDate(ticket.closedOn || ticket.Resolved_At, 'closedOn/Resolved_At');
      ticket.Blocked_Since_Date = safeDate(ticket.blockedSince || ticket.Blocked_Since, 'blockedSince/Blocked_Since');
      ticket.Unblocked_At_Date = safeDate(ticket.resumedAt || ticket.Unblocked_At, 'resumedAt/Unblocked_At');
      ticket.isBlocked = ticket.blocked === true || ticket.blocked === 'TRUE' || ticket.blocked === 'true';

      // --- 2.2 Parse and Enrich Event_Log ---
      let eventLogParsed = [];
      try {
        if (ticket.Event_Log) {
          eventLogParsed = JSON.parse(ticket.Event_Log);
          if (!Array.isArray(eventLogParsed)) eventLogParsed = [];
        }
      } catch (e) {
        eventLogParsed = [];
        ticket.dataIssues.push('Invalid JSON in Event_Log');
        console.error('Invalid JSON in Event_Log:', ticket.Event_Log, ticket, e);
      }
      // Refine event log for Gantt: ensure official block/unblock timestamps and consistent user attribution
      eventLogParsed = eventLogParsed.map((ev, idx, arr) => {
        let ts = null;
        // For blocked/unblocked events, prioritize ticket fields if present
        if (ev.status === 'Blocked' && ticket.Blocked_Since_Date) {
          ts = ticket.Blocked_Since_Date;
        } else if ((ev.status === 'Unblocked' || ev.status === 'In Progress') && ticket.Unblocked_At_Date) {
          ts = ticket.Unblocked_At_Date;
        } else if (ev.timestamp) {
          ts = new Date(ev.timestamp);
          if (isNaN(ts)) {
            ticket.dataIssues.push(`Invalid eventLog timestamp: ${ev.timestamp}`);
            console.error('Invalid eventLog timestamp:', ev.timestamp, ticket);
            ts = null;
          }
        }
        // Consistent user attribution
        let user = ev.user || ev.by || ev.owner;
        if (!user) {
          if (ev.status === 'Blocked') user = ticket.blockedBy || ticket.owner || '?';
          else user = ticket.owner || '?';
        }
        // For blocked events, also ensure blockedBy is set
        let blockedBy = ev.blockedBy || (ev.status === 'Blocked' ? (ticket.blockedBy || user) : undefined);
        return { ...ev, timestamp: ts, user, blockedBy };
      }).filter(ev => ev.timestamp instanceof Date && !isNaN(ev.timestamp));
      // Validate that at least one blocked/unblocked event matches ticket fields
      if (ticket.Blocked_Since_Date) {
        const hasBlocked = eventLogParsed.some(ev => ev.status === 'Blocked' && ev.timestamp.getTime() === ticket.Blocked_Since_Date.getTime());
        if (!hasBlocked) {
          // Insert a synthetic blocked event if missing
          eventLogParsed.push({
            status: 'Blocked',
            timestamp: ticket.Blocked_Since_Date,
            user: ticket.blockedBy || ticket.owner || '?',
            blockedBy: ticket.blockedBy || ticket.owner || '?',
            note: '[Synthesized from Blocked_Since_Date]'
          });
        }
      }
      if (ticket.Unblocked_At_Date) {
        const hasUnblocked = eventLogParsed.some(ev => (ev.status === 'Unblocked' || ev.status === 'In Progress') && ev.timestamp.getTime() === ticket.Unblocked_At_Date.getTime());
        if (!hasUnblocked) {
          // Insert a synthetic unblocked event if missing
          eventLogParsed.push({
            status: 'Unblocked',
            timestamp: ticket.Unblocked_At_Date,
            user: ticket.owner || '?',
            note: '[Synthesized from Unblocked_At_Date]'
          });
        }
      }
      eventLogParsed.sort((a, b) => a.timestamp - b.timestamp);
      // Data consistency checks for Gantt
      // 1. Check for strictly chronological eventLogParsed
      for (let i = 1; i < eventLogParsed.length; i++) {
        if (eventLogParsed[i].timestamp < eventLogParsed[i - 1].timestamp) {
          ticket.dataIssues.push('Event_Log is not strictly chronological');
          console.error('Event_Log is not strictly chronological:', ticket.id, eventLogParsed);
          break;
        }
      }
      // 2. Check that every Blocked is followed by Unblocked/In Progress (unless currently blocked)
      for (let i = 0; i < eventLogParsed.length; i++) {
        const ev = eventLogParsed[i];
        if (ev.status === 'Blocked') {
          let foundUnblock = false;
          for (let j = i + 1; j < eventLogParsed.length; j++) {
            if (['Unblocked', 'In Progress'].includes(eventLogParsed[j].status)) {
              foundUnblock = true;
              break;
            }
            if (eventLogParsed[j].status === 'Blocked') break; // Next block starts, so this block is not closed
          }
          if (!foundUnblock && !ticket.isBlocked) {
            ticket.dataIssues.push('Blocked event not followed by Unblocked/In Progress');
            console.error('Blocked event not followed by Unblocked/In Progress:', ticket.id, eventLogParsed);
          }
        }
      }
      // 3. (Optional) Status consistency check
      for (let i = 1; i < eventLogParsed.length; i++) {
        if (eventLogParsed[i].status && eventLogParsed[i-1].status && eventLogParsed[i].status === eventLogParsed[i-1].status) {
          ticket.dataIssues.push(`Duplicate status at index ${i}: ${eventLogParsed[i].status}`);
          console.warn('Duplicate status in Event_Log:', ticket.id, eventLogParsed[i]);
        }
      }
      ticket.eventLogParsed = eventLogParsed;

      // --- 2.3 Calculate Comprehensive Ticket Durations ---
      let totalTimeBlockedH = 0, totalTimeInDevH = 0, totalTimeInReviewH = 0, totalTimeInQAH = 0;
      let lastStatus = null, lastTimestamp = null;
      const now = new Date();
      for (let i = 0; i < eventLogParsed.length; i++) {
        const ev = eventLogParsed[i];
        if (lastStatus && lastTimestamp) {
          if (ev.timestamp > lastTimestamp) {
            const calcH = calculateWorkingHours(lastTimestamp, ev.timestamp);
            if (lastStatus === 'Blocked') totalTimeBlockedH += calcH;
            if (lastStatus === 'In Progress') totalTimeInDevH += calcH;
            if (lastStatus === 'In Review') totalTimeInReviewH += calcH;
            if (lastStatus === 'QA') totalTimeInQAH += calcH;
          }
        }
        lastStatus = ev.status;
        lastTimestamp = ev.timestamp;
      }
      // If not done, add time from last event to now
      if (lastStatus && lastTimestamp && ticket.status !== 'Done' && ticket.status !== 'Deployed') {
        const calcH = calculateWorkingHours(lastTimestamp, now);
        if (lastStatus === 'Blocked') totalTimeBlockedH += calcH;
        if (lastStatus === 'In Progress') totalTimeInDevH += calcH;
        if (lastStatus === 'In Review') totalTimeInReviewH += calcH;
        if (lastStatus === 'QA') totalTimeInQAH += calcH;
      }
      ticket.calculatedTotalTimeBlockedHours = Math.round(totalTimeBlockedH);
      ticket.calculatedTotalTimeInDevHours = Math.round(totalTimeInDevH);
      ticket.calculatedTotalTimeInReviewHours = Math.round(totalTimeInReviewH);
      ticket.calculatedTotalTimeInQAHours = Math.round(totalTimeInQAH);
      // Total cycle time
      if (ticket.Created_On_Date && ticket.Resolved_At_Date) {
        ticket.totalCycleTimeHours = Math.round(calculateWorkingHours(ticket.Created_On_Date, ticket.Resolved_At_Date));
      } else {
        ticket.totalCycleTimeHours = null;
      }
      // Current block duration
      if (ticket.isBlocked && ticket.Blocked_Since_Date) {
        ticket.currentBlockDurationHours = Math.round(calculateWorkingHours(ticket.Blocked_Since_Date, now));
      } else {
        ticket.currentBlockDurationHours = null;
      }
      // --- 2.4 Clean sprintName and ownerName ---
      ticket.sprintName = (ticket.sprint || ticket.sprintName || '').trim() || null;
      ticket.ownerName = (ticket.owner || ticket.ownerName || '').trim() || null;

      // --- Validation ---
      const validationIssues = validateTicket(ticket);
      if (validationIssues.length > 0) {
        ticket.dataIssues.push(...validationIssues);
        console.warn('Ticket validation issues:', ticket.id, validationIssues, ticket);
      }

      return ticket;
    });
  };

  const loadTickets = useCallback(() => {
    setLoading(true);
    Papa.parse("/tickets.csv", {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setTickets(preprocessTickets(results.data));
        setLoading(false);
        toast.success("Data loaded successfully!");
      },
      error: () => {
        setLoading(false);
        toast.error("Failed to load CSV. Check format.");
      },
    });
  }, []);

  const uploadTickets = useCallback((file) => {
    setLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setTickets(preprocessTickets(results.data));
        setLoading(false);
        toast.success("Data loaded successfully!");
      },
      error: () => {
        setLoading(false);
        toast.error("Failed to load CSV. Check format.");
      },
    });
  }, []);

  // Initial load
  React.useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  return (
    <TicketsContext.Provider value={{ tickets, loading, reload: loadTickets, uploadTickets }}>
      {children}
    </TicketsContext.Provider>
  );
}

export function useTicketsContext() {
  return useContext(TicketsContext);
} 