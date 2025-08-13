import { cn } from "@/lib/utils";

interface Props {
  avatarUrl?: string;
  className?: string;
}

const UserAvatar = (props: Props) => {
  const { avatarUrl, className } = props;
  return (
    <div className={cn(`w-8 h-8 overflow-clip`, className)}>
      <img
        className="w-full h-full shadow rounded-xl min-w-full min-h-full object-cover"
        src={avatarUrl || "/full-logo.png"}
        decoding="async"
        loading="lazy"
        alt=""
      />
    </div>
  );
};

export default UserAvatar;
