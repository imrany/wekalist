import { last, debounce, throttle } from "lodash-es";
import {
  forwardRef,
  ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { markdownServiceClient } from "@/grpcweb";
import { cn } from "@/lib/utils";
import {
  Node,
  NodeType,
  OrderedListItemNode,
  TaskListItemNode,
  UnorderedListItemNode,
} from "@/types/proto/api/v1/markdown_service";
import { Command } from "../types/command";
import CommandSuggestions from "./CommandSuggestions";
import TagSuggestions from "./TagSuggestions";
import { editorCommands } from "./commands";

export interface EditorRefActions {
  getEditor: () => HTMLTextAreaElement | null;
  focus: () => void;
  scrollToCursor: () => void;
  insertText: (text: string, prefix?: string, suffix?: string) => void;
  removeText: (start: number, length: number) => void;
  setContent: (text: string) => void;
  getContent: () => string;
  getSelectedContent: () => string;
  getCursorPosition: () => number;
  setCursorPosition: (startPos: number, endPos?: number) => void;
  getCursorLineNumber: () => number;
  getLine: (lineNumber: number) => string;
  setLine: (lineNumber: number, text: string) => void;
}

interface Props {
  className: string;
  initialContent: string;
  placeholder: string;
  tools?: ReactNode;
  commands?: Command[];
  onContentChange: (content: string) => void;
  onPaste: (event: React.ClipboardEvent) => void;
}

const Editor = forwardRef(function Editor(props: Props, ref: React.ForwardedRef<EditorRefActions>) {
  const {
    className,
    initialContent,
    placeholder,
    onPaste,
    onContentChange: handleContentChangeCallback,
  } = props;

  const [isInIME, setIsInIME] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editorRef.current && initialContent) {
      editorRef.current.value = initialContent;
      handleContentChangeCallback(initialContent);
    }
  }, [initialContent, handleContentChangeCallback]);

  const updateEditorHeight = useMemo(
    () =>
      throttle(() => {
        if (editorRef.current) {
          editorRef.current.style.height = "auto";
          const scrollHeight = editorRef.current.scrollHeight;
          editorRef.current.style.height = `${scrollHeight}px`;
        }
      }, 100),
    []
  );

  const debounceContentChange = useMemo(
    () =>
      debounce((value: string) => {
        handleContentChangeCallback(value);
      }, 100),
    [handleContentChangeCallback]
  );

  const editorActions: EditorRefActions = {
    getEditor: () => editorRef.current,
    focus: () => editorRef.current?.focus(),
    scrollToCursor: () => {
      const el = editorRef.current;
      if (!el) return;
      const cursorPos = el.selectionStart;
      const beforeCursor = el.value.slice(0, cursorPos);
      const lines = beforeCursor.split("\n");
      const lineHeight = 20; // Approximate line height
      el.scrollTop = lineHeight * lines.length;
    },
    insertText: (content = "", prefix = "", suffix = "") => {
      const el = editorRef.current;
      if (!el) return;

      const start = el.selectionStart;
      const end = el.selectionEnd;
      const prev = el.value;

      const inserted =
        prev.slice(0, start) +
        prefix +
        (content || prev.slice(start, end)) +
        suffix +
        prev.slice(end);

      el.value = inserted;
      const newCursor = start + prefix.length + content.length;
      el.selectionStart = newCursor;
      el.selectionEnd = newCursor;
      el.focus();

      debounceContentChange(el.value);
      updateEditorHeight();
    },
    removeText: (start: number, length: number) => {
      const el = editorRef.current;
      if (!el) return;

      const prev = el.value;
      el.value = prev.slice(0, start) + prev.slice(start + length);
      el.selectionStart = start;
      el.selectionEnd = start;
      el.focus();

      debounceContentChange(el.value);
      updateEditorHeight();
    },
    setContent: (text: string) => {
      const el = editorRef.current;
      if (!el) return;

      el.value = text;
      el.focus();

      debounceContentChange(el.value);
      updateEditorHeight();
    },
    getContent: () => editorRef.current?.value ?? "",
    getSelectedContent: () => {
      const el = editorRef.current;
      if (!el) return "";
      return el.value.slice(el.selectionStart, el.selectionEnd);
    },
    getCursorPosition: () => editorRef.current?.selectionStart ?? 0,
    setCursorPosition: (startPos: number, endPos?: number) => {
      const el = editorRef.current;
      if (!el) return;
      const _end = typeof endPos === "number" ? endPos : startPos;
      el.setSelectionRange(startPos, _end);
    },
    getCursorLineNumber: () => {
      const el = editorRef.current;
      if (!el) return 0;
      return el.value.slice(0, el.selectionStart).split("\n").length - 1;
    },
    getLine: (lineNumber: number) => {
      const el = editorRef.current;
      if (!el) return "";
      return el.value.split("\n")[lineNumber] ?? "";
    },
    setLine: (lineNumber: number, text: string) => {
      const el = editorRef.current;
      if (!el) return;
      const lines = el.value.split("\n");
      lines[lineNumber] = text;
      el.value = lines.join("\n");
      el.focus();

      debounceContentChange(el.value);
      updateEditorHeight();
    },
  };

  useImperativeHandle(ref, () => editorActions, []);

  const handleEditorInput = useCallback(() => {
    if (isInIME) return;
    const value = editorRef.current?.value ?? "";
    debounceContentChange(value);
    updateEditorHeight();
  }, [isInIME, debounceContentChange, updateEditorHeight]);

  const getLastNode = (nodes: Node[]): Node | undefined => {
    const lastNode = last(nodes);
    if (!lastNode) return;
    if (lastNode.type === NodeType.LIST) {
      const children = lastNode.listNode?.children;
      if (children) return getLastNode(children);
    }
    return lastNode;
  };

  const handleEditorKeyDown = async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !isInIME) {
      if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;

      const cursorPosition = editorActions.getCursorPosition();
      const prevContent = editorActions.getContent().substring(0, cursorPosition);
      const { nodes } = await markdownServiceClient.parseMarkdown({ markdown: prevContent });
      const lastNode = getLastNode(nodes);
      if (!lastNode) return;

      const lines = prevContent.split("\n");
      const lastLine = lines[lines.length - 1];
      const indentationMatch = lastLine.match(/^\s*/);
      let insertText = indentationMatch ? indentationMatch[0] : "";

      if (lastNode.type === NodeType.TASK_LIST_ITEM) {
        const { symbol } = lastNode.taskListItemNode as TaskListItemNode;
        insertText += `${symbol} [ ] `;
      } else if (lastNode.type === NodeType.UNORDERED_LIST_ITEM) {
        const { symbol } = lastNode.unorderedListItemNode as UnorderedListItemNode;
        insertText += `${symbol} `;
      } else if (lastNode.type === NodeType.ORDERED_LIST_ITEM) {
        const { number } = lastNode.orderedListItemNode as OrderedListItemNode;
        insertText += `${Number(number) + 1}. `;
      } else if (lastNode.type === NodeType.TABLE) {
        const columns = lastNode.tableNode?.header.length;
        if (!columns) return;
        insertText += "| " + " | ".repeat(columns - 1) + " |";
      }

      if (insertText) {
        editorActions.insertText(insertText);
      }
    }
  };

  return (
    <div className={cn("flex flex-col justify-start items-start relative w-full h-auto max-h-[50vh] bg-inherit", className)}>
      <textarea
        className="w-full h-full my-1 text-base resize-none overflow-x-hidden overflow-y-auto bg-transparent outline-none placeholder:opacity-70 whitespace-pre-wrap break-words"
        rows={1}
        placeholder={placeholder}
        ref={editorRef}
        onPaste={onPaste}
        onInput={handleEditorInput}
        onKeyDown={handleEditorKeyDown}
        onCompositionStart={() => setIsInIME(true)}
        onCompositionEnd={() => setTimeout(() => setIsInIME(false), 0)}
      ></textarea>
      <TagSuggestions editorRef={editorRef} editorActions={ref} />
      <CommandSuggestions editorRef={editorRef} editorActions={ref} commands={editorCommands} />
    </div>
  );
});

export default Editor;
