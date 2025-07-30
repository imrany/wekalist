import { useEffect, useState } from "react";

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

export default useSelfWritingText;