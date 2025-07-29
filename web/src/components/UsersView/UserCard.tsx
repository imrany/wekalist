import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import UserAvatar from "../UserAvatar";
import { User } from "@/types/proto/api/v1/user_service";
import { Link, useNavigate } from "react-router-dom";

type Props = {
  className?: string,
  user: User,
}
export const UserCard = ({ user, className }: Props) => {
  const navigate=useNavigate()
  const content = (
    <div  
      onClick={()=>navigate(`/u/${encodeURIComponent(user.username)}`)}
      className={cn(
        "w-full border pl-1.5 pr-2 py-0.5 rounded-md flex justify-between items-center",
        "cursor-pointer gap-2 hover:bg-muted transition-colors",
        className,
      )}
    >
      <div className="w-full p-1 flex flex-row justify-start items-center">
        <div className="w-auto hover:opacity-80 rounded-md transition-colors">
          <UserAvatar className="mr-2 shrink-0" avatarUrl={user.avatarUrl} />
        </div>
        <div className="w-full flex flex-col justify-center items-start">
          <Link
            className="block leading-tight hover:opacity-80 rounded-md transition-colors truncate text-muted-foreground"
            to={`/u/${encodeURIComponent(user.username)}`}
            viewTransition
          >
            {user.displayName || user.username}
          </Link>
          <div
            className="w-auto -mt-0.5 text-xs leading-tight truncate text-muted-foreground select-none cursor-pointer hover:opacity-80 transition-colors"
          >
            {user.description}
          </div>
        </div>
      </div>
    </div>
  );

  return content;
};
