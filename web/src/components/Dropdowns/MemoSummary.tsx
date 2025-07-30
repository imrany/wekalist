import { Stars } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useEffect, useState } from "react";
import { Memo } from "@/types/proto/api/v1/memo_service";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";
import Renderer from "../MemoContent/Renderer";
import { Node, NodeType } from "@/types/proto/api/v1/markdown_service";
import useLoading from "@/hooks/useLoading";
import { useTranslate } from "@/utils/i18n";

const dummySummary =
  "This memo discusses the quarterly financial results and outlines the next steps for the team.";

function useSelfWritingText(text: string, resetKey: string, delay = 40) {
  const [displayed, setDisplayed] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  
  useEffect(() => {
    setDisplayed("");
    setIsComplete(false);
    
    let i = -1;
    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        setDisplayed((prev) => {
          const newText = text[i] ? prev + text[i] : prev;
          return newText;
        });
        i++;
        if (i >= text.length) {
          clearInterval(interval);
          setIsComplete(true);
        }
      }, delay);
    }, delay);

    return () => {
      clearTimeout(timeout);
      setDisplayed("");
      setIsComplete(false);
    };
  }, [text, resetKey, delay]);

  return { displayed, isComplete };
}

type Props = {
  memo?: Memo;
};

export default function MemoSummary({ memo }: Props) {
  const { sm } = useResponsiveWidth();
  const loadingState = useLoading();
  const t =useTranslate()
  
  const [openKey, setOpenKey] = useState("");
  const summaryText = memo?.snippet ?? dummySummary;
  const { displayed: summary, isComplete } = useSelfWritingText(summaryText, openKey);
  
  let prevNode: Node | null = null;
  let skipNextLineBreakFlag = false;

  // Set loading state based on typing animation completion
  useEffect(() => {
    if (openKey) { // Only manage loading state when dropdown is opened
      if (!isComplete) {
        loadingState.setLoading();
      } else {
        loadingState.setFinish();
      }
    }
  }, [isComplete, openKey, loadingState]);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setOpenKey(Date.now().toString()); // Force re-animation
      console.log(memo);
    }
  };

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="w-6 h-6">
          <Stars className="w-4 h-4 cursor-pointer text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={sm ? "end" : "center"} sideOffset={sm ? 7 : 6}>
        <DropdownMenuLabel className="w-full text-base text-foreground leading-tight font-medium opacity-80 truncate">
          {t("memo.ai.memo-summary")}
        </DropdownMenuLabel>
        <DropdownMenuItem>
          <p className="block leading-tight text-wrap lg:max-w-4xl md:max-w-2xl sm:max-w-2xs max-sm:max-w-[80vw] hover:opacity-80 rounded-md transition-colors text-muted-foreground">
            {loadingState.isSucceed ? (
              <>
                {memo?.nodes.map((node, index) => {
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
                  return <Renderer key={`${node.type}-${index}`} index={String(index)} node={node} />;
                })}
              </>
            ) : (
              summary
            )}
          </p>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}