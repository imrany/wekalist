import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useTranslate } from "@/utils/i18n";
import { BotMessageSquare, Stars, Loader2 } from "lucide-react"
import { EditorRefActions } from "../Editor";
import { ReactNode, RefObject, useEffect, useState, useCallback } from "react";
import useSelfWritingText from "@/hooks/useSelfWritingText";
import useLoading from "@/hooks/useLoading";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";
import { AiServiceClient, markdownServiceClient } from "@/grpcweb";
import { workspaceStore } from "@/store";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Node, NodeType } from "@/types/proto/api/v1/markdown_service";
import Renderer from "@/components/MemoContent/Renderer";

interface Props {
  editorRef: RefObject<EditorRefActions>;
  editorConfig: {
    className: string;
    initialContent: string;
    placeholder: string;
    tools?: ReactNode;
    onContentChange: (content: string) => void;
    onPaste: (event: React.ClipboardEvent) => void;
  }
}

const AIButton = (props: Props) => {
    const { editorRef, editorConfig } = props;
    const { sm } = useResponsiveWidth();
    const t = useTranslate();
    const navigate = useNavigate();
    const loadingState = useLoading();
    
    const [openKey, setOpenKey] = useState("");
    const [hasMinContent, setHasMinContent] = useState(false);
    const [aiContent, setAiContent] = useState("");
    const [aiContentNodes, setAiContentNodes] = useState<Node[]>([]);
    const [hasError, setHasError] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
    
    const { displayed: content, isComplete } = useSelfWritingText(aiContent, openKey);

    // Check content length periodically to avoid render issues
    useEffect(() => {
        const checkContent = () => {
            const currentContent = editorRef.current?.getContent() || "";
            setHasMinContent(currentContent.length > 4);
        };
        
        checkContent();
        const interval = setInterval(checkContent, 1000);
        
        return () => clearInterval(interval);
    }, [editorRef]);

    const handleGenerateMemo = useCallback(async () => {
        const currentContent = editorRef.current?.getContent();
        if (!currentContent || currentContent.length <= 4) {
            console.warn("No sufficient content to generate from");
            return;
        }

        try {
            loadingState.setLoading();
            setHasError(false);
            setErrorMessage("");
            setIsQuotaExceeded(false);

            const locale = workspaceStore.state.locale;
            const { response } = await AiServiceClient.genAi({
                prompt: `${currentContent}\n\nPlease expand this content into a well-structured memo ${locale ? `in ${locale}` : ''}.`
            });

            if (response) {
                setAiContent(response);
                
                // Parse the markdown response into nodes
                try {
                    const { nodes } = await markdownServiceClient.parseMarkdown({
                        markdown: response
                    });
                    setAiContentNodes(nodes || []);
                } catch (parseError) {
                    console.log("Failed to parse markdown:", parseError);
                    setAiContentNodes([]);
                }
                
                // Clear editor and insert new content
                editorRef.current?.setContent("");
                editorRef.current?.insertText(response);
                editorConfig.onContentChange(response);
            }
        } catch (error) {
            setHasError(true);
            
            let displayMessage = "Failed to generate memo";
            const isQuotaError = error instanceof Error && (
                error.message.includes("maximum usage limit reached") || 
                error.message.includes("quota") ||
                error.message.includes("renew your API key")
            );
            
            if (isQuotaError) {
                setIsQuotaExceeded(true);
                displayMessage = "AI quota exceeded. Upgrade to continue using AI features.";
            }
            
            setErrorMessage(displayMessage);
            toast.error(displayMessage);
        } finally {
            loadingState.setFinish();
        }
    }, [editorRef, editorConfig, loadingState]);

    // Set loading state based on typing animation completion
    useEffect(() => {
        if (openKey && !hasError) {
            handleGenerateMemo();
        }
    }, [openKey, hasError]);

    useEffect(() => {
        if (isComplete && loadingState.isLoading) {
            loadingState.setFinish();
        }
    }, [isComplete, loadingState]);

    const handleUpgrade = () => {
        navigate("/upgrade");
    };

    const handleOpenChange = (open: boolean) => {
        if (open) {
            setOpenKey(Date.now().toString());
        }
    };

    const renderAiContent = () => {
        if (aiContentNodes.length > 0) {
            let prevNode: Node | null = null;
            let skipNextLineBreakFlag = false;

            return aiContentNodes.map((node, index) => {
                if (
                    prevNode?.type !== NodeType.LINE_BREAK &&
                    node.type === NodeType.LINE_BREAK &&
                    skipNextLineBreakFlag
                ) {
                    skipNextLineBreakFlag = false;
                    return null;
                }
                prevNode = node;
                skipNextLineBreakFlag = true;
                return (
                    <Renderer 
                        key={`ai-${node.type}-${index}`} 
                        index={String(index)} 
                        node={node} 
                    />
                );
            });
        }
        
        return <span>{content}</span>;
    };

    if (!hasMinContent) {
        return null;
    }

    return (
        <DropdownMenu onOpenChange={handleOpenChange}>
            <DropdownMenuTrigger asChild>
                <Button 
                    variant="ghost" 
                    size="icon"
                    disabled={loadingState.isLoading}
                >
                    <Stars className="size-5 shrink-0" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={sm ? "end" : "center"} sideOffset={sm ? 7 : 6}>
                <DropdownMenuLabel className="w-full flex justify-between text-base text-foreground leading-tight font-medium opacity-80 truncate">
                    {t("memo.ai.generate-memo")}
                    {!loadingState.isLoading && (
                        <>
                            {hasError && isQuotaExceeded ? (
                                <Button 
                                    size={sm ? "sm" : "default"} 
                                    className="ml-2 h-auto p-1 text-xs"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleUpgrade();
                                    }}
                                >
                                    Upgrade
                                </Button>
                            ) : (
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="ml-2 h-auto p-1 text-xs"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setHasError(false);
                                        setErrorMessage("");
                                        setIsQuotaExceeded(false);
                                        setOpenKey(Date.now().toString());
                                    }}
                                >
                                    Retry
                                </Button>
                            )}
                        </>
                    )}
                </DropdownMenuLabel>
                <DropdownMenuItem>
                    <div className="block leading-tight text-wrap lg:max-w-4xl md:max-w-2xl sm:max-w-2xs max-sm:max-w-[80vw] hover:opacity-80 rounded-md transition-colors">
                        {loadingState.isLoading ? (
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Generating memo...</span>
                            </div>
                        ) : hasError ? (
                            <div className="text-destructive">
                                <span>{errorMessage || "Failed to generate memo"}</span>
                            </div>
                        ) : loadingState.isSucceed && aiContent ? (
                            renderAiContent()
                        ) : (
                            <div className="flex items-center gap-2">
                                <BotMessageSquare className="w-4 h-auto text-muted-foreground" />
                                <span className="text-muted-foreground">{t("memo.ai.generate-memo")}</span>
                            </div>
                        )}
                    </div>
                </DropdownMenuItem>
                <div className="px-2 -mt-1">
                    <a
                        className="text-xs text-primary hover:underline"
                        href="https://www.usememos.com/docs/getting-started/content-syntax"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {t("markdown.content-syntax")}
                    </a>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default AIButton;