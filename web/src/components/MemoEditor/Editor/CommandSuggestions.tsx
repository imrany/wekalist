// src/components/MemoEditor/CommandSuggestions.tsx
import { observer } from "mobx-react-lite";
import { useEffect, useMemo, useRef, useState } from "react";
import getCaretCoordinates from "textarea-caret";
import {
  Hash,
  Calendar,
  Code,
  FileText,
  Link,
  Table,
  List,
  Type,
  Zap,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EditorRefActions } from ".";
import { Command } from "../types/command";

type Props = {
  editorRef: React.RefObject<HTMLTextAreaElement>;
  editorActions: React.ForwardedRef<EditorRefActions>;
  commands: Command[];
};

type Position = { left: number; top: number; height: number };

// --- Icon mapping ---
const getCategoryIcon = (cmd: Command) => {
  const iconMap: Record<string, any> = {
    formatting: Type,
    headers: Hash,
    lists: List,
    code: Code,
    media: Link,
    tables: Table,
    quotes: FileText,
    callouts: Zap,
    elements: Zap,
    math: Zap,
    dates: Calendar,
    templates: FileText,
    emoji: Zap,
    diagrams: Zap,
    advanced: (name?: string) => {
      if (name === "undo") return RotateCcw;
      if (name === "redo") return RotateCw;
      return Zap;
    },
  };

  if (cmd.category === "advanced" && typeof iconMap.advanced === "function") {
    return iconMap.advanced(cmd.name);
  }
  return iconMap[cmd.category] || FileText;
};

// --- Category colors ---
const getCategoryColor = (category: string) => {
  const colorMap: Record<string, string> = {
    formatting: "text-blue-500",
    headers: "text-purple-500",
    lists: "text-green-500",
    code: "text-orange-500",
    media: "text-cyan-500",
    tables: "text-indigo-500",
    quotes: "text-gray-500",
    callouts: "text-pink-500",
    elements: "text-emerald-500",
    math: "text-teal-500",
    dates: "text-pink-600",
    templates: "text-yellow-600",
    emoji: "text-fuchsia-500",
    advanced: "text-red-500",
    diagrams: "text-lime-600",
  };
  return colorMap[category] || "text-gray-500";
};

