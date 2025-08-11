import { observer } from "mobx-react-lite";
import { cn } from "@/lib/utils";
import { workspaceStore } from "@/store";
import AppearanceSelect from "./AppearanceSelect";
import LocaleSelect from "./LocaleSelect";
import { WorkspaceGeneralSetting } from "@/types/proto/store/workspace_setting";
import { UserSetting } from "@/types/proto/store/user_setting";

interface Props {
  className?: string;
}

const AuthFooter = observer(({ className }: Props) => {
  let currentAppearance = WorkspaceGeneralSetting.customProfile?.appearance !=="system"?
    WorkspaceGeneralSetting.customProfile?.appearance as Appearance 
    : userSetting?.appearance === undefined || UserSetting?.appearance === "" ? 
    workspaceGeneralSetting.customProfile?.appearance as Appearance  : userSetting.appearance as Appearance;

  const handleLocaleSelectChange = (locale: Locale) => {
    workspaceStore.state.setPartial({ locale });
  };

  const handleAppearanceSelectChange = (appearance: Appearance) => {
    workspaceStore.state.setPartial({ appearance });
  };

  return (
    <div className={cn("mt-4 flex flex-row items-center justify-center w-full gap-2", className)}>
      <LocaleSelect value={workspaceStore.state.locale} onChange={handleLocaleSelectChange} />
      <AppearanceSelect value={currentAppearance} onChange={handleAppearanceSelectChange} />
    </div>
  );
});

export default AuthFooter;
