import { ArrowUpIcon, LoaderIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useRef, useState } from "react";
import { matchPath } from "react-router-dom";
import PullToRefresh from "react-simple-pull-to-refresh";
import { Button } from "@/components/ui/button";
import { DEFAULT_LIST_MEMOS_PAGE_SIZE } from "@/helpers/consts";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";
import { Routes } from "@/router";
import { memoStore, viewStore } from "@/store";
import { State } from "@/types/proto/api/v1/common";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";
import Empty from "../Empty";
import MasonryView from "../MasonryView";
import MemoEditor from "../MemoEditor";

interface Props {
  renderer: (memo: Memo) => JSX.Element;
  listSort?: (list: Memo[]) => Memo[];
  state?: State;
  orderBy?: string;
  filter?: string;
  pageSize?: number;
}

const PagedMemoList = observer((props: Props) => {
  const t = useTranslate();
  const { md } = useResponsiveWidth();

  const [isRequesting, setIsRequesting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nextPageToken, setNextPageToken] = useState("");
  const autoFetchTimeoutRef = useRef<number | null>(null);

  const sortedMemoList = props.listSort ? props.listSort(memoStore.state.memos) : memoStore.state.memos;
  const showMemoEditor = Boolean(matchPath(Routes.ROOT, window.location.pathname));
  
  // Check if any filters are applied - improved logic
  const hasActiveFilter = Boolean(
    props.filter && 
    props.filter.trim() !== "" && 
    // Check if there are additional conditions beyond just creator_id
    props.filter.split("&&").filter(condition => 
      !condition.trim().startsWith("creator_id")
    ).length > 0
  );

  const fetchMoreMemos = async (pageToken: string) => {
    // Always show spinner for initial page loads (pageToken === "")
    if (pageToken === "" || memoStore.state.memos.length === 0) {
      setIsRequesting(true);
    }

    try {
      const filters = [];
      if (props.filter) {
        filters.push(props.filter);
      }

      const response = await memoStore.fetchMemos({
        state: props.state || State.NORMAL,
        orderBy: props.orderBy || "display_time desc",
        filter: filters.length > 0 ? filters.join(" && ") : undefined,
        pageSize: props.pageSize || DEFAULT_LIST_MEMOS_PAGE_SIZE,
        pageToken,
      });

      setNextPageToken(response?.nextPageToken || "");
    } finally {
      setIsRequesting(false);
    }
  };

  const isPageScrollable = () => {
    const documentHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    return documentHeight > window.innerHeight + 100;
  };

  const checkAndFetchIfNeeded = useCallback(async () => {
    if (autoFetchTimeoutRef.current) {
      clearTimeout(autoFetchTimeoutRef.current);
    }

    await new Promise((resolve) => setTimeout(resolve, 400));

    const shouldFetch = !isPageScrollable() && nextPageToken && !isRequesting && sortedMemoList.length > 0;

    if (shouldFetch) {
      await fetchMoreMemos(nextPageToken);

      autoFetchTimeoutRef.current = window.setTimeout(() => {
        checkAndFetchIfNeeded();
      }, 500);
    }
  }, [nextPageToken, isRequesting, sortedMemoList.length]);

  const refreshList = async () => {
    setIsRefreshing(true);
    memoStore.state.updateStateId();
    setNextPageToken("");
    try {
      await fetchMoreMemos("");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Create a stable key for dependency tracking
  const filterKey = `${props.state}-${props.orderBy}-${props.filter}-${props.pageSize}`;
  
  useEffect(() => {
    // Reset state when filter changes
    memoStore.state.updateStateId();
    setNextPageToken("");
    setIsRefreshing(true);
    
    const fetchInitial = async () => {
      try {
        await fetchMoreMemos("");
      } finally {
        setIsRefreshing(false);
      }
    };
    
    fetchInitial();
  }, [filterKey]);

  useEffect(() => {
    if (!isRequesting && sortedMemoList.length > 0) {
      checkAndFetchIfNeeded();
    }
  }, [sortedMemoList.length, isRequesting, nextPageToken, checkAndFetchIfNeeded]);

  useEffect(() => {
    return () => {
      if (autoFetchTimeoutRef.current) {
        clearTimeout(autoFetchTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!nextPageToken) return;

    const handleScroll = () => {
      const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 300;
      if (nearBottom && !isRequesting) {
        fetchMoreMemos(nextPageToken);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [nextPageToken, isRequesting]);

  // Show loading state when:
  // 1. Currently requesting initial data
  // 2. Currently refreshing (filter changes)
  const showLoadingSpinner = (isRequesting && sortedMemoList.length === 0) || isRefreshing;

  const children = (
    <div className="flex flex-col justify-start items-start w-full max-w-full">
      <MasonryView
        memoList={sortedMemoList}
        renderer={props.renderer}
        showLoadingSpinner={showLoadingSpinner}
        prefixElement={showMemoEditor ? <MemoEditor className="mb-2" cacheKey="home-memo-editor" /> : undefined}
        listMode={viewStore.state.layout === "LIST"}
      />

      {showLoadingSpinner && (
        <div className="w-full flex flex-row justify-center items-center my-4">
          <LoaderIcon className="animate-spin text-muted-foreground" />
          {hasActiveFilter && (
            <span className="ml-2 text-sm text-muted-foreground">
              {t("message.filtering-memos")}
            </span>
          )}
        </div>
      )}

      {/* Show "Load More" spinner when fetching additional pages */}
      {isRequesting && sortedMemoList.length > 0 && !isRefreshing && (
        <div className="w-full flex flex-row justify-center items-center my-4">
          <LoaderIcon className="animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">
            {t("message.loading-more")}
          </span>
        </div>
      )}

      {!isRequesting && !showLoadingSpinner && (
        <>
          {!nextPageToken && sortedMemoList.length === 0 ? (
            <div className="w-full mt-12 mb-8 flex flex-col justify-center items-center italic">
              <Empty />
              <p className="mt-2 text-muted-foreground">
                {hasActiveFilter ? t("message.no-filtered-data") : t("message.no-data")}
              </p>
            </div>
          ) : (
            !nextPageToken && (
              <div className="w-full opacity-70 flex flex-row justify-center items-center my-4">
                <BackToTop />
              </div>
            )
          )}
        </>
      )}
    </div>
  );

  if (md) {
    return children;
  }

  return (
    <PullToRefresh
      onRefresh={() => refreshList()}
      pullingContent={
        <div className="w-full flex flex-row justify-center items-center my-4">
          <LoaderIcon className="opacity-60" />
        </div>
      }
      refreshingContent={
        <div className="w-full flex flex-row justify-center items-center my-4">
          <LoaderIcon className="animate-spin" />
        </div>
      }
    >
      {children}
    </PullToRefresh>
  );
});

const BackToTop = () => {
  const t = useTranslate();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 400);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!isVisible) return null;

  return (
    <Button variant="ghost" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
      {t("router.back-to-top")}
      <ArrowUpIcon className="ml-1 w-4 h-auto" />
    </Button>
  );
};

export default PagedMemoList;