import { observer } from "mobx-react-lite";
import SearchBar from "@/components/SearchBar";
import useCurrentUser from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import UsersView from "../UsersView";
import { User } from "@/types/proto/api/v1/user_service";

interface Props {
  className?: string;
  users: User[]
}

const ExploreSidebar = observer((props: Props) => {
  const { users }=props
  const currentUser = useCurrentUser();

  return (
    <aside
      className={cn(
        "relative w-full h-full overflow-auto flex flex-col justify-start items-start bg-background text-sidebar-foreground",
        props.className,
      )}
    >
      <SearchBar placeholder="search.user-placeholder"/>
      <div className="mt-1 px-1 w-full">
        <UsersView users={users} />
      </div>
    </aside>
  );
});

export default ExploreSidebar;
