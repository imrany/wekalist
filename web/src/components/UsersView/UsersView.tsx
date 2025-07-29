import { observer } from "mobx-react-lite";
import { useState, useCallback } from "react";
import { matchPath, useLocation } from "react-router-dom";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useStatisticsData } from "@/hooks/useStatisticsData";
import { Routes } from "@/router";
import { userStore } from "@/store";
import memoFilterStore, { FilterFactor } from "@/store/memoFilter";
import { useTranslate } from "@/utils/i18n";
import { UserCard } from "./UserCard";
import { User } from "@/types/proto/api/v1/user_service";
import { Briefcase } from "lucide-react";

type Props ={
  users: User[]
}

const UsersView = observer((props:Props) => {
  const { users } =props
  const t = useTranslate();
  const location = useLocation();
  const currentUser = useCurrentUser();

  const handleCalendarClick = useCallback((date: string) => {
    memoFilterStore.removeFilter((f) => f.factor === "displayTime");
    memoFilterStore.addFilter({ factor: "displayTime", value: date });
  }, []);

  const handleFilterClick = useCallback((factor: FilterFactor, value: string = "") => {
    memoFilterStore.addFilter({ factor, value });
  }, []);

  const isRootPath = matchPath(Routes.ROOT, location.pathname);
  const hasPinnedMemos = currentUser && (userStore.state.currentUserStats?.pinnedMemos || []).length > 0;

  return (
    <div className="group w-full mt-2 space-y-1 text-muted-foreground animate-fade-in">
      <div className="pt-1 w-full flex flex-row justify-start items-center gap-1 flex-wrap">
        {users&&users.map(user=>{
          return(
            <UserCard
              key={user.name}
              user={user}
              className=""
            />
          )
        })}
      </div>
    </div>
  );
});

export default UsersView;
