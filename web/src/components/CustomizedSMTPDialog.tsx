import { useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { workspaceStore } from "@/store";
import { workspaceSettingNamePrefix } from "@/store/common";
import { WorkspaceGeneralSetting, WorkspaceSetting_Key } from "@/types/proto/api/v1/workspace_service";
import { useTranslate } from "@/utils/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  isViewMode?: boolean;
  onDisable?: () => void;
}

function CustomizedSMTPDialog({ open, onOpenChange, onSuccess, isViewMode = false, onDisable }: Props) {
  const t = useTranslate();
  const originalSetting = WorkspaceGeneralSetting.fromPartial(
    workspaceStore.getWorkspaceSettingByKey(WorkspaceSetting_Key.GENERAL)?.generalSetting || {},
  );
  const [customSMTP, setCustomSMTP] = useState<WorkspaceGeneralSetting>(originalSetting);
  const [isLoading, setIsLoading] = useState(false);

  const setPartialState = (partial: Partial<WorkspaceGeneralSetting>) => {
    setCustomSMTP(
      WorkspaceGeneralSetting.fromPartial({
        ...customSMTP,
        ...partial,
      }),
    );
  };

  const handleSMTPHostChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPartialState({
      smtpHost: e.target.value,
    });
  };

  const handleSMTPPortChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPartialState({
      smtpPort: Number(e.target.value),
    });
  };

  const handleSMTPAccountUsernameChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPartialState({
      smtpAccountUsername: e.target.value,
    });
  };

  const handleSMTPAccountEmailChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPartialState({
      smtpAccountEmail: e.target.value,
    });
  };

  const handleSMTPAccountPasswordChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPartialState({
      smtpAccountPassword: e.target.value,
    });
  };

  const handleDisableButtonClick = async () => {
    setIsLoading(true);
    try {
      await workspaceStore.upsertWorkspaceSetting({
        name: `${workspaceSettingNamePrefix}${WorkspaceSetting_Key.GENERAL}`,
        generalSetting: {
          ...originalSetting,
          enableEmailVerification: false,
          smtpHost: "",
          smtpPort: 0,
          smtpAccountUsername: "",
          smtpAccountEmail: "",
          smtpAccountPassword: ""
        },
      });
      onDisable?.();
      customSMTP.enableEmailVerification = false
      customSMTP.smtpHost = ""
      customSMTP.smtpPort = 0 
      customSMTP.smtpAccountUsername = ""
      customSMTP.smtpAccountEmail = "" 
      customSMTP.smtpAccountPassword = ""
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to disable SMTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseButtonClick = () => {
    setCustomSMTP(originalSetting);
    onOpenChange(false);
  };

  const handleSaveButtonClick = async () => {
    if (!customSMTP.smtpHost || customSMTP.smtpPort === 0 || !customSMTP.smtpAccountUsername ||
      !customSMTP.smtpAccountEmail || !customSMTP.smtpAccountPassword
    ) {
      toast.error("Provide all fields.");
      return;
    }

    setIsLoading(true);
    try {
      await workspaceStore.upsertWorkspaceSetting({
        name: `${workspaceSettingNamePrefix}${WorkspaceSetting_Key.GENERAL}`,
        generalSetting: {
          ...customSMTP,
          enableEmailVerification: true
        },
      });
      toast.success(t("message.update-succeed"));
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to customize SMTP");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isViewMode ? "SMTP Configuration Details" : t("setting.system-section.customize-smtp.title")}
          </DialogTitle>
          <DialogDescription>
            {isViewMode 
              ? "Current SMTP configuration settings" 
              : t("setting.system-section.customize-smtp.description")
            }
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="smtp-host">{t("setting.system-section.customize-smtp.smtp-host")}</Label>
            <Input 
              id="smtp-host" 
              type="text" 
              value={customSMTP.smtpHost || ""} 
              onChange={handleSMTPHostChanged} 
              placeholder="smtp.gmail.com, smtp.example.com"
              readOnly={isViewMode}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="smtp-port">{t("setting.system-section.customize-smtp.smtp-port")}</Label>
            <Input 
              id="smtp-port" 
              type="number" 
              value={customSMTP.smtpPort || ""} 
              onChange={handleSMTPPortChanged} 
              placeholder="Enter smtp port e.g 587"
              readOnly={isViewMode}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="smtp-username">{t("setting.system-section.customize-smtp.smtp-username")}</Label>
            <Input 
              id="smtp-username" 
              type="text" 
              value={customSMTP.smtpAccountUsername || ""} 
              onChange={handleSMTPAccountUsernameChanged} 
              placeholder="e.g Company-name Support Team"
              readOnly={isViewMode}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="smtp-account-email">{t("setting.system-section.customize-smtp.smtp-account-email")}</Label>
            <Input 
              id="smtp-account-email" 
              type="email" 
              value={customSMTP.smtpAccountEmail || ""} 
              onChange={handleSMTPAccountEmailChanged} 
              placeholder="sender@gmail.com, user1@example.com"
              readOnly={isViewMode}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="smtp-account-password">{t("setting.system-section.customize-smtp.smtp-account-password")}</Label>
            <Input 
              id="smtp-account-password" 
              type={isViewMode ? "text" : "password"}
              value={isViewMode ? "••••••••" : (customSMTP.smtpAccountPassword || "")} 
              onChange={handleSMTPAccountPasswordChanged} 
              placeholder="Enter sender email password"
              readOnly={isViewMode}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row sm:justify-between gap-2">
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="ghost" onClick={handleCloseButtonClick} disabled={isLoading} className="flex-1 sm:flex-initial">
              {t("common.cancel")}
            </Button>
            {isViewMode ? (
              <Button variant="destructive" onClick={handleDisableButtonClick} disabled={isLoading} className="flex-1 sm:flex-initial">
                {isLoading ? "Disabling..." : "Disable SMTP"}
              </Button>
            ) : (
              <Button onClick={handleSaveButtonClick} disabled={isLoading} className="flex-1 sm:flex-initial">
                {isLoading ? "Saving..." : t("common.save")}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CustomizedSMTPDialog;