const CommandSuggestions = observer(
  ({ editorRef, editorActions, commands }: Props) => {
    const [position, setPosition] = useState<Position | null>(null);
    const [selected, select] = useState(0);
    const [searchText, setSearchText] = useState<string>("");
    const listenersAreRegisteredRef = useRef(false);

    const hide = () => {
      setPosition(null);
      setSearchText("");
      select(0);
    };

    const getCurrentWord = (): [string, number] => {
      const editor = editorRef.current;
      if (!editor) return ["", 0];
      const cursorPos = editor.selectionEnd;
      const before =
        editor.value.slice(0, cursorPos).match(/\S*$/) || { 0: "", index: cursorPos };
      const after = editor.value.slice(cursorPos).match(/^\S*/) || { 0: "" };
      return [before[0] + after[0], before.index ?? cursorPos];
    };

    // --- Suggestions filtering ---
    const suggestions = useMemo(() => {
      const [word] = getCurrentWord();
      if (!word.startsWith("/")) return [];

      const search = word.slice(1).toLowerCase();
      setSearchText(search);

      if (!search) return commands.slice(0, 10);

      const exactMatches = commands.filter(
        (cmd) => cmd.name.toLowerCase() === search
      );
      const startsWithMatches = commands.filter(
        (cmd) =>
          cmd.name.toLowerCase().startsWith(search) && !exactMatches.includes(cmd)
      );
      const containsMatches = commands.filter(
        (cmd) =>
          cmd.name.toLowerCase().includes(search) &&
          !exactMatches.includes(cmd) &&
          !startsWithMatches.includes(cmd)
      );
      const descriptionMatches = commands.filter(
        (cmd) =>
          cmd.description?.toLowerCase().includes(search) &&
          !exactMatches.includes(cmd) &&
          !startsWithMatches.includes(cmd) &&
          !containsMatches.includes(cmd)
      );

      return [
        ...exactMatches,
        ...startsWithMatches,
        ...containsMatches,
        ...descriptionMatches,
      ].slice(0, 8);
    }, [commands, editorRef.current?.value]);

    // --- Group suggestions ---
    const groupedSuggestions = useMemo(() => {
      const groups = suggestions.reduce((acc, cmd) => {
        const category = cmd.category || "other";
        if (!acc[category]) acc[category] = [];
        acc[category].push(cmd);
        return acc;
      }, {} as Record<string, Command[]>);

      return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    }, [suggestions]);

    const isVisible = !!(position && suggestions.length > 0);

    const autocomplete = (cmd: Command) => {
      const actions =
        editorActions && "current" in editorActions ? editorActions.current : null;
      if (!actions) return;

      const [word, index] = getCurrentWord();
      actions.removeText(index, word.length);

      const result = typeof cmd.run === "function" ? cmd.run() : cmd.run;
      actions.insertText(result);

      if (cmd.cursorOffset) {
        const newPos = actions.getCursorPosition() - result.length + cmd.cursorOffset;
        actions.setCursorPosition(newPos);
      }

      hide();
    };

    // inside component
    const containerRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

    // reset refs when suggestions update
    useEffect(() => {
      itemRefs.current = [];
    }, [suggestions]);

    // scroll selected item into view
    useEffect(() => {
      const el = itemRefs.current[selected];
      if (el && containerRef.current) {
        el.scrollIntoView({ block: "nearest" });
      }
    }, [selected]);

    // --- Fixed keydown handling ---
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isVisible) return;

      if (["Escape", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        hide();
        return;
      }
      if (e.key === "ArrowDown") {
        select((prev) => (prev + 1) % suggestions.length)
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowUp") {
        select((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        e.preventDefault();
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        console.log(selected, suggestions)
        if (suggestions[selected]) {
          autocomplete(suggestions[selected]);
          e.preventDefault();
        }
        return;
      }
    };

    const handleInput = () => {
      const editor = editorRef.current;
      if (!editor) return;

      select(0);
      const [word, index] = getCurrentWord();
      const currentChar = editor.value[editor.selectionEnd];
      const isActive = word.startsWith("/") && currentChar !== "/";

      if (isActive) {
        const caretCoordinates = getCaretCoordinates(editor, index);
        caretCoordinates.top -= editor.scrollTop;

        const editorRect = editor.getBoundingClientRect();
        const maxWidth = 320;
        const rightEdge = caretCoordinates.left + maxWidth;

        if (rightEdge > editorRect.width) {
          caretCoordinates.left = Math.max(0, editorRect.width - maxWidth);
        }

        setPosition(caretCoordinates);
      } else {
        hide();
      }
    };

    const handleClick = () => {
      setTimeout(() => {
        const [word] = getCurrentWord();
        if (!word.startsWith("/")) hide();
      }, 10);
    };

    // --- Register listeners ---
    useEffect(() => {
      const editor = editorRef.current;
      if (!editor || listenersAreRegisteredRef.current) return;

      editor.addEventListener("click", handleClick);
      editor.addEventListener("blur", hide);
      editor.addEventListener("keydown", handleKeyDown);
      editor.addEventListener("input", handleInput);

      listenersAreRegisteredRef.current = true;

      return () => {
        editor.removeEventListener("click", handleClick);
        editor.removeEventListener("blur", hide);
        editor.removeEventListener("keydown", handleKeyDown);
        editor.removeEventListener("input", handleInput);
        listenersAreRegisteredRef.current = false;
      };
    }, [editorRef.current]);

    if (!isVisible || !position) return null;

    return (
      <div
        className="z-50 absolute mt-1 -ml-2 w-80 max-w-sm rounded-lg shadow-lg bg-popover border border-border font-mono"
        style={{ left: position.left, top: position.top + position.height }}
      >
        {/* Header */}
        <div className="px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Commands</span>
            {searchText && (
              <span className="text-xs text-muted-foreground">
                ({suggestions.length} matches)
              </span>
            )}
          </div>
        </div>

        {/* Grouped command list */}
        <div ref={containerRef} className="max-h-64 overflow-y-auto p-1">
          {groupedSuggestions.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No commands found for "/{searchText}"
            </div>
          ) : (
            groupedSuggestions.map(([category, cmds]) => (
              <div key={category}>
                <div className="px-2 py-1 text-xs uppercase text-muted-foreground">
                  {category}
                </div>
                {cmds.map((cmd) => {
                  const Icon = getCategoryIcon(cmd);
                  const isSelected = suggestions.indexOf(cmd) === selected;
                  return (
                    <div
                      key={cmd.name}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        autocomplete(cmd);
                      }}
                      onMouseEnter={() => select(suggestions.indexOf(cmd))}
                      role="option"
                      aria-selected={isSelected}
                      className={cn(
                        "relative flex items-start gap-3 rounded-md px-3 py-2 text-sm cursor-pointer transition-colors",
                        "hover:bg-accent hover:text-accent-foreground",
                        isSelected && "bg-accent text-accent-foreground"
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex-shrink-0",
                          getCategoryColor(cmd.category)
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">
                            /{cmd.name}
                          </span>
                          {cmd.shortcut && (
                            <span className="px-1.5 py-0.5 text-xs bg-muted text-muted-foreground rounded">
                              {cmd.shortcut}
                            </span>
                          )}
                        </div>
                        {cmd.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                            {searchText
                              ? cmd.description
                                  .split(
                                    new RegExp(`(${searchText})`, "gi")
                                  )
                                  .map((part, idx) =>
                                    part.toLowerCase() ===
                                    searchText.toLowerCase() ? (
                                      <mark
                                        key={idx}
                                        className="bg-yellow-200 text-yellow-900 px-0.5 rounded"
                                      >
                                        {part}
                                      </mark>
                                    ) : (
                                      part
                                    )
                                  )
                              : cmd.description}
                          </p>
                        )}
                      </div>
                      {isSelected && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-border bg-muted/30">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-muted rounded">↑↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-muted rounded">↵</kbd>
                Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-muted rounded">Esc</kbd>
                Close
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

export default CommandSuggestions;
