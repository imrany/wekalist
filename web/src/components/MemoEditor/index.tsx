import copy from "copy-to-clipboard";
import { isEqual, debounce } from "lodash-es";
import { LoaderIcon, SendIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import useLocalStorage from "react-use/lib/useLocalStorage";
import { Button } from "@/components/ui/button";
import { memoServiceClient, SubscriptionServiceClient } from "@/grpcweb";
import { TAB_SPACE_WIDTH } from "@/helpers/consts";
import { isValidUrl } from "@/helpers/utils";
import useAsyncEffect from "@/hooks/useAsyncEffect";
import useCurrentUser from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { memoStore, attachmentStore, userStore, workspaceStore } from "@/store";
import { extractMemoIdFromName } from "@/store/common";
import { Attachment } from "@/types/proto/api/v1/attachment_service";
import { Location, Memo, MemoRelation, MemoRelation_Type, Visibility } from "@/types/proto/api/v1/memo_service";
import { UserSetting } from "@/types/proto/api/v1/user_service";
import { SendNotificationRequest } from "@/types/proto/api/v1/subscription_service";
import { useTranslate } from "@/utils/i18n";
import { convertVisibilityFromString } from "@/utils/memo";
import DateTimeInput from "../DateTimeInput";
import AddMemoRelationPopover from "./ActionButton/AddMemoRelationPopover";
import LocationSelector from "./ActionButton/LocationSelector";
import MarkdownMenu from "./ActionButton/MarkdownMenu";
import TagSelector from "./ActionButton/TagSelector";
import UploadAttachmentButton from "./ActionButton/UploadAttachmentButton";
import VisibilitySelector from "./ActionButton/VisibilitySelector";
import AttachmentListView from "./AttachmentListView";
import Editor, { EditorRefActions } from "./Editor";
import RelationListView from "./RelationListView";
import { handleEditorKeydownWithMarkdownShortcuts, hyperlinkHighlightedText } from "./handlers";
import { MemoEditorContext } from "./types";
import AIButton from "./ActionButton/AIButton";

export interface Props {
  className?: string;
  cacheKey?: string;
  placeholder?: string;
  // The name of the memo to be edited.
  memoName?: string;
  // The name of the parent memo if the memo is a comment.
  parentMemoName?: string;
  autoFocus?: boolean;
  onConfirm?: (memoName: string) => void;
  onCancel?: () => void;
}

interface State {
  memoVisibility: Visibility;
  attachmentList: Attachment[];
  relationList: MemoRelation[];
  location: Location | undefined;
  isUploadingAttachment: boolean;
  isRequesting: boolean;
  isComposing: boolean;
  isDraggingFile: boolean;
}

// Utility function to truncate text for notifications
const truncateText = (text: string, maxLength: number = 100): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + "...";
};

