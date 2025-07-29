import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useTranslate } from "@/utils/i18n";
import { BotMessageSquare, Stars } from "lucide-react"
import { EditorRefActions } from "../Editor";

interface Props {
  editorRef: React.RefObject<EditorRefActions>;
}
const AIButton =(props: Props) => {
    const { editorRef } = props;
    const t = useTranslate();

    function handleGenerateMemo(){
        console.log(editorRef.current?.getContent())
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