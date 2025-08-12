import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useTranslate } from "@/utils/i18n";
import { BotMessageSquare, Stars, Loader2 } from "lucide-react"
import { EditorRefActions } from "../Editor";
import { ReactNode, RefObject, useEffect, useState, useCallback, useRef } from "react";
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
    
    // Use refs to prevent infinite loops
    const isGeneratingRef = useRef(false);
    const hasTriggeredRef = useRef(false);
    
    const [hasMinContent, setHasMinContent] = useState(false);
    const [aiContent, setAiContent] = useState("");
    const [aiContentNodes, setAiContentNodes] = useState<Node[]>([]);
    const [hasError, setHasError] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
    const [triggerKey, setTriggerKey] = useState<string>("");
    
    const { displayed: content, isComplete } = useSelfWritingText(aiContent, triggerKey);

    // Check content length periodically
    useEffect(() => {
        const checkContent = () => {
            const currentContent = editorRef.current?.getContent() || "";
            setHasMinContent(currentContent.length > 4);
        };
        
        checkContent();
        const interval = setInterval(checkContent, 1000);
        
        return () => clearInterval(interval);
    }, [editorRef]);

    // Tag-based prompt generation
    const generatePrompt = (currentContent: string, locale?: string) => {
        const tagRegex = /#(\w+)/g;
        const tags = Array.from(currentContent.matchAll(tagRegex), m => m[1].toLowerCase());
        const contentWithoutTags = currentContent.replace(tagRegex, '').trim();
        
        const tagPrompts = {
            todo: {
                context: "task management and productivity",
                instructions: "Create a detailed, actionable todo list or task breakdown",
                style: "clear, organized, and action-oriented",
                format: "Use bullet points, priorities, and deadlines where appropriate"
            },
            journal: {
                context: "personal reflection and journaling",
                instructions: "Expand into a thoughtful journal entry with personal insights",
                style: "reflective, introspective, and personal",
                format: "Use flowing paragraphs with emotional depth"
            },
            meeting: {
                context: "meeting notes and business communication",
                instructions: "Structure as comprehensive meeting notes with action items",
                style: "professional, organized, and concise",
                format: "Include agenda items, decisions, and next steps"
            },
            brainstorm: {
                context: "creative ideation and brainstorming",
                instructions: "Expand with creative ideas, possibilities, and innovative approaches",
                style: "creative, exploratory, and open-minded",
                format: "Use varied formats: lists, mind-mapping style, or creative paragraphs"
            },
            research: {
                context: "research and knowledge gathering",
                instructions: "Create detailed, well-researched content with supporting information",
                style: "informative, analytical, and evidence-based",
                format: "Include key points, references, and structured analysis"
            },
            project: {
                context: "project planning and management",
                instructions: "Develop into a structured project outline with phases and deliverables",
                style: "systematic, comprehensive, and goal-oriented",
                format: "Use project structure with timelines, milestones, and resources"
            },
            idea: {
                context: "idea development and innovation",
                instructions: "Expand the concept with detailed exploration and potential applications",
                style: "innovative, detailed, and forward-thinking",
                format: "Include concept explanation, benefits, and implementation possibilities"
            },
            summary: {
                context: "summarization and key insights",
                instructions: "Create a comprehensive summary with key takeaways and insights",
                style: "concise yet thorough, analytical",
                format: "Use clear sections: overview, key points, and conclusions"
            },
            recipe: {
                context: "cooking and culinary content",
                instructions: "Develop into a complete recipe with ingredients, steps, and tips",
                style: "clear, instructional, and helpful",
                format: "Include ingredients list, step-by-step instructions, and serving suggestions"
            },
            review: {
                context: "reviews and evaluations",
                instructions: "Create a thorough review with analysis, pros/cons, and recommendations",
                style: "balanced, detailed, and evaluative",
                format: "Include overview, detailed analysis, and final verdict"
            }
        };

        const primaryTag = tags[0];
        const tagConfig = tagPrompts[primaryTag as keyof typeof tagPrompts];
        
        if (tagConfig) {
            return `CONTENT ENHANCEMENT REQUEST

INPUT: ${contentWithoutTags}
DETECTED CONTEXT: ${tagConfig.context.toUpperCase()}
TAGS: ${tags.map(tag => `#${tag}`).join(' ')}

INSTRUCTIONS:
${tagConfig.instructions}

REQUIREMENTS:
✓ Length: 500-8000 characters
✓ Style: ${tagConfig.style}
✓ Format: ${tagConfig.format}${locale ? `\n✓ Language: ${locale}` : ''}

Please create comprehensive, valuable content that enhances the original input while maintaining the ${primaryTag} context.`;
        }
        
        return `CONTENT EXPANSION REQUEST

INPUT: ${currentContent}${tags.length > 0 ? `\nTAGS: ${tags.map(tag => `#${tag}`).join(' ')}` : ''}

REQUIREMENTS:
✓ Length: 500-8000 characters
✓ Quality: High, professional writing
✓ Style: Clear and engaging${locale ? `\n✓ Language: ${locale}` : ''}

Please expand on the input to create comprehensive, valuable content within these parameters.`;
    };

    const handleGenerateMemo = useCallback(async () => {
        const currentContent = editorRef.current?.getContent();
        if (!currentContent || currentContent.length <= 4) {
            console.warn("No sufficient content to generate from");
            return;
        }

        // Prevent multiple simultaneous calls
        if (isGeneratingRef.current) {
            return;
        }

        isGeneratingRef.current = true;

        try {
            loadingState.setLoading();
            setHasError(false);
            setErrorMessage("");
            setIsQuotaExceeded(false);

            const locale = workspaceStore.state.locale;
            const tagRegex = /#(\w+)/g;
            const tags = Array.from(currentContent.matchAll(tagRegex), m => m[1].toLowerCase());
            
            const enhancedPrompt = generatePrompt(currentContent, locale);
            const { response } = await AiServiceClient.genAi({
                prompt: enhancedPrompt
            });

            if (response) {
                const tagLine = tags.length > 0 ? `\n\n${tags.map(tag => `#${tag}`).join(" ")}` : "";
                const finalContent = response + tagLine;
                
                setAiContent(finalContent);
                
                editorRef.current?.setContent("");
                editorRef.current?.insertText(finalContent);
                editorConfig.onContentChange(finalContent);

                try {
                    const { nodes } = await markdownServiceClient.parseMarkdown({
                        markdown: finalContent
                    });
                    setAiContentNodes(nodes || []);
                } catch (parseError) {
                    console.log("Failed to parse markdown:", parseError);
                    setAiContentNodes([]);
                }
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
            isGeneratingRef.current = false;
        }
    }, [editorRef, editorConfig]);

    // Single effect to handle generation trigger
    useEffect(() => {
        if (triggerKey && !hasTriggeredRef.current && !isGeneratingRef.current) {
            hasTriggeredRef.current = true;
            handleGenerateMemo().finally(() => {
                hasTriggeredRef.current = false;
            });
        }
    }, [triggerKey, handleGenerateMemo]);

    const handleUpgrade = useCallback(() => {
        navigate("/upgrade");
    }, [navigate]);

    const handleOpenChange = useCallback((open: boolean) => {
        if (open && !isGeneratingRef.current) {
            setTriggerKey(Date.now().toString());
        }
    }, []);

    const handleRetry = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isGeneratingRef.current) {
            setHasError(false);
            setErrorMessage("");
            setIsQuotaExceeded(false);
            hasTriggeredRef.current = false;
            setTriggerKey(Date.now().toString());
        }
    }, []);

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
                    disabled={isGeneratingRef.current}
                >
                    <Stars className="size-5 shrink-0" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={sm ? "end" : "center"} sideOffset={sm ? 7 : 6}>
                <DropdownMenuLabel className="w-full flex justify-between text-base text-foreground leading-tight font-medium opacity-80 truncate">
                    {t("memo.ai.generate-memo")}
                    {!isGeneratingRef.current && (
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
                                    onClick={handleRetry}
                                >
                                    Retry
                                </Button>
                            )}
                        </>
                    )}
                </DropdownMenuLabel>
                <div className="block py-2 px-3 text-sm leading-tight text-wrap lg:max-w-4xl md:max-w-2xl sm:max-w-2xs max-sm:max-w-[80vw] hover:opacity-80 rounded-md transition-colors">
                    {isGeneratingRef.current ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Generating memo...</span>
                        </div>
                    ) : hasError ? (
                        <div className="text-destructive">
                            <span>{errorMessage || "Failed to generate memo"}</span>
                        </div>
                    ) : aiContent ? (
                        renderAiContent()
                    ) : (
                        <div className="flex items-center gap-2">
                            <BotMessageSquare className="w-4 h-auto text-muted-foreground" />
                            <span className="text-muted-foreground">{t("memo.ai.generate-memo")}</span>
                        </div>
                    )}
                </div>
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