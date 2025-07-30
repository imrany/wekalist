import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useTranslate } from "@/utils/i18n";
import { BotMessageSquare, Stars } from "lucide-react"
import { EditorRefActions } from "../Editor";
import { ReactNode, RefObject, useEffect, useState } from "react";
import useSelfWritingText from "@/hooks/useSelfWritingText";
import useLoading from "@/hooks/useLoading";

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

const dummyContent = "#### Here is an example of my todo list\n - [ ] My first task\n - [x] My completed task \n#todo"

const AIButton =(props: Props) => {
    const { editorRef, editorConfig } = props;
    const t = useTranslate();
    const [openKey, setOpenKey] = useState("");
    const loadingState= useLoading();
    // const generatedContent = editorRef.current?.getContent() ?? dummyContent;
    const generatedContent = dummyContent;
    const { displayed: content, isComplete } = useSelfWritingText(generatedContent, openKey);

    //Set loading state based on typing animation completion
    useEffect(() => {
        if (openKey) { // Only manage loading state when dropdown is opened
            if (!isComplete) {
                loadingState.setLoading();
            } else {
                loadingState.setFinish();
            }
        }
    }, [isComplete, openKey, loadingState]);

    function handleGenerateMemo(){
        setOpenKey(Math.random().toString()); // Force re-animation
        console.log(content, editorRef, editorConfig)
        editorRef.current?.setContent("")
        editorRef.current?.insertText(content)
    }
    return(
        <>{editorRef.current?.getContent()&&editorRef.current?.getContent().length>4&&(
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <Stars className="size-5 shrink-0" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={handleGenerateMemo}>
                        <BotMessageSquare className="w-4 h-auto text-muted-foreground" />
                        {t("memo.ai.generate-memo")}
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
        )}</>
    )
}
export default AIButton