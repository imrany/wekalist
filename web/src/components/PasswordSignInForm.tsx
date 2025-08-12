import { LoaderIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { ClientError } from "nice-grpc-web";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authServiceClient } from "@/grpcweb";
import useLoading from "@/hooks/useLoading";
import useNavigateTo from "@/hooks/useNavigateTo";
import { workspaceStore } from "@/store";
import { initialUserStore } from "@/store/user";
import { useTranslate } from "@/utils/i18n";
import { WorkspaceGeneralSetting, WorkspaceSetting_Key } from "@/types/proto/api/v1/workspace_service";

const PasswordSignInForm = observer(() => {
  const t = useTranslate();
  const navigateTo = useNavigateTo();
  const actionBtnLoadingState = useLoading(false);
  const { enableEmailVerification } = WorkspaceGeneralSetting.fromPartial(
    workspaceStore.getWorkspaceSettingByKey(WorkspaceSetting_Key.GENERAL)?.generalSetting || {},
  );
  const [usernameOrEmail, setUsernameOrEmail] = useState(
    workspaceStore.state.profile.mode === "demo" ? "yourselfhosted" : ""
  );
  const [password, setPassword] = useState(
    workspaceStore.state.profile.mode === "demo" ? "yourselfhosted" : ""
  );

  const handleUsernameOrEmailInputChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsernameOrEmail(e.target.value as string);
  };

  const handlePasswordInputChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value as string);
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSignInButtonClick();
  };

  const handleSignInButtonClick = async () => {
    if (usernameOrEmail === "" || password === "") {
      return;
    }

    if (actionBtnLoadingState.isLoading) {
      return;
    }

    try {
      actionBtnLoadingState.setLoading();
      await authServiceClient.createSession({
        passwordCredentials: { username: usernameOrEmail, password },
      });
      await initialUserStore();
      navigateTo("/");
    } catch (error: any) {
      console.error(error);
      toast.error((error as ClientError).details || "Failed to sign in.");
    }
    actionBtnLoadingState.setFinish();
  };

  return (
    <form className="w-full mt-2" onSubmit={handleFormSubmit}>
      <div className="flex flex-col justify-start items-start w-full gap-4">
        <div className="w-full flex flex-col justify-start items-start">
          <span className="leading-8 text-muted-foreground">
            {enableEmailVerification?t("common.username-or-email"):t("common.username")}
          </span>
          <Input
            className="w-full bg-background h-10"
            type="text"
            readOnly={actionBtnLoadingState.isLoading}
            placeholder={enableEmailVerification?t("common.username-or-email"):t("common.username")}
            value={usernameOrEmail}
            autoComplete={enableEmailVerification?"username email":"username"}
            autoCapitalize="off"
            spellCheck={false}
            onChange={handleUsernameOrEmailInputChanged}
            required
          />
        </div>
        <div className="w-full flex flex-col justify-start items-start">
          <span className="leading-8 text-muted-foreground">{t("common.password")}</span>
          <Input
            className="w-full bg-background h-10"
            type="password"
            readOnly={actionBtnLoadingState.isLoading}
            placeholder={t("common.password")}
            value={password}
            autoComplete="current-password"
            autoCapitalize="off"
            spellCheck={false}
            onChange={handlePasswordInputChanged}
            required
          />
        </div>
      </div>
      <div className="flex flex-row justify-end items-center w-full mt-6">
        <Button
          type="submit"
          className="w-full h-10"
          disabled={actionBtnLoadingState.isLoading}
          onClick={handleSignInButtonClick}
        >
          {t("common.sign-in")}
          {actionBtnLoadingState.isLoading && (
            <LoaderIcon className="w-5 h-auto ml-2 animate-spin opacity-60" />
          )}
        </Button>
      </div>
    </form>
  );
});

export default PasswordSignInForm;
