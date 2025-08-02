import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router-dom";
import { getSystemColorScheme } from "./helpers/utils";
import useNavigateTo from "./hooks/useNavigateTo";
import { userStore, workspaceStore } from "./store";
import { loadTheme } from "./utils/theme";

const App = observer(() => {
  const { i18n } = useTranslation();
  const navigateTo = useNavigateTo();
  const [mode, setMode] = useState<"light" | "dark">("light");
  const workspaceProfile = workspaceStore.state.profile;
  const userSetting = userStore.state.userSetting;
  const workspaceGeneralSetting = workspaceStore.state.generalSetting;

  // Redirect to sign up page if no instance owner.
  useEffect(() => {
    if (!workspaceProfile.owner) {
      navigateTo("/auth/signup");
    }
  }, [workspaceProfile.owner]);

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

  useEffect(() => {
    let currentAppearance = workspaceStore.state.appearance as Appearance;
    if (currentAppearance === "system") {
      currentAppearance = getSystemColorScheme();
    }
    setMode(currentAppearance);
  }, [workspaceStore.state.appearance]);

  useEffect(() => {
    const root = document.documentElement;
    if (mode === "light") {
      root.classList.remove("dark");
    } else if (mode === "dark") {
      root.classList.add("dark");
    }
  }, [mode]);

  useEffect(() => {
    if (!userSetting) {
      return;
    }

    workspaceStore.state.setPartial({
      locale: userSetting.locale || workspaceStore.state.locale,
      appearance: userSetting.appearance || workspaceStore.state.appearance,
    });
  }, [userSetting?.locale, userSetting?.appearance]);

  // Load theme when user setting changes (user theme is already backfilled with workspace theme)
  useEffect(() => {
    if (userSetting?.theme) {
      loadTheme(userSetting.theme);
    }
  }, [userSetting?.theme]);

  const unsubscribeServiceWorker = async () => {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
          try {
              const registration = await navigator.serviceWorker.getRegistration();
              if (registration) {
                  const subscription = await registration.pushManager.getSubscription();
                  if (subscription) {
                      await subscription.unsubscribe();
                      console.log('Successfully unsubscribed from push notifications');

                      // Inform your server about the unsubscription
                      await fetch(`/api/unsubscribe`, {
                          method: 'POST',
                          body: JSON.stringify({ endpoint: subscription.endpoint }),
                          headers: {
                              'Content-Type': 'application/json'
                          }
                      });

                      console.log('Successfully informed the server about the unsubscription');
                  } else {
                      console.log('No subscription found');
                  }
              } else {
                  console.log('No service worker registration found');
              }
          } catch (error: any) {
              console.error('Error during unsubscription:', error);
          }
      }
  };

  const registerServiceWorker = async (role: string, email: string) => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.log('Push notifications not supported in this browser');
            return null;
        }

        try {
            // Check if service worker is already registered
            let registration = await navigator.serviceWorker.getRegistration();
            
            if (!registration) {
                registration = await navigator.serviceWorker.register('/serviceworker.js');
                console.log('Service Worker registered with scope:', registration.scope);
            }

            // Check if we already have a subscription
            let subscription = await registration.pushManager.getSubscription();
            
            // If no subscription exists, create one
            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: 'BNwfzk8HNHxtTLrF6Lphh7_vWnOLsWgQ5SobRT37EmCY6BNWarrB_AZ6rFr7FfHktxgULgBxw7A0ibwf8Svq-Sc'
                });
            }

            // Extract keys from the subscription
            const keys = subscription.toJSON().keys;

            if (!keys || !keys.p256dh || !keys.auth) {
                throw new Error('Subscription keys are missing or malformed.');
            }

            // Add role to the subscription object
            const subscriptionWithRole = {
                endpoint: subscription.endpoint,
                keys: keys,
                role: role,
                email: email,
            };

            // Send subscription to the server
            const response = await fetch(`/api/subscribe`, {
                method: 'POST',
                body: JSON.stringify(subscriptionWithRole),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to subscribe.');
            } else {
                const parseRes = await response.json();
                if (parseRes.error) {
                    console.log(parseRes.error);
                } else {
                    console.log(parseRes.message);
                }
            }

        } catch (error) {
            console.error('Service Worker registration or subscription failed:', error);
        }
        return null;
  };

  return <Outlet />;
});

export default App;
