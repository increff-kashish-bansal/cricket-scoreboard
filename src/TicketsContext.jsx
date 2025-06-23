import React from "react";
import { createContext, useContext, useState, useCallback } from "react";
import Papa from "papaparse";
import { parseDurationStringToHours, formatHoursToDuration, formatDate, validateTicket } from './utils.js';
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
      eventLogParsed = eventLogParsed.map(ev => {
        let ts = null;
        if (ev.timestamp) {
          ts = new Date(ev.timestamp);
          if (isNaN(ts)) {
            ticket.dataIssues.push(`Invalid eventLog timestamp: ${ev.timestamp}`);
            console.error('Invalid eventLog timestamp:', ev.timestamp, ticket);
            ts = null;
          }
        }
        return { ...ev, timestamp: ts };
      }).filter(ev => ev.timestamp instanceof Date && !isNaN(ev.timestamp));
      eventLogParsed.sort((a, b) => a.timestamp - b.timestamp);
      ticket.eventLogParsed = eventLogParsed;

      // --- 2.3 Calculate Comprehensive Ticket Durations ---
      let totalTimeBlockedMs = 0, totalTimeInDevMs = 0, totalTimeInReviewMs = 0, totalTimeInQAMs = 0;
      let lastStatus = null, lastTimestamp = null;
      const now = new Date();
      for (let i = 0; i < eventLogParsed.length; i++) {
        const ev = eventLogParsed[i];
        if (lastStatus && lastTimestamp) {
          const durationMs = ev.timestamp - lastTimestamp;
          if (lastStatus === 'Blocked') totalTimeBlockedMs += durationMs;
          if (lastStatus === 'In Progress') totalTimeInDevMs += durationMs;
          if (lastStatus === 'In Review') totalTimeInReviewMs += durationMs;
          if (lastStatus === 'QA') totalTimeInQAMs += durationMs;
        }
        lastStatus = ev.status;
        lastTimestamp = ev.timestamp;
      }
      // If not done, add time from last event to now
      if (lastStatus && lastTimestamp && ticket.status !== 'Done' && ticket.status !== 'Deployed') {
        const durationMs = now - lastTimestamp;
        if (lastStatus === 'Blocked') totalTimeBlockedMs += durationMs;
        if (lastStatus === 'In Progress') totalTimeInDevMs += durationMs;
        if (lastStatus === 'In Review') totalTimeInReviewMs += durationMs;
        if (lastStatus === 'QA') totalTimeInQAMs += durationMs;
      }
      ticket.calculatedTotalTimeBlockedHours = Math.round(totalTimeBlockedMs / 36e5);
      ticket.calculatedTotalTimeInDevHours = Math.round(totalTimeInDevMs / 36e5);
      ticket.calculatedTotalTimeInReviewHours = Math.round(totalTimeInReviewMs / 36e5);
      ticket.calculatedTotalTimeInQAHours = Math.round(totalTimeInQAMs / 36e5);
      // Total cycle time
      if (ticket.Created_On_Date && ticket.Resolved_At_Date) {
        ticket.totalCycleTimeHours = Math.round((ticket.Resolved_At_Date - ticket.Created_On_Date) / 36e5);
      } else {
        ticket.totalCycleTimeHours = null;
      }
      // Current block duration
      if (ticket.isBlocked && ticket.Blocked_Since_Date) {
        ticket.currentBlockDurationHours = Math.round((now - ticket.Blocked_Since_Date) / 36e5);
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