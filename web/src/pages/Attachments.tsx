import dayjs from "dayjs";
import { includes } from "lodash-es";
import { PaperclipIcon, SearchIcon, TrashIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import AttachmentIcon from "@/components/AttachmentIcon";
import Empty from "@/components/Empty";
import MobileHeader from "@/components/MobileHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { attachmentServiceClient } from "@/grpcweb";
import useLoading from "@/hooks/useLoading";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";
import i18n from "@/i18n";
import { memoStore } from "@/store";
import { Attachment } from "@/types/proto/api/v1/attachment_service";
import { useTranslate } from "@/utils/i18n";
import DialogBox, { DialogType } from "@/components/Dialogs/DialogBox";

function groupAttachmentsByDate(attachments: Attachment[]) {
  const grouped = new Map<string, Attachment[]>();
  attachments
    .sort((a, b) => dayjs(b.createTime).unix() - dayjs(a.createTime).unix())
    .forEach((item) => {
      const monthStr = dayjs(item.createTime).format("YYYY-MM");
      if (!grouped.has(monthStr)) {
        grouped.set(monthStr, []);
      }
      grouped.get(monthStr)?.push(item);
    });
  return grouped;
}

interface State {
  searchQuery: string;
}

const Attachments = observer(() => {
  const [open, setOpen] = useState(false);
  const [dialogType, setDialogType] = useState<DialogType | null>(null);
  const t = useTranslate();
  const { md } = useResponsiveWidth();
  const loadingState = useLoading();
  const [state, setState] = useState<State>({ searchQuery: "" });
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const filteredAttachments = attachments.filter((attachment) =>
    includes(attachment.filename.toLowerCase(), state.searchQuery.toLowerCase())
  );

  const groupedAttachments = groupAttachmentsByDate(
    filteredAttachments.filter((attachment) => attachment.memo)
  );

  const unusedAttachments = filteredAttachments.filter((attachment) => !attachment.memo);

  useEffect(() => {
    attachmentServiceClient.listAttachments({}).then(({ attachments }) => {
      setAttachments(attachments);
      loadingState.setFinish();
      Promise.all(
        attachments.map((attachment) =>
          attachment.memo ? memoStore.getOrFetchMemoByName(attachment.memo) : null
        )
      );
    });
  }, []);

  const handleDeleteUnusedAttachments = async () => {
    for (const attachment of unusedAttachments) {
      await attachmentServiceClient.deleteAttachment({ name: attachment.name });
    }
    setAttachments(attachments.filter((attachment) => attachment.memo));
  };

  const onOpenChange = (state: boolean) => {
    setOpen(state);
    if (!state) setDialogType(null);
  };

  const handleOpenConfirmationDialog = (type: DialogType) => {
    setDialogType(type);
    setOpen(true);
  };

  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
      {!md && <MobileHeader />}
      <div className="w-full px-4 sm:px-6">
        <div className="w-full border border-border flex flex-col px-4 py-3 rounded-xl bg-background text-foreground">
          <div className="relative w-full flex justify-between items-center">
            <p className="py-1 flex items-center opacity-80">
              <PaperclipIcon className="w-6 h-auto mr-1 opacity-80" />
              <span className="text-lg">{t("common.attachments")}</span>
            </p>
            <div className="relative max-w-32">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={t("common.search")}
                value={state.searchQuery}
                onChange={(e) => setState({ ...state, searchQuery: e.target.value })}
              />
            </div>
          </div>

          <div className="w-full flex flex-col mt-4 mb-6">
            {loadingState.isLoading ? (
              <div className="w-full h-32 flex justify-center items-center">
                <p className="text-center text-base my-6 mt-8">{t("resource.fetching-data")}</p>
              </div>
            ) : filteredAttachments.length === 0 ? (
              <div className="w-full mt-8 mb-8 flex flex-col justify-center items-center italic">
                <Empty />
                <p className="mt-4 text-muted-foreground">{t("message.no-data")}</p>
              </div>
            ) : (
              <div className="w-full px-2 flex flex-col gap-y-8">
                {Array.from(groupedAttachments.entries()).map(([monthStr, attachments]) => (
                  <div key={monthStr} className="flex">
                    <div className="w-16 sm:w-24 pt-4 sm:pl-4 flex flex-col">
                      <span className="text-sm opacity-60">{dayjs(monthStr).year()}</span>
                      <span className="font-medium text-xl">
                        {dayjs(monthStr).toDate().toLocaleString(i18n.language, { month: "short" })}
                      </span>
                    </div>
                    <div className="w-full max-w-[calc(100%-4rem)] sm:max-w-[calc(100%-6rem)] flex flex-wrap gap-4">
                      {attachments.map((attachment) => (
                        <div key={attachment.name} className="w-24 sm:w-32 flex flex-col">
                          <div className="w-24 h-24 sm:w-32 sm:h-32 border border-border rounded-xl cursor-pointer hover:shadow hover:opacity-80 flex justify-center items-center overflow-clip">
                            <AttachmentIcon attachment={attachment} strokeWidth={0.5} />
                          </div>
                          <div className="mt-1 px-1">
                            <p className="text-xs text-muted-foreground truncate">{attachment.filename}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {unusedAttachments.length > 0 && (
                  <>
                    <Separator />
                    <div className="flex">
                      <div className="w-16 sm:w-24 sm:pl-4" />
                      <div className="w-full max-w-[calc(100%-4rem)] sm:max-w-[calc(100%-6rem)] flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{t("resource.unused-resources")}</span>
                          <span className="text-muted-foreground opacity-80">({unusedAttachments.length})</span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleOpenConfirmationDialog(DialogType.DELETE_UNUSED_ATTACHMENTS)
                                  }
                                >
                                  <TrashIcon className="w-4 h-auto opacity-60" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Delete all</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className="flex flex-wrap gap-4">
                          {unusedAttachments.map((attachment) => (
                            <div key={attachment.name} className="w-24 sm:w-32 flex flex-col">
                              <div className="w-24 h-24 sm:w-32 sm:h-32 border border-border rounded-xl cursor-pointer hover:shadow hover:opacity-80 flex justify-center items-center overflow-clip">
                                <AttachmentIcon attachment={attachment} strokeWidth={0.5} />
                              </div>
                              <div className="mt-1 px-1">
                                <p className="text-xs text-muted-foreground truncate">{attachment.filename}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {dialogType && (
        <DialogBox
          dialogType={dialogType}
          open={open}
          onOpenChange={onOpenChange}
          actionButtonFunction={handleDeleteUnusedAttachments}
        />
      )}
    </section>
  );
});

export default Attachments;
