import { observer } from "mobx-react-lite";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { userStore, workspaceStore } from "@/store";
import { Visibility } from "@/types/proto/api/v1/memo_service";
import { UserSetting } from "@/types/proto/api/v1/user_service";
import { useTranslate } from "@/utils/i18n";
import { convertVisibilityFromString, convertVisibilityToString } from "@/utils/memo";
import AppearanceSelect from "../AppearanceSelect";
import LocaleSelect from "../LocaleSelect";
import ThemeSelector from "../ThemeSelector";
import VisibilityIcon from "../VisibilityIcon";
import WebhookSection from "./WebhookSection";
import { Switch } from "../ui/switch";
import { toast } from "sonner";
import { useEffect, useRef } from "react";
import { WorkspaceSetting_Key } from "@/types/proto/api/v1/workspace_service";
import { WorkspaceGeneralSetting } from "@/types/proto/store/workspace_setting";

const PreferencesSection = observer(() => {
  const t = useTranslate();
  const setting = userStore.state.userSetting as UserSetting;
  const serverSetting = WorkspaceGeneralSetting.fromPartial(
    workspaceStore.getWorkspaceSettingByKey(WorkspaceSetting_Key.GENERAL)?.generalSetting || {},
  );
  
  const serverAppearance:any = serverSetting.customProfile?.appearance;
  const isServerAppearanceEnforced = serverAppearance && serverAppearance !== "system";
  const appearance = isServerAppearanceEnforced ? serverAppearance as Appearance : setting.appearance as Appearance;
  
  // Use ref to track if we've already synced the appearance to prevent loops
  const hasInitializedAppearance = useRef(false);

  const handleLocaleSelectChange = async (locale: Locale) => {
    await userStore.updateUserSetting({ locale }, ["locale"]);
  };

  const handleAppearanceSelectChange = async (appearance: Appearance) => {
    await userStore.updateUserSetting({ appearance }, ["appearance"]);
  };

  // Only sync appearance on initial load or when server appearance changes
  useEffect(() => {
    if (!hasInitializedAppearance.current || 
        (isServerAppearanceEnforced && appearance !== setting.appearance)) {
      handleAppearanceSelectChange(appearance);
      hasInitializedAppearance.current = true;
    }
  }, [serverAppearance]); // Only depend on serverAppearance to avoid loops

  const handleEnableNotificationsChange = async (enableNotifications: boolean) => {
    await userStore.updateUserSetting({ enableNotifications }, ["enable_notifications"]);
  };

  const handleDefaultMemoVisibilityChanged = async (value: string) => {
    await userStore.updateUserSetting({ memoVisibility: value }, ["memo_visibility"]);
  };

  const handleThemeChange = async (theme: string) => {
    await userStore.updateUserSetting({ theme }, ["theme"]);
  };

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

            toast.success('Successfully unsubscribed from push notifications');
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

  const handleSubcribe = async () => {
    // Check if service worker is already registered
    const registration = await navigator.serviceWorker.getRegistration();
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast.error('Push notifications not supported in this browser');
      return null;
    }

    try {
      // Check if we already have a subscription
      let subscription = await registration?.pushManager.getSubscription();

      // If no subscription exists, create one
      if (!subscription) {
        subscription = await registration?.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: 'BNwfzk8HNHxtTLrF6Lphh7_vWnOLsWgQ5SobRT37EmCY6BNWarrB_AZ6rFr7FfHktxgULgBxw7A0ibwf8Svq-Sc'
        });
      }

      // Extract keys from the subscription
      const keys = subscription?.toJSON().keys;

      if (!keys || !keys.p256dh || !keys.auth) {
        throw new Error('Subscription keys are missing or malformed.');
      }

      // Add role to the subscription object
      const subscriptionWithRole = {
        endpoint: subscription?.endpoint,
        keys: keys
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
        toast.error('Failed to subscribe.');
      } else {
        const parseRes = await response.json();
        if (parseRes.error) {
          console.log(parseRes.error);
        } else {
          console.log(parseRes.message);
          toast.success("Subscribed")
        }
      }
    } catch (error) {
      console.error('Service Worker registration or subscription failed:', error);
      toast.error('Service Worker registration or subscription failed')
    }
  }

  useEffect(() => {
    // Check if the user has enabled notifications
    if (setting.enableNotifications) {
      handleSubcribe();
    } else {
      unsubscribeServiceWorker();
    }
  }, [setting.enableNotifications]);

  return (
    <div className="w-full flex flex-col gap-2 pt-2 pb-4">
      <p className="font-medium text-muted-foreground">{t("common.basic")}</p>

      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("common.language")}</span>
        <LocaleSelect value={setting.locale} onChange={handleLocaleSelectChange} />
      </div>

      {/* Show appearance selector only when server doesn't enforce it */}
      {(serverAppearance === "system" || !serverAppearance) && (
        <div className="w-full flex flex-row justify-between items-center">
          <span>{t("setting.preference-section.apperance")}</span>
          <AppearanceSelect value={appearance} onChange={handleAppearanceSelectChange} />
        </div>
      )}

      {/* Show enforced appearance info */}
      {isServerAppearanceEnforced && (
        <div className="w-full flex flex-row justify-between items-center">
          <span>{t("setting.preference-section.apperance")}</span>
          <AppearanceSelect disabled={true} value={serverAppearance} onChange={handleAppearanceSelectChange} />
          {/* <span className="text-sm text-muted-foreground capitalize">
            {serverAppearance} (Server Enforced)
          </span> */}
        </div>
      )}

      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.preference-section.theme")}</span>
        <ThemeSelector value={setting.theme} onValueChange={handleThemeChange} />
      </div>

      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.preference-section.enable-notifications")}</span>
        <Switch
          checked={setting.enableNotifications}
          onCheckedChange={(checked) => handleEnableNotificationsChange(checked)}
        />
      </div>

      <p className="font-medium text-muted-foreground">{t("setting.preference")}</p>

      <div className="w-full flex flex-row justify-between items-center">
        <span className="truncate">{t("setting.preference-section.default-memo-visibility")}</span>
        <Select value={setting.memoVisibility} onValueChange={handleDefaultMemoVisibilityChanged}>
          <SelectTrigger className="min-w-fit">
            <div className="flex items-center gap-2">
              <VisibilityIcon visibility={convertVisibilityFromString(setting.memoVisibility)} />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            {[Visibility.PRIVATE, Visibility.PROTECTED, Visibility.PUBLIC]
              .map((v) => convertVisibilityToString(v))
              .map((item) => (
                <SelectItem key={item} value={item} className="whitespace-nowrap">
                  {t(`memo.visibility.${item.toLowerCase() as Lowercase<typeof item>}`)}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <Separator className="my-3" />

      <WebhookSection />
    </div>
  );
});

export default PreferencesSection;