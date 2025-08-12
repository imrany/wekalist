import { HashIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useMemo } from "react";
import OverflowTip from "@/components/kit/OverflowTip";
import { Button } from "@/components/ui/button";
import { userStore } from "@/store";
import { useTranslate } from "@/utils/i18n";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { EditorRefActions } from "../Editor";

interface Props {
  editorRef: React.RefObject<EditorRefActions>;
}

const TagSelector = observer((props: Props) => {
  const t = useTranslate();
  const { editorRef } = props;
  
  const defaultTags = useMemo(() => [
    "todo",
    "journal",
    "meeting",
    "brainstorm",
    "research",
    "project",
    "idea",
    "summary",
    "recipe",
    "review",
    "draft",
    "note",
    "reference",
    "archive",
    "important",
    "follow-up",
    "inspiration",
    "action-item",
    "question",
    "feedback",
    "discussion",
    "analysis",
    "planning",
    "development",
    "design",
    "testing",
    "deployment",
    "documentation",
    "collaboration",
    "presentation",
    "report",
    "milestone",
    "deadline",
    "update",
    "announcement",
    "event",
    "notification",
    "reminder",
    "alert",
    "status",
    "priority",
    "urgent",
    "completed",
    "pending",
    "canceled",
    "resolved",
    "escalated",
    "reviewed",
    "approved",   
    "rejected",
    "archived",
    "deleted",
    "favorite",
    "shared",
    "private",
    "public",
    "confidential",
    "restricted",
    "open",
    "closed",
    "active",
    "inactive",
    "task",
    "issue",
    "bug",
    "feature",
    "enhancement",
    "improvement",
    "answer",   
    "solution",
    "comment"
  ], []);

  const userTags = useMemo(() => {
    return Object.entries(userStore.state.tagCount)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);
  }, []);

  const tags = useMemo(() => {
    return Array.from(new Set([...defaultTags, ...userTags]));
  }, [defaultTags, userTags]);

  const handleTagClick = useCallback((tag: string) => {
    const current = editorRef.current;
    if (!current) return;

    try {
      const line = current.getLine(current.getCursorLineNumber());
      const lastCharOfLine = line.slice(-1);

      if (lastCharOfLine !== " " && lastCharOfLine !== "　" && line !== "") {
        current.insertText("\n");
      }
      current.insertText(`#${tag} `);
    } catch (error) {
      console.error("Failed to insert tag:", error);
    }
  }, [editorRef]);

  const handlePopoverClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon">
          <HashIcon className="size-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={2}>
        {tags.length > 0 ? (
          <div className="flex flex-row justify-start items-start flex-wrap px-2 max-w-48 h-auto max-h-48 overflow-y-auto gap-x-2">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                className="inline-flex w-auto max-w-full cursor-pointer text-base leading-6 text-muted-foreground hover:opacity-80 hover:text-foreground transition-colors p-0 border-none bg-transparent"
                onClick={() => handleTagClick(tag)}
              >
                <OverflowTip>#{tag}</OverflowTip>
              </button>
            ))}
          </div>
        ) : (
          <p className="italic mx-2" onClick={handlePopoverClick}>
            {t("tag.no-tag-found")}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
});

export default TagSelector;