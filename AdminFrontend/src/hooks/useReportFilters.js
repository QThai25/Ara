import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { buildReportQuery, parseReportQuery } from "../utils/reportFilters.js";

export function useReportFilters({ includeTab = false, includePage = false } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => parseReportQuery(searchParams));
  const syncingFromUrlRef = useRef(false);

  useEffect(() => {
    const nextFilters = parseReportQuery(searchParams);
    const currentQuery = new URLSearchParams(buildReportQuery(filters, { includeTab, includePage })).toString();
    if (searchParams.toString() !== currentQuery) {
      syncingFromUrlRef.current = true;
      setFilters(nextFilters);
    }
  }, [searchParams]);

  useEffect(() => {
    if (syncingFromUrlRef.current) {
      syncingFromUrlRef.current = false;
      return;
    }
    const nextQuery = new URLSearchParams(buildReportQuery(filters, { includeTab, includePage }));
    if (nextQuery.toString() !== searchParams.toString()) setSearchParams(nextQuery, { replace: true });
  }, [filters, searchParams, setSearchParams, includeTab, includePage]);

  return { searchParams, setSearchParams, filters, setFilters };
}
