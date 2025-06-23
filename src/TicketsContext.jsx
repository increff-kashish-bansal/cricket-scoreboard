import React from "react";
import { createContext, useContext, useState, useCallback } from "react";
import Papa from "papaparse";

const TicketsContext = createContext();

export function TicketsProvider({ children }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadTickets = useCallback(() => {
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
  }, []);

  const uploadTickets = useCallback((file) => {
    setLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setTickets(results.data);
        setLoading(false);
      },
      error: () => setLoading(false),
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