import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import Chatbot from "@/components/Chatbot";
import { useNavigate, useLocation } from "react-router-dom";
import { Upload, X } from "lucide-react"; 

const formats = [
  { id: "pdf", label: "PDF", desc: "Ready-to-share file" },
  { id: "ppt", label: "PPT", desc: "Slide deck outline" },
  { id: "document", label: "Document", desc: "Detailed write-up" },
  { id: "video", label: "Video", desc: "Script + scenes" },
] as const;

type FormatId = typeof formats[number]["id"];

const BACKEND_URL = "http://localhost:8000"; 

export default function Create() {
  const [topic, setTopic] = useState("");
  const [selected, setSelected] = useState<FormatId | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"input" | "formats" | "result">("input");
  const [generated, setGenerated] = useState<{ outline: string; syllabus: string; raw?: string } | null>(null);
  const navigate = useNavigate();

  // Image state and ref
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice recognition state
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const location = useLocation();

  useEffect(() => {
    const win: any = window as any;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setTopic((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
  }, []);

  // react to incoming state (e.g., coming back from preview to change format)
  useEffect(() => {
    const s: any = location.state;
    if (!s) return;
    if (s.topic) setTopic(s.topic);
    if (s.format) setSelected(s.format);
    if (s.openFormats) setStep("formats");
  }, [location.state]);

  const toggleListen = () => {
    const rec = recognitionRef.current;
    if (!rec) return console.error("Voice recognition not supported in this browser.");
    if (!listening) {
      setListening(true);
      try {
        rec.lang = 'en-US';
      } catch (e) {
        // ignore
      }
      rec.start();
    } else {
      rec.stop();
      setListening(false);
    }
  };

  // Handler to read the file input
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setImageFile(file);
    // Set placeholder text in input field if an image is uploaded and text is empty
    if (file && !topic.trim()) {
        setTopic(`[Image uploaded: ${file.name}]`);
    }
  };
  
  // Clear the image file and reset the input value
  const handleImageDelete = () => {
      setImageFile(null);
      if (fileInputRef.current) {
          fileInputRef.current.value = ''; // Reset file input element
      }
      // Clear placeholder topic if it was set automatically
      if (topic.startsWith("[Image uploaded:")) {
          setTopic("");
      }
  };

  const onGenerate = (e?: React.FormEvent) => {
    e?.preventDefault();
    // Allow generation if there's a topic OR an image
    if (!topic.trim() && !imageFile) return;
    setStep("formats");
  };

  // Function to convert the file to a base64 string
  const fileToBase64 = useCallback((file: File | null): Promise<{ data: string, mimeType: string } | null> => {
    return new Promise((resolve) => {
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => {
        // The base64 string needs to exclude the MIME type prefix (e.g., "data:image/png;base64,")
        const base64String = reader.result?.toString().split(',')[1] || '';
        resolve({ data: base64String, mimeType: file.type });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }, []);

  const selectFormat = (id: FormatId) => {
    setSelected(id);
    setLoading(true);
    
    // Start generation process
    (async () => {
      try {
        setLoading(true);
        
        // Convert image file to Base64
        const imageBase64 = await fileToBase64(imageFile);
        
        // If an image is attached, send the 'topic' as is.
        const finalTopic = (imageFile && topic.trim()) ? topic : topic.trim();

        const resp = await fetch(`${BACKEND_URL}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            // Send the topic string as is, which the backend should handle.
            topic: finalTopic, 
            format: id, 
            lang: 'en',
            image: imageBase64 
          }),
        });
        
        // read response text
        const rawText = await resp.text();
        let data: any;
        try {
          data = rawText ? JSON.parse(rawText) : {};
        } catch (e) {
          data = { raw: rawText };
        }
        if (!resp.ok) {
          console.error('Generation error', data);
          setLoading(false);
          // Catch 'detail' from FastAPI 404/500 errors
          const errMsg = (data && (data.detail || data.message || data.error)) || rawText || 'Unknown';
          setGenerated({ outline: `Error generating content: ${errMsg}`, syllabus: '' });
          setStep('result');
          return;
        }
        const content: string = (data && data.generated) || rawText || '';
        // heuristically split content into outline and syllabus if possible
        const outlineMatch = content.match(/(Course Outline[:\n\r\s]*[\s\S]*?)(?:Syllabus|Weekly Syllabus|Syllabus[:\n\r])/i);
        const outline = outlineMatch ? outlineMatch[1].trim() : content.slice(0, 400);
        const syllabusMatch = content.match(/(Syllabus[:\n\r\s]*[\s\S]*?)(?:\n\n|$)/i);
        const syllabus = syllabusMatch ? syllabusMatch[0].trim() : '';
        const gen = { outline, syllabus, raw: content };
        setGenerated(gen);
        setLoading(false);
        
        // Pass all data including image details for potential preview display/reference
        navigate(`/preview?topic=${encodeURIComponent(topic)}&format=${encodeURIComponent(id)}`, { state: { topic, format: id, generated: gen, image: imageBase64 } });
      } catch (err) {
        console.error(err);
        setLoading(false);
        setGenerated({ outline: `Error: ${String(err)}`, syllabus: '' });
        setStep('result');
      }
    })();
  };

  // NOTE: The download function is primarily handled on the Preview page.
  // The original implementation here was flawed for the backend design.
  // I am removing the flawed download function from Create.tsx to enforce the correct flow: 
  // Generate -> Preview -> Download.

  
  // Determine if the Generate button should be disabled
  const isGenerateDisabled = !topic.trim() && !imageFile;

  // Display the topic, or the image name if only an image is present
  const displayTopic = imageFile && !topic.trim() && topic.startsWith("[Image uploaded:") ? `Image attached: ${imageFile.name}` : topic;

  return (
    <main className="brand-gradient min-h-[calc(100vh-4rem)] bg-background relative">
      <section className="container grid gap-10 py-12 sm:py-16">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Create a course in minutes</h1>
          <p className="mt-3 text-muted-foreground">Type a topic, or use voice/image input. We draft materials instantly — keeping you in control.</p>
        </div>

        {step === "input" && (
          <form onSubmit={onGenerate} className="grid gap-6">
            <div className="grid w-full gap-3 sm:grid-cols-[1fr_auto_auto] items-center">
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Enter a topic to get the content (e.g., Quantum Computing)"
                className="h-12 rounded-lg bg-secondary/70 text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
              />
              
              {imageFile && (
                  <p className="col-span-full text-xs text-muted-foreground">
                      Image attached: {imageFile.name} ({Math.round(imageFile.size / 1024)} KB). 
                      <button type="button" onClick={handleImageDelete} className="ml-1 underline text-red-400 font-semibold flex-shrink-0">
                          <X className="w-3 h-3 inline-block align-text-top mr-1"/> Delete
                      </button>
                  </p>
              )}


              <div className="flex items-center gap-2">
                {/* VOICE INPUT BUTTON */}
                <Button type="button" onClick={toggleListen} className={`h-12 w-12 rounded-lg ${listening ? "bg-primary text-primary-foreground" : "bg-white/5"}`}>
                  {listening ? "🎙️" : "🎤"}
                </Button>

                {/* IMAGE INPUT BUTTON */}
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <Button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()} 
                  className={`h-12 w-12 rounded-lg relative ${imageFile ? "bg-primary text-primary-foreground" : "bg-white/5"}`}
                  title={imageFile ? `Image: ${imageFile.name}` : "Upload image"}
                >
                  <Upload className="h-5 w-5" />
                  {imageFile && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-green-500 text-[8px] text-white">✓</span>
                  )}
                </Button>

                {/* GENERATE BUTTON */}
                <Button type="submit" className="h-12 rounded-lg bg-primary px-6 text-primary-foreground hover:bg-primary/90" disabled={isGenerateDisabled || loading}>
                  {loading ? 'Generating...' : 'Generate'}
                </Button>
              </div>
            </div>
          </form>
        )}

        {step === "formats" && (
          <div className="grid gap-6">
            {loading && (
              <div className="flex items-center space-x-2 text-primary">
                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing content...
              </div>
            )}
            
            <div className="mt-2">
              <p className="mb-3 text-sm uppercase tracking-wider text-muted-foreground">Choose format</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {formats.map((f) => (
                  <button key={f.id} type="button" onClick={() => selectFormat(f.id)} className="text-left" disabled={loading}>
                    <Card className={cn("glass group relative h-28 w-full overflow-hidden rounded-xl transition duration-200 hover:ring-1 hover:ring-white/20", loading && "opacity-50 cursor-not-allowed")}>
                      <CardContent className="flex h-full flex-col items-start justify-between p-4">
                        <span className="inline-flex rounded-md px-2 py-1 text-xs font-semibold bg-white/10">{f.label}</span>
                        <span className="line-clamp-1 text-xs text-muted-foreground">{f.desc}</span>
                      </CardContent>
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    </Card>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setStep("input")} variant="outline" disabled={loading}>Back</Button>
            </div>
          </div>
        )}

        {step === "result" && generated && (
          <div className="grid gap-6">
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">Draft Outline</h2>
              <Card className="p-4">
                <CardContent>
                  <pre className="whitespace-pre-wrap text-sm text-muted-foreground">{generated.outline}</pre>
                </CardContent>
              </Card>

              <h3 className="text-lg font-medium">Syllabus</h3>
              <Card className="p-4">
                <CardContent>
                  <pre className="whitespace-pre-wrap text-sm text-muted-foreground">{generated.syllabus}</pre>
                </CardContent>
              </Card>

              <div className="flex items-center gap-3">
                {/* Download button removed from Create.tsx - use Preview page */}
                <Button variant="outline" onClick={() => setStep("formats")}>Change format</Button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-4 text-sm text-muted-foreground sm:max-w-3xl">
          <p>• Multi-language ready — reuse in any language.</p>
          <p>• Clear learning paths — beginner to advanced.</p>
          <p>• Export to PDF, PPT, documents, or video scripts.</p>
        </div>
      </section>

      <Chatbot />
    </main>
  );
}

function FormatCard({
  label,
  desc,
  active,
  onClick,
}: {
  label: string;
  desc: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card
        className={cn(
          "glass group relative h-28 w-full overflow-hidden rounded-xl transition duration-200",
          active ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-white/20",
        )}
      >
        <CardContent className="flex h-full flex-col items-start justify-between p-4">
          <span
            className={cn(
              "inline-flex rounded-md px-2 py-1 text-xs font-semibold",
              active ? "bg-primary text-primary-foreground" : "bg-white/10",
            )}
          >
            {label}
          </span>
          <span className="line-clamp-1 text-xs text-muted-foreground">{desc}</span>
        </CardContent>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
      </Card>
    </button>
  );
}