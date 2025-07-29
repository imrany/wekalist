import { observer } from "mobx-react-lite";
import { Link } from "react-router-dom";
import { useTranslate } from "@/utils/i18n";
import { UserCard } from "./UserCard";
import { User } from "@/types/proto/api/v1/user_service";
import { LogIn, UserPlus } from "lucide-react";

type Props ={
  users?: User[]
}

const UsersView = observer((props:Props) => {
  const { users } =props
  const t = useTranslate();
  return (
    <div className="group w-full mt-2 space-y-1 text-muted-foreground animate-fade-in">
      <div className="pt-1 w-full flex flex-row justify-start items-center gap-1 flex-wrap">
        {users?users.map(user=>{
          return(
            <UserCard
              key={user.name}
              user={user}
              className=""
            />
          )
        }):(
          <Link
            to={`/auth`}
            className="w-full border pl-1.5 pr-2 py-0.5 rounded-md flex justify-between items-center cursor-pointer gap-2 hover:bg-muted transition-colors"
          >
            <div className="w-full p-1 flex flex-row justify-start gap-2 items-center">
              <UserPlus className="w-auto h-4"/>
              <p className="hover:opacity-80 text-sm transition-colors text-muted-foreground">
                {t("auth.create-your-account")}
              </p>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
});

export default UsersView;