// Utility function to extract plain text from markdown content
const stripMarkdown = (content: string): string => {
  return content
    .replace(/[*_~`]/g, '') // Remove basic markdown formatting
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to just text
    .replace(/^#+\s+/gm, '') // Remove headers
    .replace(/^\s*[-*+]\s+/gm, '') // Remove list items
    .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered lists
    .replace(/\n{2,}/g, '\n') // Collapse multiple newlines
    .trim();
};

const MemoEditor = observer((props: Props) => {
  const { className, cacheKey, memoName, parentMemoName, autoFocus, onConfirm, onCancel } = props;
  const t = useTranslate();
  const { i18n } = useTranslation();
  const currentUser = useCurrentUser();
  const [state, setState] = useState<State>({
    memoVisibility: Visibility.PRIVATE,
    attachmentList: [],
    relationList: [],
    location: undefined,
    isUploadingAttachment: false,
    isRequesting: false,
    isComposing: false,
    isDraggingFile: false,
  });
  const [createTime, setCreateTime] = useState<Date | undefined>();
  const [updateTime, setUpdateTime] = useState<Date | undefined>();
  const [hasContent, setHasContent] = useState<boolean>(false);
  const [isVisibilitySelectorOpen, setIsVisibilitySelectorOpen] = useState(false);
  const editorRef = useRef<EditorRefActions>(null);
  const saveStartTime = useRef<number>(0);
  const userSetting = userStore.state.userSetting as UserSetting;
  const contentCacheKey = `${currentUser.name}-${cacheKey || ""}`;
  const [contentCache, setContentCache] = useLocalStorage<string>(contentCacheKey, "");
  
  // Memoized expensive computation
  const referenceRelations = useMemo(() => {
    return memoName
      ? state.relationList.filter(
          (relation) =>
            relation.memo?.name === memoName && 
            relation.relatedMemo?.name !== memoName && 
            relation.type === MemoRelation_Type.REFERENCE,
        )
      : state.relationList.filter((relation) => relation.type === MemoRelation_Type.REFERENCE);
  }, [memoName, state.relationList]);
  
  const workspaceMemoRelatedSetting = workspaceStore.state.memoRelatedSetting;

  // Debounced content caching to improve performance
  const debouncedSetContentCache = useMemo(
    () => debounce((content: string) => {
      if (content !== "") {
        setContentCache(content);
      } else {
        localStorage.removeItem(contentCacheKey);
      }
    }, 500), // 500ms debounce
    [contentCacheKey, setContentCache]
  );

  useEffect(() => {
    editorRef.current?.setContent(contentCache || "");
  }, []);

  useEffect(() => {
    if (autoFocus) {
      handleEditorFocus();
    }
  }, [autoFocus]);

  useAsyncEffect(async () => {
    let visibility = convertVisibilityFromString(userSetting.memoVisibility);
    if (workspaceMemoRelatedSetting.disallowPublicVisibility && visibility === Visibility.PUBLIC) {
      visibility = Visibility.PROTECTED;
    }
    if (parentMemoName) {
      const parentMemo = await memoStore.getOrFetchMemoByName(parentMemoName);
      visibility = parentMemo.visibility;
    }
    setState((prevState) => ({
      ...prevState,
      memoVisibility: convertVisibilityFromString(visibility),
    }));
  }, [parentMemoName, userSetting.memoVisibility, workspaceMemoRelatedSetting.disallowPublicVisibility]);

  useAsyncEffect(async () => {
    if (!memoName) {
      return;
    }

    const memo = await memoStore.getOrFetchMemoByName(memoName);
    if (memo) {
      handleEditorFocus();
      setCreateTime(memo.createTime);
      setUpdateTime(memo.updateTime);
      setState((prevState) => ({
        ...prevState,
        memoVisibility: memo.visibility,
        attachmentList: memo.attachments,
        relationList: memo.relations,
        location: memo.location,
      }));
      if (!contentCache) {
        editorRef.current?.setContent(memo.content ?? "");
      }
    }
  }, [memoName]);

  // Background notification functions (non-blocking)
  const sendPublicMemoNotification = async (memo: Memo, isUpdate: boolean = false) => {
    // Only send notifications for public memos and not for comments
    if (memo.visibility !== Visibility.PUBLIC || parentMemoName) {
      return;
    }

    try {
      const content = stripMarkdown(memo.content || "");
      const previewText = truncateText(content, 120);
      
      const title = isUpdate 
        ? `📝 ${currentUser.username} updated a memo`
        : `📝 New memo from ${currentUser.username}`;
      
      const body = previewText || (isUpdate ? "Memo has been updated" : "New memo published");
      
      const memoId = extractMemoIdFromName(memo.name);
      const baseUrl = window.location.origin;
      const memoUrl = `${baseUrl}/memos/${memoId}`;

      const notificationRequest: SendNotificationRequest = {
        email: currentUser.email,
        payload: {
          title,
          body,
          icon: "",
          badge: "",
          url: memoUrl,
          data: {
            memoId,
            authorName: currentUser.username,
            isUpdate: isUpdate.toString(),
            visibility: memo.visibility.toString(),
            timestamp: new Date().toISOString(),
          },
        },
        sendToAll: false,
        username: "",
        sendToAllExcept: currentUser.username
      };

      const response = await SubscriptionServiceClient.sendNotification(notificationRequest);
      
      if (response.success) {
        console.log(`Notification sent successfully to ${response.recipientsCount} recipients`);
      } else {
        console.warn("Failed to send notification:", response.message);
      }
    } catch (error) {
      console.error("Error sending push notification:", error);
    }
  };

  const sendCommentNotification = async (comment: Memo, parentMemo: Memo, isUpdate: boolean = false) => {
    const creator = parentMemo.creator.split("/")[1];
    if (creator === currentUser.username) {
      return;
    }

    try {
      const content = stripMarkdown(comment.content || "");
      const previewText = truncateText(content, 100);
      
      const parentContent = stripMarkdown(parentMemo.content || "");
      const parentPreview = truncateText(parentContent, 50);
      
      const title = isUpdate 
        ? `💬 ${currentUser.username} updated their comment on your memo`
        : `💬 ${currentUser.username} commented on your memo`;
      const body = previewText || (isUpdate ? "Comment has been updated" : "New comment on your memo");
      
      const parentMemoId = extractMemoIdFromName(parentMemo.name);
      const baseUrl = window.location.origin;
      const memoUrl = `${baseUrl}/memos/${parentMemoId}`;

      const notificationRequest: SendNotificationRequest = {
        email: currentUser.email,
        payload: {
          title,
          body,
          icon: "",
          badge: "",
          url: memoUrl,
          data: {
            memoId: parentMemoId,
            commentId: extractMemoIdFromName(comment.name),
            authorName: currentUser.username,
            isComment: "true",
            isUpdate: isUpdate.toString(),
            parentMemoPreview: parentPreview,
            timestamp: new Date().toISOString(),
          },
        },
        sendToAll: false,
        username: creator,
        sendToAllExcept: ""
      };

      const response = await SubscriptionServiceClient.sendNotification(notificationRequest);
      
      if (response.success) {
        console.log(`Comment notification sent successfully to memo owner`);
      } else {
        console.warn("Failed to send comment notification:", response.message);
      }
    } catch (error) {
      console.error("Error sending comment notification:", error);
    }
  };

  const handleCompositionStart = () => {
    setState((prevState) => ({
      ...prevState,
      isComposing: true,
    }));
  };

  const handleCompositionEnd = () => {
    setState((prevState) => ({
      ...prevState,
      isComposing: false,
    }));
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!editorRef.current) {
      return;
    }

    const isMetaKey = event.ctrlKey || event.metaKey;
    if (isMetaKey) {
      if (event.key === "Enter") {
        handleSaveBtnClick();
        return;
      }
      if (!workspaceMemoRelatedSetting.disableMarkdownShortcuts) {
        handleEditorKeydownWithMarkdownShortcuts(event, editorRef.current);
      }
    }
    if (event.key === "Tab" && !state.isComposing) {
      event.preventDefault();
      const tabSpace = " ".repeat(TAB_SPACE_WIDTH);
      const cursorPosition = editorRef.current.getCursorPosition();
      const selectedContent = editorRef.current.getSelectedContent();
      editorRef.current.insertText(tabSpace);
      if (selectedContent) {
        editorRef.current.setCursorPosition(cursorPosition + TAB_SPACE_WIDTH);
      }
      return;
    }
  };

  const handleMemoVisibilityChange = (visibility: Visibility) => {
    setState((prevState) => ({
      ...prevState,
      memoVisibility: visibility,
    }));
  };

  const handleSetAttachmentList = (attachmentList: Attachment[]) => {
    setState((prevState) => ({
      ...prevState,
      attachmentList,
    }));
  };

  const handleSetRelationList = (relationList: MemoRelation[]) => {
    setState((prevState) => ({
      ...prevState,
      relationList,
    }));
  };

  // Optimized file upload with better error handling
  const handleUploadResource = async (file: File) => {
    setState((state) => ({ ...state, isUploadingAttachment: true }));

    const { name: filename, size, type } = file;
    
    try {
      let content: Uint8Array;
      
      // For large files (>10MB), handle more carefully
      if (size > 10 * 1024 * 1024) {
        console.log(`Uploading large file: ${filename} (${(size / 1024 / 1024).toFixed(1)}MB)`);
      }
      
      content = new Uint8Array(await file.arrayBuffer());

      const attachment = await attachmentStore.createAttachment({
        attachment: Attachment.fromPartial({
          filename,
          size,
          type,
          content,
        }),
        attachmentId: "",
      });

      setState((state) => ({ ...state, isUploadingAttachment: false }));
      return attachment;
    } catch (error: any) {
      console.error(error);
      toast.error(error.details || `Failed to upload ${filename}`);
      setState((state) => ({ ...state, isUploadingAttachment: false }));
      throw error;
    }
  };

  // OPTIMIZED: Parallel file uploads
  const uploadMultiFiles = async (files: FileList) => {
    const uploadPromises = Array.from(files).map(async (file) => {
      try {
        return await handleUploadResource(file);
      } catch (error) {
        console.error(`Failed to upload file ${file.name}:`, error);
        return null;
      }
    });

    // Upload all files in parallel
    const uploadResults = await Promise.allSettled(uploadPromises);
    const uploadedAttachments = uploadResults
      .filter((result): result is PromiseFulfilledResult<Attachment> => 
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value);

    // Update attachments in parallel if editing existing memo
    if (memoName && uploadedAttachments.length > 0) {
      const updatePromises = uploadedAttachments.map(attachment =>
        attachmentStore.updateAttachment({
          attachment: Attachment.fromPartial({
            name: attachment.name,
            memo: memoName,
          }),
          updateMask: ["memo"],
        }).catch(error => {
          console.error(`Failed to update attachment ${attachment.name}:`, error);
          return null;
        })
      );

      await Promise.allSettled(updatePromises);
    }

    if (uploadedAttachments.length > 0) {
      setState((prevState) => ({
        ...prevState,
        attachmentList: [...prevState.attachmentList, ...uploadedAttachments],
      }));
    }

    return uploadedAttachments;
  };

  // Optimized drag & drop with file validation
  const handleDropEvent = async (event: React.DragEvent) => {
    if (!event.dataTransfer?.files?.length) return;
    
    event.preventDefault();
    setState((prevState) => ({ ...prevState, isDraggingFile: false }));

    // Filter and validate files before upload
    const validFiles = Array.from(event.dataTransfer.files).filter(file => {
      const maxSize = 50 * 1024 * 1024; // 50MB limit
      const allowedTypes = ['image/', 'text/', 'application/pdf', 'application/json', 'video/', 'audio/'];
      
      if (file.size > maxSize) {
        toast.error(`File ${file.name} is too large (max 50MB)`);
        return false;
      }
      
      if (!allowedTypes.some(type => file.type.startsWith(type))) {
        toast.error(`File type ${file.type} is not supported`);
        return false;
      }
      
      return true;
    });

    if (validFiles.length > 0) {
      const fileList = new DataTransfer();
      validFiles.forEach(file => fileList.items.add(file));
      await uploadMultiFiles(fileList.files);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    if (event.dataTransfer && event.dataTransfer.types.includes("Files")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      if (!state.isDraggingFile) {
        setState((prevState) => ({
          ...prevState,
          isDraggingFile: true,
        }));
      }
    }
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setState((prevState) => ({
      ...prevState,
      isDraggingFile: false,
    }));
  };

  const handlePasteEvent = async (event: React.ClipboardEvent) => {
    if (event.clipboardData && event.clipboardData.files.length > 0) {
      event.preventDefault();
      await uploadMultiFiles(event.clipboardData.files);
    } else if (
      editorRef.current != null &&
      editorRef.current.getSelectedContent().length != 0 &&
      isValidUrl(event.clipboardData.getData("Text"))
    ) {
      event.preventDefault();
      hyperlinkHighlightedText(editorRef.current, event.clipboardData.getData("Text"));
    }
  };

  // Optimized content change with debounced caching
  const handleContentChange = (content: string) => {
    setHasContent(content !== "");
    debouncedSetContentCache(content);
  };

  // OPTIMIZED: Faster save with parallel operations and background notifications
  const handleSaveBtnClick = async () => {
    if (state.isRequesting) return;

    saveStartTime.current = performance.now();
    setState((state) => ({ ...state, isRequesting: true }));
    const content = editorRef.current?.getContent() ?? "";
    
    try {
      let savedMemo: Memo;
      let notificationPromise: Promise<void> | null = null;

      if (memoName) {
        // UPDATE MEMO
        const prevMemo = await memoStore.getOrFetchMemoByName(memoName);
        if (!prevMemo) throw new Error("Memo not found");

        const updateMask = new Set<string>();
        const memoPatch: Partial<Memo> = { name: prevMemo.name };
        
        // Build update mask efficiently
        const updates = [
          { key: 'content', current: content, prev: prevMemo.content },
          { key: 'visibility', current: state.memoVisibility, prev: prevMemo.visibility },
          { key: 'attachments', current: state.attachmentList, prev: prevMemo.attachments },
          { key: 'relations', current: state.relationList, prev: prevMemo.relations },
          { key: 'location', current: state.location, prev: prevMemo.location },
          { key: 'create_time', current: createTime, prev: prevMemo.createTime },
          { key: 'update_time', current: updateTime, prev: prevMemo.updateTime },
        ];

        for (const { key, current, prev } of updates) {
          if (!isEqual(current, prev)) {
            updateMask.add(key);
            (memoPatch as any)[key === 'create_time' ? 'createTime' : 
                              key === 'update_time' ? 'updateTime' : key] = current;
          }
        }

        if (["content", "attachments", "relations", "location"].some(key => updateMask.has(key))) {
          updateMask.add("update_time");
        }

        if (updateMask.size === 0) {
          toast.error(t("editor.no-changes-detected"));
          onCancel?.();
          return;
        }

        // Save memo
        savedMemo = await memoStore.updateMemo(memoPatch, Array.from(updateMask));

        // Queue notification (don't await to avoid blocking UI)
        if (parentMemoName) {
          const parentMemo = await memoStore.getOrFetchMemoByName(parentMemoName);
          if (parentMemo) {
            notificationPromise = sendCommentNotification(savedMemo, parentMemo, true);
          }
        } else if (state.memoVisibility === Visibility.PUBLIC) {
          notificationPromise = sendPublicMemoNotification(savedMemo, true);
        }

      } else {
        // CREATE MEMO
        if (!parentMemoName) {
          // Create new memo
          savedMemo = await memoStore.createMemo({
            memo: Memo.fromPartial({
              content,
              visibility: state.memoVisibility,
              attachments: state.attachmentList,
              relations: state.relationList,
              location: state.location,
            }),
            memoId: "",
            validateOnly: false,
            requestId: "",
          });

          // Queue notification for public memo
          if (state.memoVisibility === Visibility.PUBLIC) {
            notificationPromise = sendPublicMemoNotification(savedMemo, false);
          }
        } else {
          // Create comment - fetch parent memo in parallel
          const [parentMemo] = await Promise.all([
            memoStore.getOrFetchMemoByName(parentMemoName),
          ]);

          savedMemo = await memoServiceClient.createMemoComment({
            name: parentMemoName,
            comment: {
              content,
              visibility: state.memoVisibility,
              attachments: state.attachmentList,
              relations: state.relationList,
              location: state.location,
            },
          });

          // Queue comment notification
          if (parentMemo) {
            notificationPromise = sendCommentNotification(savedMemo, parentMemo);
          }
        }
      }

      // Clear editor and call success callback immediately
      editorRef.current?.setContent("");
      onConfirm?.(savedMemo.name);

      // Handle notification in background (don't block UI)
      if (notificationPromise) {
        notificationPromise.catch(error => {
          console.error("Notification failed:", error);
        });
      }

      const saveTime = performance.now() - saveStartTime.current;
      console.log(`Save completed in ${saveTime.toFixed(2)}ms`);

    } catch (error: any) {
      console.error(error);
      toast.error(error.details || "Failed to save memo");
    } finally {
      // Clean up state
      localStorage.removeItem(contentCacheKey);
      setState((state) => ({
        ...state,
        isRequesting: false,
        attachmentList: [],
        relationList: [],
        location: undefined,
        isDraggingFile: false,
      }));
    }
  };

  const handleCancelBtnClick = () => {
    localStorage.removeItem(contentCacheKey);
    onCancel?.();
  };

  const handleEditorFocus = () => {
    editorRef.current?.focus();
  };

  const editorConfig = useMemo(
    () => ({
      className: "",
      initialContent: "",
      placeholder: props.placeholder ?? t("editor.any-thoughts"),
      onContentChange: handleContentChange,
      onPaste: handlePasteEvent,
    }),
    [i18n.language],
  );

  const allowSave = (hasContent || state.attachmentList.length > 0) && !state.isUploadingAttachment && !state.isRequesting;

  return (
    <MemoEditorContext.Provider
      value={{
        attachmentList: state.attachmentList,
        relationList: state.relationList,
        setAttachmentList: (attachmentList: Attachment[]) => {
          setState((prevState) => ({
            ...prevState,
            attachmentList,
          }));
        },
        setRelationList: (relationList: MemoRelation[]) => {
          setState((prevState) => ({
            ...prevState,
            relationList,
          }));
        },
        memoName,
      }}
    >
      <div
        className={cn(
          "group relative w-full flex flex-col justify-start items-start bg-background px-4 pt-3 pb-2 rounded-lg border",
          state.isDraggingFile ? "border-dashed border-muted-foreground cursor-copy" : "border-border cursor-auto",
          className,
        )}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onDrop={handleDropEvent}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onFocus={handleEditorFocus}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
      >
        <Editor ref={editorRef} {...editorConfig} />
        <AttachmentListView attachmentList={state.attachmentList} setAttachmentList={handleSetAttachmentList} />
        <RelationListView relationList={referenceRelations} setRelationList={handleSetRelationList} />
        <div className="relative w-full flex flex-row justify-between items-center py-1 gap-2" onFocus={(e) => e.stopPropagation()}>
          <div className="flex flex-row justify-start items-center opacity-60 shrink-1">
            <TagSelector editorRef={editorRef} />
            <MarkdownMenu editorRef={editorRef} />
            <UploadAttachmentButton isUploading={state.isUploadingAttachment} />
            <AddMemoRelationPopover />
            <AIButton editorRef={editorRef} editorConfig={editorConfig}/>
            <LocationSelector
              location={state.location}
              onChange={(location) =>
                setState((prevState) => ({
                  ...prevState,
                  location,
                }))
              }
            />
          </div>
          <div className="shrink-0 flex flex-row justify-end items-center gap-1">
            {props.onCancel && (
              <Button variant="ghost" className="opacity-60" disabled={state.isRequesting} onClick={handleCancelBtnClick}>
                {t("common.cancel")}
              </Button>
            )}
            <Button color="primary" disabled={!allowSave || state.isRequesting} onClick={handleSaveBtnClick}>
              {t("editor.save")}
              {!state.isRequesting ? <SendIcon className="w-4 h-auto ml-1" /> : <LoaderIcon className="w-4 h-auto ml-1 animate-spin" />}
            </Button>
          </div>
        </div>
        <div
          className={cn(
            "absolute right-1 top-1",
            "flex flex-row justify-end items-center gap-1",
            "visible sm:invisible group-focus-within:visible group-hover:visible hover:visible focus-within:visible",
            (isVisibilitySelectorOpen || memoName) && "sm:visible",
          )}
          onFocus={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <VisibilitySelector
            value={state.memoVisibility}
            onChange={handleMemoVisibilityChange}
            onOpenChange={setIsVisibilitySelectorOpen}
          />
        </div>
      </div>

      {/* Show memo metadata if memoName is provided */}
      {memoName && (
        <div className="w-full -mt-1 mb-4 text-xs leading-5 px-4 opacity-60 font-mono text-muted-foreground">
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 items-center">
            {!isEqual(createTime, updateTime) && updateTime && (
              <>
                <span className="text-left">Updated</span>
                <DateTimeInput value={updateTime} onChange={setUpdateTime} />
              </>
            )}
            {createTime && (
              <>
                <span className="text-left">Created</span>
                <DateTimeInput value={createTime} onChange={setCreateTime} />
              </>
            )}
            <span className="text-left">ID</span>
            <span
              className="px-1 border border-transparent cursor-default"
              onClick={() => {
                copy(extractMemoIdFromName(memoName));
                toast.success(t("message.copied"));
              }}
            >
              {extractMemoIdFromName(memoName)}
            </span>
          </div>
        </div>
      )}
    </MemoEditorContext.Provider>
  );
});

export default MemoEditor;