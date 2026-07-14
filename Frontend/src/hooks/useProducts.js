import { useEffect, useRef, useState } from "react";
import { getCostumes } from "../services/costumeService.js";

export function useProducts(query = "") {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestRef = useRef(0);

  useEffect(() => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    const controller = new AbortController();
    const load = async () => {
      setLoading((current) => (products.length ? current : true));
      setError("");
      try {
        const items = await getCostumes(query, { signal: controller.signal });
        if (requestRef.current === requestId) setProducts(items);
      } catch (err) {
        if (controller.signal.aborted || requestRef.current !== requestId) return;
        setError(err.message);
      } finally {
        if (requestRef.current === requestId) setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [query]);

  return { products, loading, error };
}
