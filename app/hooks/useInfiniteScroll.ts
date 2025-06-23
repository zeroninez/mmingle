// hooks/useInfiniteScroll.ts
import { useEffect, useRef, useCallback } from "react";

export function useInfiniteScroll(
  hasMore: boolean,
  isLoading: boolean,
  loadMore: () => void,
) {
  const observerRef = useRef<IntersectionObserver>();

  const lastElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoading) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      });

      if (node) observerRef.current.observe(node);
    },
    [isLoading, hasMore, loadMore],
  );

  return lastElementRef;
}
