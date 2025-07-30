import { useTranslate } from "@/utils/i18n";
import { Button } from "../ui/button";
import { 
  Dialog, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogContent 
} from "../ui/dialog";
import { User, UserAccessToken, UserSession } from "@/types/proto/api/v1/user_service";
import { getFormatedAccessToken } from "../Settings/AccessTokenSection";

export enum DialogType {
  DELETE_MEMO = "Delete",
  REMOVE_COMPLETE_TASK = "Remove",
  ARCHIVE_MEMBER = "Archive Member",
  DELETE_MEMBER = "Delete Member",
  REVOKE_SESSION = "Revoke Session",
  DELETE_ACCESS_TOKEN="Delete Access Token"
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionButtonFunction: ((detail?: any) => void) | undefined;
  dialogType: DialogType;
  selectedUser?: User;
  selectedUserSession?: UserSession;
  selectedUserAccessToken?: UserAccessToken;
};

type DialogConfig = {
  title: string;
  confirmMessage: string;
  actionButtonText: string;
};

export default function DialogBox(props: Props) {
  const { open, onOpenChange, actionButtonFunction, dialogType, selectedUser, selectedUserSession, selectedUserAccessToken } = props;
  const t = useTranslate();

  const getFormattedSessionId = (sessionId: string) => {
    return `${sessionId.slice(0, 8)}...${sessionId.slice(-8)}`;
  };

  // Configuration for different dialog types
  const dialogConfig: Record<DialogType, DialogConfig> = {
    [DialogType.DELETE_MEMO]: {
      title: t("common.confirm"),
      confirmMessage: t("memo.delete-confirm"),
      actionButtonText: t("common.delete")
    },
    [DialogType.REMOVE_COMPLETE_TASK]: {
      title: t("common.confirm"),
      confirmMessage: t("memo.remove-completed-task-list-items-confirm"),
      actionButtonText: t("common.remove")
    },
    [DialogType.ARCHIVE_MEMBER]: {
      title: t("setting.member-section.archive-member"),
      confirmMessage: t("setting.member-section.archive-warning", { username: selectedUser?.username || "" }),
      actionButtonText: t("common.archive")
    },
    [DialogType.DELETE_MEMBER]: {
      title: t("setting.member-section.delete-member"),
      confirmMessage: t("setting.member-section.delete-warning", { username: selectedUser?.username || "" }),
      actionButtonText: t("common.delete")
    },
    [DialogType.REVOKE_SESSION]: {
      title: t("setting.user-sessions-section.revoke-session"),
      confirmMessage: t("setting.user-sessions-section.session-revocation", { 
        sessionId: getFormattedSessionId(selectedUserSession?.sessionId || "") 
      }),
      actionButtonText: t("common.revoke")
    },
    [DialogType.DELETE_ACCESS_TOKEN]: {
      title:t("setting.access-token-section.access-token-delete"),
      confirmMessage: t("setting.access-token-section.access-token-deletion", { accessToken: getFormatedAccessToken(selectedUserAccessToken?.accessToken || "") }),
      actionButtonText: t("common.delete")
    }
  };

  const config = dialogConfig[dialogType];

  const handleActionClick = () => {
    if (actionButtonFunction) {
      // For member-related actions, pass the selectedUser
      if (dialogType === DialogType.ARCHIVE_MEMBER || dialogType === DialogType.DELETE_MEMBER) {
        actionButtonFunction(selectedUser);
      } else if (dialogType === DialogType.REVOKE_SESSION) {
        actionButtonFunction(selectedUserSession);
      } else if (dialogType === DialogType.DELETE_ACCESS_TOKEN) {
        actionButtonFunction(selectedUserAccessToken);
      } else {
        // For memo-related actions, call without parameters
        actionButtonFunction();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {config.title}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="text-sm">
            {config.confirmMessage}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          {actionButtonFunction && (
            <Button onClick={handleActionClick}>
              {config.actionButtonText}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}