import { CogIcon, DatabaseIcon, KeyIcon, LibraryIcon, LucideIcon, Settings2Icon, UserIcon, UsersIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import MobileHeader from "@/components/MobileHeader";
import MemberSection from "@/components/Settings/MemberSection";
import MemoRelatedSettings from "@/components/Settings/MemoRelatedSettings";
import MyAccountSection from "@/components/Settings/MyAccountSection";
import PreferencesSection from "@/components/Settings/PreferencesSection";
import SSOSection from "@/components/Settings/SSOSection";
import SectionMenuItem from "@/components/Settings/SectionMenuItem";
import StorageSection from "@/components/Settings/StorageSection";
import WorkspaceSection from "@/components/Settings/WorkspaceSection";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import useCurrentUser from "@/hooks/useCurrentUser";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";
import { workspaceStore } from "@/store";
import { User_Role } from "@/types/proto/api/v1/user_service";
import { WorkspaceSetting_Key } from "@/types/proto/api/v1/workspace_service";
import { useTranslate } from "@/utils/i18n";

type SettingSection = "my-account" | "preference" | "member" | "system" | "memo-related" | "storage" | "sso";

interface State {
  selectedSection: SettingSection;
}

const BASIC_SECTIONS: SettingSection[] = ["my-account", "preference"];
const ADMIN_SECTIONS: SettingSection[] = ["member", "system", "memo-related", "storage", "sso"];
const ALL_SECTIONS = [...BASIC_SECTIONS, ...ADMIN_SECTIONS] as const;

const SECTION_ICON_MAP: Record<SettingSection, LucideIcon> = {
  "my-account": UserIcon,
  preference: CogIcon,
  member: UsersIcon,
  system: Settings2Icon,
  "memo-related": LibraryIcon,
  storage: DatabaseIcon,
  sso: KeyIcon,
};

const Setting = observer(() => {
  const t = useTranslate();
  const { md } = useResponsiveWidth();
  const location = useLocation();
  const user = useCurrentUser();
  const [state, setState] = useState<State>({
    selectedSection: "my-account",
  });
  const [openSectionSelect, setOpenSectionSelect] = useState(false);
  
  const isHost = user.role === User_Role.HOST;

  const settingsSectionList = useMemo(() => {
    return isHost ? [...BASIC_SECTIONS, ...ADMIN_SECTIONS] : BASIC_SECTIONS;
  }, [isHost]);

  // Handle hash-based navigation
  useEffect(() => {
    let hash = location.hash.slice(1) as SettingSection;
    
    // Validate hash against available sections for current user
    const validSections = isHost ? ALL_SECTIONS : BASIC_SECTIONS;
    if (!validSections.includes(hash)) {
      hash = "my-account";
      // Optionally update the URL to reflect the corrected hash
      window.history.replaceState(null, "", "#my-account");
    }
    
    setState(prevState => ({
      ...prevState,
      selectedSection: hash,
    }));
  }, [location.hash, isHost]);

  // Fetch workspace settings for admin users
  useEffect(() => {
    if (!isHost) return;

    const fetchWorkspaceSettings = async () => {
      const settingsToFetch = [
        WorkspaceSetting_Key.MEMO_RELATED,
        WorkspaceSetting_Key.STORAGE
      ];
      
      try {
        // Use Promise.all instead of forEach for better performance and error handling
        await Promise.all(
          settingsToFetch.map(key => workspaceStore.fetchWorkspaceSetting(key))
        );
      } catch (error) {
        console.error("Failed to fetch workspace settings:", error);
        // Handle error appropriately - maybe show a toast notification
      }
    };

    fetchWorkspaceSettings();
  }, [isHost]);

  const handleSectionSelectorItemClick = useCallback((settingSection: SettingSection) => {
    // Validate that the user has access to this section
    const hasAccess = isHost || BASIC_SECTIONS.includes(settingSection);
    if (!hasAccess) {
      console.warn(`User attempted to access restricted section: ${settingSection}`);
      return;
    }
    
    window.location.hash = settingSection;
    setOpenSectionSelect(false); // Close mobile select after selection
  }, [isHost]);

  const handleSelectTriggerClick = useCallback(() => {
    setOpenSectionSelect(true);
  }, []);

  const renderSettingSection = () => {
    switch (state.selectedSection) {
      case "my-account":
        return <MyAccountSection />;
      case "preference":
        return <PreferencesSection />;
      case "member":
        return <MemberSection />;
      case "system":
        return <WorkspaceSection />;
      case "memo-related":
        return <MemoRelatedSettings />;
      case "storage":
        return <StorageSection />;
      case "sso":
        return <SSOSection />;
      default:
        return <MyAccountSection />; // Fallback
    }
  };

  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-start sm:pt-3 md:pt-6 pb-8">
      {!md && <MobileHeader />}
      <div className="w-full px-4 sm:px-6">
        <div className="w-full border border-border flex flex-row justify-start items-start px-4 py-3 rounded-xl bg-background text-muted-foreground">
          
          {/* Desktop Sidebar */}
          <div className="hidden sm:flex flex-col justify-start items-start w-40 h-auto shrink-0 py-2">
            <span className="text-sm mt-0.5 pl-3 font-mono select-none text-muted-foreground">
              {t("common.basic")}
            </span>
            <div className="w-full flex flex-col justify-start items-start mt-1">
              {BASIC_SECTIONS.map((item) => (
                <SectionMenuItem
                  key={item}
                  text={t(`setting.${item}`)}
                  icon={SECTION_ICON_MAP[item]}
                  isSelected={state.selectedSection === item}
                  onClick={() => handleSectionSelectorItemClick(item)}
                />
              ))}
            </div>
            
            {/* Admin Sections */}
            {isHost && (
              <>
                <span className="text-sm mt-4 pl-3 font-mono select-none text-muted-foreground">
                  {t("common.admin")}
                </span>
                <div className="w-full flex flex-col justify-start items-start mt-1">
                  {ADMIN_SECTIONS.map((item) => (
                    <SectionMenuItem
                      key={item}
                      text={t(`setting.${item}`)}
                      icon={SECTION_ICON_MAP[item]}
                      isSelected={state.selectedSection === item}
                      onClick={() => handleSectionSelectorItemClick(item)}
                    />
                  ))}
                  <span className="px-3 mt-2 opacity-70 text-sm">
                    {t("setting.version")}: v{workspaceStore.state.profile.version}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Main Content Area */}
          <div className="w-full grow sm:pl-4 overflow-x-auto">
            
            {/* Mobile Section Selector */}
            <div className="w-auto inline-block my-2 sm:hidden">
              <Select 
                open={openSectionSelect}
                onOpenChange={setOpenSectionSelect}
                value={state.selectedSection} 
                onValueChange={(value) => handleSectionSelectorItemClick(value as SettingSection)}
              >
                <SelectTrigger 
                  className="w-[180px]"
                  onClick={handleSelectTriggerClick}
                >
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {settingsSectionList.map((settingSection) => (
                    <SelectItem key={settingSection} value={settingSection}>
                      {t(`setting.${settingSection}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Render Current Section */}
            {renderSettingSection()}
          </div>
        </div>
      </div>
    </section>
  );
});

export default Setting;