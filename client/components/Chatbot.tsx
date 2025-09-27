import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ from: "user" | "bot"; text: string }[]>([]);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = () => {
    if (!text.trim()) return;
    const content = text.trim();
    setMessages((m) => [...m, { from: "user", text: content }]);
    setText("");

    setTimeout(() => {
      // simple rule-based customer care responses
      const q = content.toLowerCase();
      let reply = "Sorry, I didn't understand that. You can ask about pricing, exporting, supported formats, or account help.";
      if (q.includes("price") || q.includes("pricing") || q.includes("cost")) {
        reply = "Pricing: We offer a free tier for evaluation and paid plans for teams. Visit the Billing section in settings or contact sales@acourse.io for details.";
      } else if (q.includes("export") || q.includes("download") || q.includes("pdf") || q.includes("ppt")) {
        reply = "Export: After generating, open Preview and use the Download button. For full PPT/PDF exports, connect a Pro plan to enable file generation.";
      } else if (q.includes("format") || q.includes("formats")) {
        reply = "Supported formats: PDF (print-ready), PPT (slide deck outline), Document (detailed write-up), Video (script & scenes).";
      } else if (q.includes("support") || q.includes("help") || q.includes("contact")) {
        reply = "Support: Email support@acourse.io or use the in-app chat. Response times are typically within 24 hours.";
      } else if (q.includes("language") || q.includes("tamil") || q.includes("english")) {
        reply = "Language support: We accept English voice input and can generate content in English.";
      } else if (q.includes("tutorial") || q.includes("how do i")) {
        reply = "Tutorial: Start by entering a topic, choose a format, generate the course, then preview and download. Use the chat for help anytime.";
      }

      setMessages((m) => [
        ...m,
        { from: "bot", text: reply },
      ]);
    }, 600);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="flex flex-col items-end">
        {open && (
          <div className="mb-3 w-80 rounded-xl bg-card/95 p-3 shadow-xl">
            <div className="flex h-56 flex-col gap-2 overflow-auto pb-2">
              {messages.length === 0 && (
                <div className="text-xs text-muted-foreground">Hi — ask me to help craft course outlines, prompts or video scripts.</div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${m.from === "user" ? "bg-primary text-primary-foreground" : "bg-white/5 text-muted-foreground"}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>

            <div className="mt-2 flex gap-2">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ask assistant..."
                className="h-9 rounded-md bg-secondary/60"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <Button type="button" onClick={send} className="h-9 px-3">
                Send
              </Button>
            </div>
          </div>
        )}

        <Button onClick={() => setOpen((v) => !v)} className="h-12 w-12 rounded-full p-0 text-lg leading-none">
          {open ? "×" : "💬"}
        </Button>
      </div>
    </div>
  );
}
