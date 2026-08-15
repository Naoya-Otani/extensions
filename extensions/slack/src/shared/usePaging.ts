import { useCallback, useMemo, useState } from "react";

/**
 * Display-limit state for a list that must not render everything it has.
 *
 * Slack's `emoji.list` and `users.list` have no server-side paging, so a large workspace hands the
 * extension tens of thousands of entries at once. Rendering one UI element per entry exhausts the
 * extension's JS heap, so the limit is raised on demand instead.
 *
 * Use this directly when the data source can produce a bounded slice itself (a search that takes a
 * limit). Callers holding a full array want `usePagedItems`, which is built on this.
 */
export function usePaging(pageSize: number) {
  const [limit, setLimit] = useState(pageSize);

  const showMore = useCallback(() => setLimit((current) => current + pageSize), [pageSize]);
  const reset = useCallback(() => setLimit(pageSize), [pageSize]);

  return { limit, showMore, reset };
}

/**
 * `usePaging` for callers that already hold the full array. `hiddenCount` is what a "Show More"
 * affordance needs in order to report how much is left, which a boolean cannot express.
 */
export function usePagedItems<T>(items: T[], pageSize: number) {
  const { limit, showMore, reset } = usePaging(pageSize);

  const visible = useMemo(() => items.slice(0, limit), [items, limit]);
  const hiddenCount = items.length - visible.length;

  return { visible, hiddenCount, hasMore: hiddenCount > 0, showMore, reset };
}
