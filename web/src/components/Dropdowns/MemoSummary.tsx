import { Stars, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useEffect, useState, useCallback } from "react";
import { Memo } from "@/types/proto/api/v1/memo_service";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";
import Renderer from "../MemoContent/Renderer";
import { Node, NodeType } from "@/types/proto/api/v1/markdown_service";
import useLoading from "@/hooks/useLoading";
import { useTranslate } from "@/utils/i18n";
import useSelfWritingText from "@/hooks/useSelfWritingText";
import { AiServiceClient, markdownServiceClient } from "@/grpcweb";
import { workspaceStore } from "@/store";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type Props = {
  memo?: Memo;
};

export default function MemoSummary({ memo }: Props) {
  const { sm } = useResponsiveWidth();
  const loadingState = useLoading();
  const t = useTranslate();
  const navigate =useNavigate()
  
  const [openKey, setOpenKey] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [aiSummaryNodes, setAiSummaryNodes] = useState<Node[]>([]);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  
  // Use the hook with the current summary text - don't include error state to prevent render loops
  const summaryText = aiSummary;
  const { displayed: summary, isComplete } = useSelfWritingText(summaryText, openKey);

  const handleSummarizeMemo = useCallback(async () => {
    if (!memo?.content) {
      console.warn("No memo content to summarize");
      return;
    }

    try {
      loadingState.setLoading();
      setHasError(false);
      setErrorMessage("");
      setIsQuotaExceeded(false);

      const locale = workspaceStore.state.locale;
      const { response } = await AiServiceClient.genAi({
        prompt: `${memo.content}\n\nPlease provide a concise summary ${locale ? `translated to ${locale}` : ''}.`
      });

      if (response) {
        setAiSummary(response);
        
        // Parse the markdown response into nodes
        try {
          const { nodes } = await markdownServiceClient.parseMarkdown({
            markdown: response
          });
          setAiSummaryNodes(nodes || []);
        } catch (parseError) {
          console.log("Failed to parse markdown:", parseError);
          // Fallback: treat as plain text
          setAiSummaryNodes([]);
        }
      }
    } catch (error) {
      setHasError(true);
      
      // Check for specific error messages
      let displayMessage = "Failed to generate AI summary";
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
  }, [memo?.content]);

  // Set loading state based on typing animation completion - prevent multiple calls on error
  useEffect(() => {
    if (openKey && !hasError) {
      handleSummarizeMemo();
    }
  }, [openKey, hasError]);

  const handleUpgrade = () => {
    navigate("/upgrade")
  };

  useEffect(() => {
    if (isComplete && loadingState.isLoading) {
      loadingState.setFinish();
    }
  }, [isComplete, loadingState]);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setOpenKey(Date.now().toString()); // Force re-animation
    }
  };

  const renderAiSummaryContent = () => {
    if (aiSummaryNodes.length > 0) {
      // Render parsed markdown nodes
      let prevNode: Node | null = null;
      let skipNextLineBreakFlag = false;

      return aiSummaryNodes.map((node, index) => {
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
    
    // Fallback: render as plain text with typing effect
    return <span>{summary}</span>;
  };

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="w-6 h-6">
          <Stars className="w-4 h-4 cursor-pointer text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={sm ? "end" : "center"} sideOffset={sm ? 7 : 6}>
        <DropdownMenuLabel className="w-full flex justify-between text-base text-foreground leading-tight font-medium opacity-80 truncate">
          {t("memo.ai.memo-summary")}
          {!loadingState.isLoading &&(
            <>
              {hasError && isQuotaExceeded ? (
                <Button 
                  size={sm?"sm":"default"} 
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
                    setOpenKey(Date.now().toString()); // Trigger retry
                  }}
                >
                  Retry
                </Button>
              )}
            </>
          )}
        </DropdownMenuLabel>
        <DropdownMenuItem>
          <div className="block leading-tight text-wrap lg:max-w-4xl md:max-w-2xl sm:max-w-2xs max-sm:max-w-[80vw] hover:opacity-80 rounded-md transition-colors text-muted-foreground">
            {loadingState.isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating summary...</span>
              </div>
            ) : hasError ? (
              <div className="text-destructive">
                <span>{errorMessage || "Failed to generate AI summary"}</span>
              </div>
            ) : loadingState.isSucceed && aiSummary ? (
              renderAiSummaryContent()
            ) : (
              <span>{summary}</span>
            )}
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}