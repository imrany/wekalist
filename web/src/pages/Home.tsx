import dayjs from "dayjs";
import { observer } from "mobx-react-lite";
import { useMemo } from "react";
import MemoView from "@/components/MemoView";
import PagedMemoList from "@/components/PagedMemoList";
import useCurrentUser from "@/hooks/useCurrentUser";
import { viewStore, userStore, workspaceStore } from "@/store";
import { extractUserIdFromName } from "@/store/common";
import memoFilterStore from "@/store/memoFilter";
import { State } from "@/types/proto/api/v1/common";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { WorkspaceSetting_Key } from "@/types/proto/api/v1/workspace_service";

// Extract shortcut ID from resource name
const getShortcutId = (name: string): string => {
  const parts = name.split("/");
  return parts.length === 4 ? parts[3] : "";
};

const Home = observer(() => {
  const user = useCurrentUser();
  const selectedShortcut = userStore.state.shortcuts.find(
    (shortcut) => getShortcutId(shortcut.name) === memoFilterStore.shortcut,
  );

  // Stable key for memoizing filter string
  const filterKey = JSON.stringify({
    shortcut: selectedShortcut?.filter,
    filters: memoFilterStore.filters,
  });

  const memoFilter = useMemo(() => {
    const conditions = [`creator_id == "${extractUserIdFromName(user.name)}"`];
    if (selectedShortcut?.filter) {
      conditions.push(selectedShortcut.filter);
    }

    for (const filter of memoFilterStore.filters) {
      switch (filter.factor) {
        case "contentSearch":
          conditions.push(`content.contains("${filter.value}")`);
          break;
        case "tagSearch":
          conditions.push(`tag in ["${filter.value}"]`);
          break;
        case "pinned":
          conditions.push(`pinned`);
          break;
        case "property.hasLink":
          conditions.push(`has_link`);
          break;
        case "property.hasTaskList":
          conditions.push(`has_task_list`);
          break;
        case "property.hasCode":
          conditions.push(`has_code`);
          break;
        case "displayTime": {
          const displayWithUpdateTime = workspaceStore.getWorkspaceSettingByKey(
            WorkspaceSetting_Key.MEMO_RELATED,
          ).memoRelatedSetting?.displayWithUpdateTime;
          const factor = displayWithUpdateTime ? "updated_ts" : "created_ts";
          const filterDate = new Date(filter.value);
          const filterUtcTimestamp = filterDate.getTime() + filterDate.getTimezoneOffset() * 60 * 1000;
          const timestampAfter = filterUtcTimestamp / 1000;
          conditions.push(`${factor} >= ${timestampAfter} && ${factor} < ${timestampAfter + 60 * 60 * 24}`);
          break;
        }
      }
    }
    console.log("conditions", conditions);
    return conditions.length > 0 ? conditions.join(" && ") : undefined;
  }, [filterKey]);

  return (
    <div className="w-full min-h-full bg-background text-foreground">
      <PagedMemoList
        renderer={(memo: Memo) => (
          <MemoView
            key={`${memo.name}-${memo.displayTime}`}
            memo={memo}
            showVisibility
            showPinned
            compact
          />
        )}
        listSort={(memos: Memo[]) =>
          memos
            .filter((memo) => memo.state === State.NORMAL)
            .sort((a, b) =>
              viewStore.state.orderByTimeAsc
                ? dayjs(a.displayTime).unix() - dayjs(b.displayTime).unix()
                : dayjs(b.displayTime).unix() - dayjs(a.displayTime).unix(),
            )
        }
        orderBy={viewStore.state.orderByTimeAsc ? "display_time asc" : "display_time desc"}
        filter={memoFilter}
        pageSize={30}
      />
    </div>
  );
});

export default Home;
