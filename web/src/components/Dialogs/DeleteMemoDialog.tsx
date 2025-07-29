import { useTranslate } from "@/utils/i18n";
import { Button } from "../ui/button";
import { Dialog, DialogFooter, DialogHeader, DialogTitle, DialogContent, DialogTrigger } from "../ui/dialog";

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void,
    handleDeleteMemoClick: () => void
}
export default function DeleteMemoDialog(props: Props) {
    const {open, onOpenChange, handleDeleteMemoClick }=props
    const t =useTranslate()
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {t("common.confirm")}
                    </DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4">
                    <div className="text-sm">
                        {t("memo.delete-confirm")}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={()=>onOpenChange(false)}>
                        {t("common.cancel")}
                    </Button>
                    <Button onClick={handleDeleteMemoClick}>{t("common.delete")}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}