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

const dummySummary =
  "This memo discusses the quarterly financial results and outlines the next steps for the team.";

function useSelfWritingText(text: string, resetKey: string, delay = 40) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    let i = 0;
    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        setDisplayed((prev) => (text[i] ? prev + text[i] : prev));
        i++;
        if (i >= text.length) clearInterval(interval);
      }, delay);
    }, delay); // Introduce slight delay before starting

    return () => {
      clearTimeout(timeout);
      setDisplayed(""); // Clear on reset to prevent flashing full text
    };
  }, [text, resetKey, delay]);

  return displayed;
}

type Props = {
  memo?: Memo;
};

export default function MemoSummary({ memo }: Props) {
  const { sm } = useResponsiveWidth();  
  const [openKey, setOpenKey] = useState("");
  const summaryText = memo?.content ?? dummySummary;
  const summary = useSelfWritingText(summaryText, openKey);

  const handleOpenChange = (open: boolean) => {
    if (open) setOpenKey(Date.now().toString()); // Force re-animation
    console.log(memo)
  };

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="w-6 h-6">
          <Stars className="w-4 h-4 cursor-pointer text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={sm ? "end":"center"} sideOffset={sm ? 7: 6}>
        <DropdownMenuLabel
            className="w-full text-base text-foreground leading-tight font-medium opacity-80 truncate"
        >
            Memo summary
        </DropdownMenuLabel>
        <DropdownMenuItem>
            <p 
                className="block leading-tight text-wrap lg:max-w-4xl md:max-w-2xl sm:max-w-2xs max-sm:max-w-[80vw] hover:opacity-80 rounded-md transition-colors text-muted-foreground"
            >
                {summary}
            </p>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
