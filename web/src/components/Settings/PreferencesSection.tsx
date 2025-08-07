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
import { useEffect, useRef, useState } from "react";
import { WorkspaceSetting_Key } from "@/types/proto/api/v1/workspace_service";
import { WorkspaceGeneralSetting } from "@/types/proto/store/workspace_setting";
import { SubscriptionRequest, RemoveSubscriptionRequest } from "@/types/proto/api/v1/subscription_service";
import { SubscriptionServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";

const PreferencesSection = observer(() => {
  const t = useTranslate();
  const { email, username } = useCurrentUser();
  const setting = userStore.state.userSetting as UserSetting;
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'unknown' | 'subscribed' | 'not-subscribed'>('unknown');
  
  const serverSetting = WorkspaceGeneralSetting.fromPartial(
    workspaceStore.getWorkspaceSettingByKey(WorkspaceSetting_Key.GENERAL)?.generalSetting || {},
  );
  
  const serverAppearance: any = serverSetting.customProfile?.appearance;
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

  const handleDefaultMemoVisibilityChanged = async (value: string) => {
    await userStore.updateUserSetting({ memoVisibility: value }, ["memo_visibility"]);
  };

  const handleThemeChange = async (theme: string) => {
    await userStore.updateUserSetting({ theme }, ["theme"]);
  };

  // Check current subscription status
  const checkSubscriptionStatus = async (): Promise<boolean> => {
    if (!('serviceWorker' in navigator && 'PushManager' in window)) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        return false;
      }

      const subscription = await registration.pushManager.getSubscription();
      return subscription !== null;
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return false;
    }
  };

  // Register service worker if not already registered
  const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker not supported');
    }

    try {
      let registration = await navigator.serviceWorker.getRegistration();
      
      if (!registration) {
        // Register service worker - adjust path as needed
        registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });
        console.log('Service Worker registered:', registration);
        
        // Wait for the service worker to be ready
        await navigator.serviceWorker.ready;
      }

      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      throw error;
    }
  };

  const unsubscribeServiceWorker = async (): Promise<void> => {
    if (!('serviceWorker' in navigator && 'PushManager' in window)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        console.log('No service worker registration found');
        return;
      }

      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        console.log('No subscription found');
        return;
      }

      // Unsubscribe locally
      const unsubscribed = await subscription.unsubscribe();
      
      if (unsubscribed) {
        console.log('Successfully unsubscribed from push notifications');

        // Inform server about the unsubscription via gRPC
        try {
          const removeRequest: RemoveSubscriptionRequest = {
            endpoint: subscription.endpoint,
            username: username || "",
          };

          const response = await SubscriptionServiceClient.removeSubscription(removeRequest);
          
          if (response.success) {
            toast.success('Successfully unsubscribed from push notifications');
          } else {
            console.warn('Server unsubscription failed:', response.message);
            // Still show success since local unsubscription worked
            toast.success('Unsubscribed locally (server notification failed)');
          }
        } catch (serverError) {
          console.error('Failed to notify server of unsubscription:', serverError);
          toast.success('Unsubscribed locally (server notification failed)');
        }

        setSubscriptionStatus('not-subscribed');
      }
    } catch (error) {
      console.error('Error during unsubscription:', error);
      toast.error('Failed to unsubscribe from push notifications');
    }
  };

  const handleSubscribe = async (): Promise<void> => {
    if (isSubscribing) return;
    
    setIsSubscribing(true);

    try {
      // Check browser support
      if (!('serviceWorker' in navigator && 'PushManager' in window)) {
        toast.error('Push notifications not supported in this browser');
        return;
      }

      // Check notification permission
      let permission = Notification.permission;
      
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      
      if (permission === 'denied') {
        toast.error('Notification permission denied. Please enable in browser settings.');
        return;
      }

      // Register service worker
      const registration = await registerServiceWorker();
      if (!registration) {
        throw new Error('Failed to register service worker');
      }

      // Check if we already have a subscription
      let subscription = await registration.pushManager.getSubscription();

      // If no subscription exists, create one
      if (!subscription) {
        try {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: 'BOxQ1MrRQ3E0EvBglmCHO_FeoBOoHCKXnaOKhDni1EzD2rThuBeLo3WsBys-Brddm8afLm4XPo2AY16irwslYDs'
          });
        } catch (subscribeError: any) {
          if (subscribeError.name === 'AbortError' || subscribeError.message?.includes('could not connect to push server')) {
            toast.error('Cannot connect to push server. Please check your internet connection and try again.');
            return;
          }
          throw subscribeError;
        }
      }

      if (!subscription) {
        throw new Error('Failed to create push subscription');
      }

      // Extract keys from the subscription
      const keys = subscription.toJSON().keys;

      if (!keys || !keys.p256dh || !keys.auth) {
        throw new Error('Subscription keys are missing or malformed.');
      }

      // Prepare subscription request
      const subscriptionRequest: SubscriptionRequest = {
        endpoint: subscription.endpoint,
        keys,
        username: username || "",
        email: email || "",
      };

      // Send subscription to the server via gRPC
      const response = await SubscriptionServiceClient.addSubscription(subscriptionRequest);
      
      if (!response.success) {
        console.error('Subscription failed:', response.message);
        toast.error(`Failed to subscribe: ${response.message || 'Unknown error'}`);
        
        // Clean up the local subscription if server registration failed
        await subscription.unsubscribe();
      } else {
        toast.success("Successfully subscribed to push notifications");
        setSubscriptionStatus('subscribed');
      }
    } catch (error: any) {
      console.error('Subscription error:', error);
      
      // Provide more specific error messages
      if (error.name === 'NotSupportedError') {
        toast.error('Push notifications are not supported on this device');
      } else if (error.name === 'NotAllowedError') {
        toast.error('Push notifications are blocked. Please enable in browser settings.');
      } else if (error.name === 'AbortError') {
        toast.error('Subscription was aborted. Please try again.');
      } else if (error.message?.includes('network')) {
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error(`Subscription failed: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleEnableNotificationsChange = async (enableNotifications: boolean): Promise<void> => {
    // Update user setting first
    await userStore.updateUserSetting({ enableNotifications }, ["enable_notifications"]);
    
    // Then handle subscription/unsubscription
    if (enableNotifications) {
      await handleSubscribe();
    } else {
      await unsubscribeServiceWorker();
    }
  };

  // Check subscription status on component mount
  useEffect(() => {
    const initializeSubscriptionStatus = async () => {
      const isSubscribed = await checkSubscriptionStatus();
      setSubscriptionStatus(isSubscribed ? 'subscribed' : 'not-subscribed');
    };

    initializeSubscriptionStatus();
  }, []);

  // Handle initial subscription based on user setting
  useEffect(() => {
    const handleInitialSubscription = async () => {
      if (subscriptionStatus === 'unknown') return;
      
      const shouldBeSubscribed = setting.enableNotifications;
      const isCurrentlySubscribed = subscriptionStatus === 'subscribed';
      
      if (shouldBeSubscribed && !isCurrentlySubscribed) {
        await handleSubscribe();
      } else if (!shouldBeSubscribed && isCurrentlySubscribed) {
        await unsubscribeServiceWorker();
      }
    };

    handleInitialSubscription();
  }, [setting.enableNotifications, subscriptionStatus]);

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
        </div>
      )}

      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.preference-section.theme")}</span>
        <ThemeSelector value={setting.theme} onValueChange={handleThemeChange} />
      </div>

      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.preference-section.enable-notifications")}</span>
        <div className="flex items-center gap-2">
          {isSubscribing && (
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          )}
          <Switch
            checked={setting.enableNotifications}
            disabled={isSubscribing}
            onCheckedChange={handleEnableNotificationsChange}
          />
        </div>
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