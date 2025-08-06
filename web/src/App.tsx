import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router-dom";
import { getSystemColorScheme } from "./helpers/utils";
import useNavigateTo from "./hooks/useNavigateTo";
import { userStore, workspaceStore } from "./store";
import { loadTheme } from "./utils/theme";
import { WorkspaceGeneralSetting } from "./types/proto/store/workspace_setting";
import { WorkspaceSetting_Key } from "./types/proto/api/v1/workspace_service";

const App = observer(() => {
  const { i18n } = useTranslation();
  const navigateTo = useNavigateTo();
  const [mode, setMode] = useState<"light" | "dark">("light");
  const workspaceProfile = workspaceStore.state.profile;
  const userSetting = userStore.state.userSetting;
  const workspaceGeneralSetting = WorkspaceGeneralSetting.fromPartial(
    workspaceStore.getWorkspaceSettingByKey(WorkspaceSetting_Key.GENERAL)?.generalSetting || {},
  );
  let currentAppearance = workspaceGeneralSetting.customProfile?.appearance !=="system"?
    workspaceGeneralSetting.customProfile?.appearance as Appearance 
    : userSetting?.appearance as Appearance;

  // Redirect to sign up page if no instance owner.
  useEffect(() => {
    if (!workspaceProfile.owner) {
      navigateTo("/auth/signup");
    }
  }, [workspaceProfile.owner]);

  // Apply system theme listener
  useEffect(() => {
    const darkMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleColorSchemeChange = (e: MediaQueryListEvent) => {
      const mode = e.matches ? "dark" : "light";
      setMode(mode);
    };

    try {
      darkMediaQuery.addEventListener("change", handleColorSchemeChange);
    } catch (error) {
      console.error("failed to initial color scheme listener", error);
    }
  }, []);

  // Additional styles and scripts
  useEffect(() => {
    if (workspaceGeneralSetting.additionalStyle) {
      const styleEl = document.createElement("style");
      styleEl.innerHTML = workspaceGeneralSetting.additionalStyle;
      styleEl.setAttribute("type", "text/css");
      document.body.insertAdjacentElement("beforeend", styleEl);
    }
  }, [workspaceGeneralSetting.additionalStyle]);

  useEffect(() => {
    if (workspaceGeneralSetting.additionalScript) {
      const scriptEl = document.createElement("script");
      scriptEl.innerHTML = workspaceGeneralSetting.additionalScript;
      document.head.appendChild(scriptEl);
    }
  }, [workspaceGeneralSetting.additionalScript]);

  // Dynamic update metadata with customized profile.
  useEffect(() => {
    if (!workspaceGeneralSetting.customProfile) {
      return;
    }

    document.title = workspaceGeneralSetting.customProfile.title;
    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    link.href = workspaceGeneralSetting.customProfile.logoUrl || "/logo.webp";
  }, [workspaceGeneralSetting.customProfile]);

  // Localization
  useEffect(() => {
    const currentLocale = workspaceStore.state.locale;
    // This will trigger re-rendering of the whole app.
    i18n.changeLanguage(currentLocale);
    document.documentElement.setAttribute("lang", currentLocale);
    if (["ar", "fa"].includes(currentLocale)) {
      document.documentElement.setAttribute("dir", "rtl");
    } else {
      document.documentElement.setAttribute("dir", "ltr");
    }
  }, [workspaceStore.state.locale]);
  
  // Appearance logic
  useEffect(() => {
    if (currentAppearance === "system") {
      currentAppearance = getSystemColorScheme();
    }
    setMode(currentAppearance);
  }, [workspaceStore.state.appearance, currentAppearance]);

  useEffect(() => {
    const root = document.documentElement;
    if (mode === "light") {
      root.classList.remove("dark");
    } else if (mode === "dark") {
      root.classList.add("dark");
    }
  }, [mode]);

  // Sync locale and appearance to workspace store
  useEffect(() => {
    if (!userSetting) {
      return;
    }

    workspaceStore.state.setPartial({
      locale: userSetting.locale || workspaceStore.state.locale,
      appearance:  currentAppearance,
    });
  }, [userSetting?.locale, currentAppearance]);

  // Load theme when user setting changes (user theme is already backfilled with workspace theme)
  useEffect(() => {
    if (userSetting?.theme) {
      loadTheme(userSetting.theme);
    }
  }, [userSetting?.theme]);

  const registerServiceWorker = async () => {
    // Check if service worker is already registered
    let registration = await navigator.serviceWorker.getRegistration();
    
    if (!registration) {
        registration = await navigator.serviceWorker.register('/serviceworker.js');
        console.log('Service Worker registered with scope:', registration.scope);
    }
    return null;
  };

  useEffect(()=>{
    registerServiceWorker()
  },[])

  return <Outlet />;
});

export default App;