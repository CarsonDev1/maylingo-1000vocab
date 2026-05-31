import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";

/**
 * Runs `loader` every time the screen gains focus (so data refreshes after a
 * learn/review session) and on first mount. Returns the latest data, a loading
 * flag, and a manual `reload`.
 */
export function useFocusData<T>(loader: () => Promise<T>): {
  data: T | null;
  loading: boolean;
  reload: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const reload = useCallback(() => {
    setLoading(true);
    loaderRef
      .current()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { data, loading, reload };
}
