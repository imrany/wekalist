import { observer } from "mobx-react-lite";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router-dom";
import { getSystemColorScheme } from "./helpers/utils";
import useNavigateTo from "./hooks/useNavigateTo";
import { userStore, workspaceStore } from "./store";
import { loadTheme } from "./utils/theme";
import { WorkspaceGeneralSetting } from "./types/proto/store/workspace_setting";
import { WorkspaceSetting_Key } from "./types/proto/api/v1/workspace_service";

type Appearance = "light" | "dark" | "system";

const App = observer(() => {
  const { i18n } = useTranslation();
  const navigateTo = useNavigateTo();
  const [mode, setMode] = useState<"light" | "dark">("light");
  
  const workspaceProfile = workspaceStore.state.profile;
  const userSetting = userStore.state.userSetting;
  const currentUser = userStore.state.currentUser;
  
  const workspaceGeneralSetting = useMemo(() => 
    WorkspaceGeneralSetting.fromPartial(
      workspaceStore.getWorkspaceSettingByKey(WorkspaceSetting_Key.GENERAL)?.generalSetting || {}
    ), [workspaceStore.getWorkspaceSettingByKey(WorkspaceSetting_Key.GENERAL)]
  );

  // Determine current appearance with cleaner logic
  const currentAppearance = useMemo((): Appearance => {
    const workspaceAppearance = workspaceGeneralSetting.customProfile?.appearance;
    const userAppearance = userSetting?.appearance;
    
    // If user is not logged in and workspace has system appearance, use workspace default
    if (!currentUser && workspaceAppearance === "system") {
      return workspaceStore.state.appearance as Appearance;
    }
    
    // If workspace appearance is not system, use workspace setting
    if (workspaceAppearance && workspaceAppearance !== "system") {
      return workspaceAppearance as Appearance;
    }
    
    // Use user setting if available, otherwise fallback to workspace
    return (userAppearance || workspaceAppearance || "system") as Appearance;
  }, [
    workspaceGeneralSetting.customProfile?.appearance,
    userSetting?.appearance,
    currentUser,
    workspaceStore.state.appearance
  ]);

  const registerServiceWorker = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker is not supported');
      return null;
    }

    try {
      // Check if service worker is already registered
      let registration = await navigator.serviceWorker.getRegistration();
      
      if (!registration) {
        registration = await navigator.serviceWorker.register('/serviceworker.js');
        console.log('Service Worker registered with scope:', registration.scope);
      } else {
        console.log('Service Worker already registered');
      }
      
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }, []);

  // Redirect to sign up page if no instance owner
  useEffect(() => {
    if (!workspaceProfile.owner) {
      navigateTo("/auth/signup");
    }
  }, [workspaceProfile.owner, navigateTo]);

  // Apply system theme listener
  useEffect(() => {
    const darkMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    
    const handleColorSchemeChange = (e: MediaQueryListEvent) => {
      if (currentAppearance === "system") {
        const systemMode = e.matches ? "dark" : "light";
        setMode(systemMode);
      }
    };

    try {
      // Set initial mode if current appearance is system
      if (currentAppearance === "system") {
        setMode(darkMediaQuery.matches ? "dark" : "light");
      }
      
      darkMediaQuery.addEventListener("change", handleColorSchemeChange);
      
      return () => {
        darkMediaQuery.removeEventListener("change", handleColorSchemeChange);
      };
    } catch (error) {
      console.error("Failed to initialize color scheme listener", error);
    }
  }, [currentAppearance]);

  // Handle appearance changes
  useEffect(() => {
    let newMode: "light" | "dark";
    
    if (currentAppearance === "system") {
      newMode = getSystemColorScheme();
    } else {
      newMode = currentAppearance;
    }
    
    setMode(newMode);
  }, [currentAppearance]);

  // Apply theme mode to DOM
  useEffect(() => {
    const root = document.documentElement;
    
    if (mode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [mode]);

  // Additional styles
  useEffect(() => {
    if (!workspaceGeneralSetting.additionalStyle) return;

    const styleEl = document.createElement("style");
    styleEl.innerHTML = workspaceGeneralSetting.additionalStyle;
    styleEl.setAttribute("type", "text/css");
    styleEl.setAttribute("data-workspace-style", "true");
    document.body.appendChild(styleEl);

    // Cleanup function
    return () => {
      const existingStyle = document.querySelector('[data-workspace-style="true"]');
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, [workspaceGeneralSetting.additionalStyle]);

  // Additional scripts
  useEffect(() => {
    if (!workspaceGeneralSetting.additionalScript) return;

    const scriptEl = document.createElement("script");
    scriptEl.innerHTML = workspaceGeneralSetting.additionalScript;
    scriptEl.setAttribute("data-workspace-script", "true");
    document.head.appendChild(scriptEl);

    // Cleanup function
    return () => {
      const existingScript = document.querySelector('[data-workspace-script="true"]');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [workspaceGeneralSetting.additionalScript]);

  // Dynamic metadata updates
  useEffect(() => {
    const customProfile = workspaceGeneralSetting.customProfile;
    if (!customProfile) return;

    // Update title
    if (customProfile.title) {
      document.title = customProfile.title;
    }

    // Update favicon
    if (customProfile.logoUrl) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = customProfile.logoUrl || "/logo.svg";
    }
  }, [workspaceGeneralSetting.customProfile]);

  // Localization
  useEffect(() => {
    const currentLocale = workspaceStore.state.locale;
    
    // Change language
    i18n.changeLanguage(currentLocale);
    
    // Update document attributes
    document.documentElement.setAttribute("lang", currentLocale);
    
    // Set text direction for RTL languages
    const isRTL = ["ar", "fa"].includes(currentLocale);
    document.documentElement.setAttribute("dir", isRTL ? "rtl" : "ltr");
  }, [workspaceStore.state.locale, i18n]);

  // Sync user settings to workspace store
  useEffect(() => {
    if (!userSetting) return;

    workspaceStore.state.setPartial({
      locale: userSetting.locale || workspaceStore.state.locale,
      appearance: currentAppearance,
    });
  }, [userSetting?.locale, currentAppearance]);

  // Load user theme
  useEffect(() => {
    if (userSetting?.theme) {
      loadTheme(userSetting.theme);
    }
  }, [userSetting?.theme]);

  // Register service worker
  useEffect(() => {
    registerServiceWorker();
  }, [registerServiceWorker]);

  return <Outlet />;
});

export default App;