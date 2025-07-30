import { useTranslate } from "@/utils/i18n";
import { Button } from "../ui/button";
import { 
  Dialog, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogContent 
} from "../ui/dialog";

export enum DialogType {
  DELETE_MEMO = "Delete",
  REMOVE_COMPLETE_TASK = "Remove"
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionButtonFunction: (() => void) |  undefined;
  dialogType: DialogType; // Use the enum type instead of string
};

type DialogConfig = {
  title: string,
  confirmMessage: string;
  actionButtonText: string;
};

export default function MemoDialog(props: Props) {
  const { open, onOpenChange, actionButtonFunction, dialogType } = props;
  const t = useTranslate();

  // Configuration for different dialog types
  const dialogConfig: Record<DialogType, DialogConfig> = {
    [DialogType.DELETE_MEMO]: {
      title: t("common.delete"),
      confirmMessage: t("memo.delete-confirm"),
      actionButtonText: t("common.delete"),
    },
    [DialogType.REMOVE_COMPLETE_TASK]: {
      title: t("common.remove"),
      confirmMessage: t("memo.remove-completed-task-list-items-confirm"),
      actionButtonText: t("common.remove"),
    }
  };

  const config = dialogConfig[dialogType];
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
          {typeof actionButtonFunction !== undefined&&(<Button onClick={actionButtonFunction}>
            {config.actionButtonText}
          </Button>)}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}