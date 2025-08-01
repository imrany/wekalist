import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { identityProviderServiceClient } from "@/grpcweb";
import { absolutifyLink } from "@/helpers/utils";
import { FieldMapping, IdentityProvider, IdentityProvider_Type, OAuth2Config } from "@/types/proto/api/v1/idp_service";
import { useTranslate } from "@/utils/i18n";

const templateList: IdentityProvider[] = [
  {
    name: "",
    title: "GitHub",
    type: IdentityProvider_Type.OAUTH2,
    identifierFilter: "",
    config: {
      oauth2Config: {
        clientId: "",
        clientSecret: "",
        authUrl: "https://github.com/login/oauth/authorize",
        tokenUrl: "https://github.com/login/oauth/access_token",
        userInfoUrl: "https://api.github.com/user",
        scopes: ["read:user"],
        fieldMapping: FieldMapping.fromPartial({
          identifier: "login",
          displayName: "name",
          email: "email",
        }),
      },
    },
  },
  {
    name: "",
    title: "GitLab",
    type: IdentityProvider_Type.OAUTH2,
    identifierFilter: "",
    config: {
      oauth2Config: {
        clientId: "",
        clientSecret: "",
        authUrl: "https://gitlab.com/oauth/authorize",
        tokenUrl: "https://gitlab.com/oauth/token",
        userInfoUrl: "https://gitlab.com/oauth/userinfo",
        scopes: ["openid"],
        fieldMapping: FieldMapping.fromPartial({
          identifier: "name",
          displayName: "name",
          email: "email",
        }),
      },
    },
  },
  {
    name: "",
    title: "Google",
    type: IdentityProvider_Type.OAUTH2,
    identifierFilter: "",
    config: {
      oauth2Config: {
        clientId: "",
        clientSecret: "",
        authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
        scopes: ["https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
        fieldMapping: FieldMapping.fromPartial({
          identifier: "email",
          displayName: "name",
          email: "email",
        }),
      },
    },
  },
  {
    name: "",
    title: "Custom",
    type: IdentityProvider_Type.OAUTH2,
    identifierFilter: "",
    config: {
      oauth2Config: {
        clientId: "",
        clientSecret: "",
        authUrl: "",
        tokenUrl: "",
        userInfoUrl: "",
        scopes: [],
        fieldMapping: FieldMapping.fromPartial({
          identifier: "",
          displayName: "",
          email: "",
        }),
      },
    },
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  identityProvider?: IdentityProvider;
  onSuccess?: () => void;
}

function CreateIdentityProviderDialog({ open, onOpenChange, identityProvider, onSuccess }: Props) {
  const t = useTranslate();
  const identityProviderTypes = [...new Set(templateList.map((t) => t.type))];
  const [basicInfo, setBasicInfo] = useState({
    title: "",
    identifierFilter: "",
  });
  const [type, setType] = useState<IdentityProvider_Type>(IdentityProvider_Type.OAUTH2);
  const [oauth2Config, setOAuth2Config] = useState<OAuth2Config>({
    clientId: "",
    clientSecret: "",
    authUrl: "",
    tokenUrl: "",
    userInfoUrl: "",
    scopes: [],
    fieldMapping: FieldMapping.fromPartial({
      identifier: "",
      displayName: "",
      email: "",
    }),
  });
  const [oauth2Scopes, setOAuth2Scopes] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("GitHub");
  const [activeTab, setActiveTab] = useState<string>("basic");
  const isCreating = identityProvider === undefined;

  useEffect(() => {
    if (identityProvider) {
      setBasicInfo({
        title: identityProvider.title,
        identifierFilter: identityProvider.identifierFilter,
      });
      setType(identityProvider.type);
      if (identityProvider.type === IdentityProvider_Type.OAUTH2) {
        const oauth2Config = OAuth2Config.fromPartial(identityProvider.config?.oauth2Config || {});
        setOAuth2Config(oauth2Config);
        setOAuth2Scopes(oauth2Config.scopes.join(" "));
      }
    }
  }, [identityProvider]);

  useEffect(() => {
    if (!isCreating) {
      return;
    }

    const template = templateList.find((t) => t.title === selectedTemplate);
    if (template) {
      setBasicInfo({
        title: template.title,
        identifierFilter: template.identifierFilter,
      });
      setType(template.type);
      if (template.type === IdentityProvider_Type.OAUTH2) {
        const oauth2Config = OAuth2Config.fromPartial(template.config?.oauth2Config || {});
        setOAuth2Config(oauth2Config);
        setOAuth2Scopes(oauth2Config.scopes.join(" "));
      }
    }
  }, [selectedTemplate]);

  const handleCloseBtnClick = () => {
    onOpenChange(false);
  };

  const allowConfirmAction = () => {
    if (basicInfo.title === "") {
      return false;
    }
    if (type === "OAUTH2") {
      if (
        oauth2Config.clientId === "" ||
        oauth2Config.authUrl === "" ||
        oauth2Config.tokenUrl === "" ||
        oauth2Config.userInfoUrl === "" ||
        oauth2Scopes === "" ||
        oauth2Config.fieldMapping?.identifier === ""
      ) {
        return false;
      }
      if (isCreating) {
        if (oauth2Config.clientSecret === "") {
          return false;
        }
      }
    }

    return true;
  };

  const handleConfirmBtnClick = async () => {
    try {
      if (isCreating) {
        await identityProviderServiceClient.createIdentityProvider({
          identityProvider: {
            ...basicInfo,
            type: type,
            config: {
              oauth2Config: {
                ...oauth2Config,
                scopes: oauth2Scopes.split(" "),
              },
            },
          },
        });
        toast.success(t("setting.sso-section.sso-created", { name: basicInfo.title }));
      } else {
        await identityProviderServiceClient.updateIdentityProvider({
          identityProvider: {
            ...basicInfo,
            name: identityProvider!.name,
            type: type,
            config: {
              oauth2Config: {
                ...oauth2Config,
                scopes: oauth2Scopes.split(" "),
              },
            },
          },
          updateMask: ["title", "identifier_filter", "config"],
        });
        toast.success(t("setting.sso-section.sso-updated", { name: basicInfo.title }));
      }
    } catch (error: any) {
      toast.error(error.details);
      console.error(error);
    }
    onSuccess?.();
    onOpenChange(false);
  };

  const setPartialOAuth2Config = (state: Partial<OAuth2Config>) => {
    setOAuth2Config({
      ...oauth2Config,
      ...state,
    });
  };

  const isTabComplete = (tab: string) => {
    switch (tab) {
      case "basic":
        return basicInfo.title !== "";
      case "oauth":
        return oauth2Config.clientId !== "" && oauth2Config.clientSecret !== "" && 
               oauth2Config.authUrl !== "" && oauth2Config.tokenUrl !== "" && 
               oauth2Config.userInfoUrl !== "" && oauth2Scopes !== "";
      case "mapping":
        return oauth2Config.fieldMapping?.identifier !== "";
      default:
        return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t(isCreating ? "setting.sso-section.create-sso" : "setting.sso-section.update-sso")}
            <Badge variant="secondary" className="text-xs">
              {IdentityProvider_Type[type] || type}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic" className="flex items-center gap-2">
              Basic Info
              {isTabComplete("basic") && <div className="w-2 h-2 bg-green-500 rounded-full" />}
            </TabsTrigger>
            <TabsTrigger value="oauth" className="flex items-center gap-2">
              OAuth Config
              {isTabComplete("oauth") && <div className="w-2 h-2 bg-green-500 rounded-full" />}
            </TabsTrigger>
            <TabsTrigger value="mapping" className="flex items-center gap-2">
              Field Mapping
              {isTabComplete("mapping") && <div className="w-2 h-2 bg-green-500 rounded-full" />}
            </TabsTrigger>
          </TabsList>

          <div className="overflow-y-auto max-h-[50vh] no_scrollbar">
            <TabsContent value="basic" className="space-y-4 mt-4">
              {isCreating && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      {t("common.type")}
                    </label>
                    <Select value={String(type)} onValueChange={(value) => setType(parseInt(value) as unknown as IdentityProvider_Type)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {identityProviderTypes.map((kind) => (
                          <SelectItem key={kind} value={String(kind)}>
                            {IdentityProvider_Type[kind] || kind}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      {t("setting.sso-section.template")}
                    </label>
                    <Select value={selectedTemplate} onValueChange={(value) => setSelectedTemplate(value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {templateList.map((template) => (
                          <SelectItem key={template.title} value={template.title}>
                            <div className="flex items-center gap-2">
                              {template.title}
                              {template.title !== "Custom" && (
                                <Badge variant="outline" className="text-xs">Pre-configured</Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Separator />
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-2 block">
                  {t("common.name")}
                  <span className="text-destructive ml-1">*</span>
                </label>
                <Input
                  placeholder={t("common.name")}
                  value={basicInfo.title}
                  onChange={(e) =>
                    setBasicInfo({
                      ...basicInfo,
                      title: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  {t("setting.sso-section.identifier-filter")}
                </label>
                <Input
                  placeholder={t("setting.sso-section.identifier-filter")}
                  value={basicInfo.identifierFilter}
                  onChange={(e) =>
                    setBasicInfo({
                      ...basicInfo,
                      identifierFilter: e.target.value,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Optional: Restrict sign-in to specific users (e.g., @company.com)
                </p>
              </div>
            </TabsContent>

            <TabsContent value="oauth" className="space-y-4 mt-4">
              {isCreating && (
                <div className="bg-muted/30 border border-border rounded-lg p-3 mb-4">
                  <p className="text-sm font-medium mb-1">Redirect URL</p>
                  <code className="text-xs bg-background px-2 py-1 rounded border break-all">
                    {absolutifyLink("/auth/callback")}
                  </code>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use this URL when configuring your OAuth application
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t("setting.sso-section.client-id")}
                    <span className="text-destructive ml-1">*</span>
                  </label>
                  <Input
                    placeholder={t("setting.sso-section.client-id")}
                    value={oauth2Config.clientId}
                    onChange={(e) => setPartialOAuth2Config({ clientId: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t("setting.sso-section.client-secret")}
                    <span className="text-destructive ml-1">*</span>
                  </label>
                  <Input
                    type="password"
                    placeholder={t("setting.sso-section.client-secret")}
                    value={oauth2Config.clientSecret}
                    onChange={(e) => setPartialOAuth2Config({ clientSecret: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  {t("setting.sso-section.authorization-endpoint")}
                  <span className="text-destructive ml-1">*</span>
                </label>
                <Input
                  placeholder={t("setting.sso-section.authorization-endpoint")}
                  value={oauth2Config.authUrl}
                  onChange={(e) => setPartialOAuth2Config({ authUrl: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  {t("setting.sso-section.token-endpoint")}
                  <span className="text-destructive ml-1">*</span>
                </label>
                <Input
                  placeholder={t("setting.sso-section.token-endpoint")}
                  value={oauth2Config.tokenUrl}
                  onChange={(e) => setPartialOAuth2Config({ tokenUrl: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  {t("setting.sso-section.user-endpoint")}
                  <span className="text-destructive ml-1">*</span>
                </label>
                <Input
                  placeholder={t("setting.sso-section.user-endpoint")}
                  value={oauth2Config.userInfoUrl}
                  onChange={(e) => setPartialOAuth2Config({ userInfoUrl: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  {t("setting.sso-section.scopes")}
                  <span className="text-destructive ml-1">*</span>
                </label>
                <Input
                  placeholder="read:user openid profile email"
                  value={oauth2Scopes}
                  onChange={(e) => setOAuth2Scopes(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Space-separated list of OAuth scopes
                </p>
              </div>
            </TabsContent>

            <TabsContent value="mapping" className="space-y-4 mt-4">
              <div className="bg-muted/30 border border-border rounded-lg p-3 mb-4">
                <p className="text-sm font-medium mb-1">Field Mapping</p>
                <p className="text-xs text-muted-foreground">
                  Map user profile fields from the OAuth provider to your application
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t("setting.sso-section.identifier")}
                    <span className="text-destructive ml-1">*</span>
                  </label>
                  <Input
                    placeholder="login, email, username"
                    value={oauth2Config.fieldMapping!.identifier}
                    onChange={(e) =>
                      setPartialOAuth2Config({ fieldMapping: { ...oauth2Config.fieldMapping, identifier: e.target.value } as FieldMapping })
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Unique identifier field from user profile
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t("setting.sso-section.display-name")}
                  </label>
                  <Input
                    placeholder="name, display_name, full_name"
                    value={oauth2Config.fieldMapping!.displayName}
                    onChange={(e) =>
                      setPartialOAuth2Config({ fieldMapping: { ...oauth2Config.fieldMapping, displayName: e.target.value } as FieldMapping })
                    }
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t("common.email")}
                  </label>
                  <Input
                    placeholder="email, email_address"
                    value={oauth2Config.fieldMapping!.email}
                    onChange={(e) =>
                      setPartialOAuth2Config({ fieldMapping: { ...oauth2Config.fieldMapping, email: e.target.value } as FieldMapping })
                    }
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Avatar URL
                  </label>
                  <Input
                    placeholder="avatar_url, picture, avatar"
                    value={oauth2Config.fieldMapping!.avatarUrl}
                    onChange={(e) =>
                      setPartialOAuth2Config({ fieldMapping: { ...oauth2Config.fieldMapping, avatarUrl: e.target.value } as FieldMapping })
                    }
                  />
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={handleCloseBtnClick}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleConfirmBtnClick} disabled={!allowConfirmAction()}>
            {t(isCreating ? "common.create" : "common.update")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateIdentityProviderDialog;