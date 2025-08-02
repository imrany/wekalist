import { LoaderIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { ClientError } from "nice-grpc-web";
import { useState, useEffect } from "react";
import { toast } from "sonner"
import { Link } from "react-router-dom";
import AuthFooter from "@/components/AuthFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authServiceClient, userServiceClient } from "@/grpcweb";
import useLoading from "@/hooks/useLoading";
import useNavigateTo from "@/hooks/useNavigateTo";
import { workspaceStore } from "@/store";
import { initialUserStore } from "@/store/user";
import { User, User_Role, VerifyRequest } from "@/types/proto/api/v1/user_service";
import { useTranslate } from "@/utils/i18n";
import { WorkspaceGeneralSetting, WorkspaceSetting_Key } from "@/types/proto/api/v1/workspace_service";

const SignUp = observer(() => {
  const t = useTranslate();
  const navigateTo = useNavigateTo();
  const actionBtnLoadingState = useLoading(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [verified, setVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [showOTPInput, setShowOTPInput] = useState(false);
  const [showResendOTP, setShowResendOTP] = useState(false)
  const workspaceGeneralSetting = workspaceStore.state.generalSetting;
  const { enableEmailVerification } = WorkspaceGeneralSetting.fromPartial(
    workspaceStore.getWorkspaceSettingByKey(WorkspaceSetting_Key.GENERAL)?.generalSetting || {},
  );

  // Clean up localStorage on component unmount
  useEffect(() => {
    return () => {
      localStorage.removeItem("otp");
      localStorage.removeItem("verifiedEmail");
    };
  }, []);

  const handleUsernameInputChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value as string;
    setUsername(text);
  };

  const handleEmailInputChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value as string;
    setEmail(text);
  };

  const handleOTPInputChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value as string;
    // Only allow numeric input and limit to 6 characters
    setOtp(text);

    // Auto-verify when 6 digits are entered
    if (text.length === 6) {
      handleVerifyOTP(text);
    }
  };

  useEffect(() => {
    let timer: any;
    if (showOTPInput && !showResendOTP) {
      timer = setTimeout(() => {
        setShowResendOTP(true);
      }, 1000 * 60 * 2);
    }
    return () => clearTimeout(timer);
  }, [showOTPInput, showResendOTP]);

  const validatePassword = (password: string) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);

    return password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers;
  };

  const handlePasswordInputChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value as string;
    setPassword(text);
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if(enableEmailVerification){
      if (verified) {
        handleSignUpButtonClick();
      } else if (showOTPInput) {
        handleVerifyOTP();
      } else {
        handleSendOTPButtonClick();
      }
    }else{
      handleSignUpButtonClick()
    }
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSendOTPButtonClick = async () => {
    if (!email.trim()) {
      toast.error(t("auth.email-required"));
      return;
    }

    if (!validateEmail(email)) {
      toast.error(t("auth.invalid-email"));
      return;
    }

    if (actionBtnLoadingState.isLoading) {
      return;
    }

    try {
      actionBtnLoadingState.setLoading();
      const request: VerifyRequest = {
        email: email.trim()
      };

      const { otp: serverOtp } = await userServiceClient.verifyUser(request);

      // Store OTP and verified email securely
      localStorage.setItem("otp", serverOtp);
      localStorage.setItem("verifiedEmail", email.trim());

      setShowOTPInput(true);
      toast.success(t("auth.otp-sent"));
    } catch (error: any) {
      console.error(error);
      toast.error((error as ClientError).details || t("auth.email-verification-failed"));
    } finally {
      actionBtnLoadingState.setFinish();
    }
  };

  const handleVerifyOTP = (otpValue?: string) => {
    const otpToVerify = otpValue || otp;

    if (otpToVerify.length !== 6) {
      toast.error(t("auth.otp-required"));
      return;
    }

    const storedOTP = localStorage.getItem("otp");
    const verifiedEmail = localStorage.getItem("verifiedEmail");

    if (!storedOTP || !verifiedEmail) {
      toast.error(t("auth.verification-expired"));
      setShowOTPInput(false);
      return;
    }

    if (verifiedEmail !== email.trim()) {
      toast.error(t("auth.email-mismatch"));
      setShowOTPInput(false);
      return;
    }

    if (otpToVerify === storedOTP) {
      setVerified(true);
      toast.success(t("auth.email-verified"));
      // Clean up sensitive data
      localStorage.removeItem("otp");
    } else {
      toast.error(t("auth.invalid-otp"));
      setOtp(""); // Clear invalid OTP
    }
  };

  const handleSignUpButtonClick = async () => {
    if (!username.trim()) {
      toast.error(t("auth.username-required"));
      return;
    }

    if (username.trim().length <= 3) {
      toast.error(t("auth.username-too-short"));
      return;
    }

    if (!password.trim()) {
      toast.error(t("auth.password-required"));
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation) {
      toast.error(t("auth.strong-password-required")); // Show first error
      return;
    }

    if (enableEmailVerification) {
      if (!verified) {
        toast.error(t("auth.email-not-verified"));
        return;
      }
    }

    if (actionBtnLoadingState.isLoading) {
      return;
    }

    try {
      actionBtnLoadingState.setLoading();
      const user = User.fromPartial({
        username: username.trim(),
        email: enableEmailVerification?email.trim():"",
        password: password.trim(),
        role: User_Role.USER,
      });

      await userServiceClient.createUser({ user });
      await authServiceClient.createSession({
        passwordCredentials: { username: username.trim(), password: password.trim() },
      });
      await initialUserStore();

      // Clean up any remaining data
      enableEmailVerification&&localStorage.removeItem("verifiedEmail");

      toast.success(t("auth.signup-success"));
      navigateTo("/");
    } catch (error: any) {
      console.error(error);
      toast.error((error as ClientError).details || t("auth.signup-failed"));
    } finally {
      actionBtnLoadingState.setFinish();
    }
  };

  const handleResendOTP = async () => {
    setOtp("");
    setShowOTPInput(false);
    setShowResendOTP(false)
    await handleSendOTPButtonClick();
  };

  return (
    <div className="py-4 sm:py-8 w-80 max-w-full min-h-svh mx-auto flex flex-col justify-start items-center">
      <div className="w-full py-4 grow flex flex-col justify-center items-center">
        <div className="w-full flex flex-row justify-center items-center mb-6">
          <img className="h-14 w-auto rounded-full shadow" src={workspaceGeneralSetting.customProfile?.logoUrl || "/logo.webp"} alt="" />
          <p className="ml-2 text-5xl text-foreground opacity-80">{workspaceGeneralSetting.customProfile?.title || "Memos"}</p>
        </div>
        {!workspaceGeneralSetting.disallowUserRegistration ? (
          <>
            <p className="w-full text-2xl mt-2 text-muted-foreground">{t("auth.create-your-account")}</p>
            <form className="w-full mt-2" onSubmit={handleFormSubmit}>
              {enableEmailVerification ? (
                <>
                  {!verified ? (
                    <>
                      <div className="flex flex-col justify-start items-start w-full gap-4">
                        <div className="w-full flex flex-col justify-start items-start">
                          <span className="leading-8 text-muted-foreground">{t("common.email")}</span>
                          <Input
                            className={`w-full bg-background h-10 ${showOTPInput ? 'cursor-not-allowed opacity-60' : ''}`}
                            type="email"
                            readOnly={showOTPInput || actionBtnLoadingState.isLoading}
                            placeholder={t("common.email")}
                            value={email}
                            autoComplete="email"
                            autoCapitalize="off"
                            spellCheck={false}
                            onChange={handleEmailInputChanged}
                            disabled={showOTPInput}
                            required={enableEmailVerification}
                          />
                        </div>

                        {showOTPInput && (
                          <div className="w-full flex flex-col justify-start items-start">
                            <span className="leading-8 text-muted-foreground">{t("common.otp")}</span>
                            <Input
                              className="w-full bg-background h-10"
                              type="text"
                              readOnly={actionBtnLoadingState.isLoading}
                              placeholder={"******"}
                              value={otp}
                              autoComplete="one-time-code"
                              autoCapitalize="off"
                              spellCheck={false}
                              onChange={handleOTPInputChanged}
                            />
                            {showResendOTP ? (<button
                              type="button"
                              className="mt-2 text-sm text-primary hover:underline"
                              onClick={handleResendOTP}
                              disabled={actionBtnLoadingState.isLoading}
                            >
                              {t("auth.resend-otp")}
                            </button>) : (
                              <p className="mt-2 text-xs text-muted-foreground italic">{t("auth.wait-resend-otp")}</p>
                            )}
                          </div>
                        )}
                      </div>

                      {!showOTPInput && (
                        <div className="flex flex-row justify-end items-center w-full mt-6">
                          <Button type="submit" className="w-full h-10" disabled={actionBtnLoadingState.isLoading}>
                            {t("common.send-otp")}
                            {actionBtnLoadingState.isLoading && <LoaderIcon className="w-5 h-auto ml-2 animate-spin opacity-60" />}
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col justify-start items-start w-full gap-4">
                        <div className="w-full flex flex-col justify-start items-start">
                          <span className="leading-8 text-muted-foreground">{t("common.username")}</span>
                          <Input
                            className="w-full bg-background h-10"
                            type="text"
                            readOnly={actionBtnLoadingState.isLoading}
                            placeholder={t("common.username")}
                            value={username}
                            autoComplete="username"
                            autoCapitalize="off"
                            spellCheck={false}
                            onChange={handleUsernameInputChanged}
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
                            autoComplete="new-password"
                            autoCapitalize="off"
                            spellCheck={false}
                            onChange={handlePasswordInputChanged}
                            required
                          />
                        </div>
                      </div>

                      <div className="flex flex-row justify-end items-center w-full mt-6">
                        <Button type="submit" className="w-full h-10" disabled={actionBtnLoadingState.isLoading}>
                          {t("common.sign-up")}
                          {actionBtnLoadingState.isLoading && <LoaderIcon className="w-5 h-auto ml-2 animate-spin opacity-60" />}
                        </Button>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="flex flex-col justify-start items-start w-full gap-4">
                    <div className="w-full flex flex-col justify-start items-start">
                      <span className="leading-8 text-muted-foreground">{t("common.username")}</span>
                      <Input
                        className="w-full bg-background h-10"
                        type="text"
                        readOnly={actionBtnLoadingState.isLoading}
                        placeholder={t("common.username")}
                        value={username}
                        autoComplete="username"
                        autoCapitalize="off"
                        spellCheck={false}
                        onChange={handleUsernameInputChanged}
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
                        autoComplete="new-password"
                        autoCapitalize="off"
                        spellCheck={false}
                        onChange={handlePasswordInputChanged}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex flex-row justify-end items-center w-full mt-6">
                    <Button type="submit" className="w-full h-10" disabled={actionBtnLoadingState.isLoading}>
                      {t("common.sign-up")}
                      {actionBtnLoadingState.isLoading && <LoaderIcon className="w-5 h-auto ml-2 animate-spin opacity-60" />}
                    </Button>
                  </div>
                </>
              )}
            </form>
          </>
        ) : (
          <p className="w-full text-2xl mt-2 text-muted-foreground">{t("auth.signup-disabled")}</p>
        )}
        {!workspaceStore.state.profile.owner ? (
          <p className="w-full mt-4 text-sm font-medium text-muted-foreground">{t("auth.host-tip")}</p>
        ) : (
          <p className="w-full mt-4 text-sm">
            <span className="text-muted-foreground">{t("auth.sign-in-tip")}</span>
            <Link to="/auth" className="cursor-pointer ml-2 text-primary hover:underline" viewTransition>
              {t("common.sign-in")}
            </Link>
          </p>
        )}
      </div>
      <AuthFooter />
    </div>
  );
});

export default SignUp;