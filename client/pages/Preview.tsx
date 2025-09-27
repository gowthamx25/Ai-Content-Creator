import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import { X, Edit, Send } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const BACKEND_URL = "http://localhost:8000";

function parseGenerated(state: any) {
  const topic = state?.topic || new URLSearchParams(window.location.search).get("topic") || "Untitled";
  const format = (state?.format || new URLSearchParams(window.location.search).get("format") || "document").toLowerCase();
  const generated = state?.generated || {
    outline: `Course: ${topic}\n\n1. Introduction\n2. Core Concepts\n3. Hands-on Labs\n4. Assessment\n5. Resources`,
    syllabus: `Syllabus for ${topic}:\n\n- Module 1: Overview\n- Module 2: Deep Dive\n- Module 3: Case Studies\n- Module 4: Assessment & Next Steps`,
  };

  return { topic, format, generated };
}

export default function Preview() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { topic, format, generated: initialGenerated } = parseGenerated(state);
  
  // State initialization needs to include the full content to edit, which is not present 
  // in the provided minimal excerpt, so assuming a combined initial state for now.
  const [contentToEdit, setContentToEdit] = useState(
    initialGenerated.raw || (initialGenerated.outline + "\n\n" + initialGenerated.syllabus)
  );
  
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [editRequest, setEditRequest] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper to separate content for display
  const displayGenerated = (() => {
    const content = contentToEdit;
    const outlineStartPattern = /(^|[\n\r])(Course Outline:?[\s\S]*?)(^|[\n\r])(Syllabus:?|Weekly Syllabus:?)/im;
    const match = content.match(outlineStartPattern);
    let outline = content;
    let syllabus = "";
    if (match) {
        outline = match[2].trim();
        syllabus = content.substring(match.index + match[0].length).trim();
        syllabus = (match[4].trim() + "\n" + syllabus).trim();
    } else {
        const middle = Math.floor(content.length / 2);
        outline = content.substring(0, middle).trim();
        syllabus = content.substring(middle).trim();
    }
    return { outline, syllabus };
  })();

  const handleEditRequest = async () => {
    if (!editRequest.trim()) {
      setError("Please enter an edit request.");
      return;
    }
    setIsEditing(true);
    setError(null);

    try {
      const resp = await fetch(`${BACKEND_URL}/api/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: contentToEdit,
          user_edit: editRequest,
          format: format,
        }),
      });
      
      const rawText = await resp.text();
      let data: any;

      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch (e) {
        data = { raw: rawText };
      }

      if (!resp.ok) {
        const errMsg = (data.detail || data.error || rawText || 'Unknown editing error');
        throw new Error(errMsg);
      }

      const revisedContent: string = data.revised || rawText;
      
      setContentToEdit(revisedContent);
      setEditRequest("");
      setIsAssistantOpen(false);

    } catch (err: any) {
      console.error("AI Editing Failed:", err);
      setError(`Editing failed: ${err.message || String(err)}`);
    } finally {
      setIsEditing(false);
    }
  };


  /**
   * CORRECTED DOWNLOAD FUNCTION: Fetches the file stream (blob) from the backend.
   */
  const download = async () => {
    if (!contentToEdit || !format || !topic) return; 

    try {
      const response = await fetch(`${BACKEND_URL}/api/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: topic,
          content: contentToEdit, 
          format: format,
        }),
      });

      if (!response.ok) {
        // Handle error: Read JSON detail if available, otherwise default error.
        const errorData = await response.json().catch(() => ({ detail: 'Server returned a generic network error.' }));
        throw new Error(errorData.detail || 'Network response was not ok');
      }

      // Read the response as a Blob (the file content)
      const blob = await response.blob(); 
      
      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `${topic.replace(/\s+/g, "_")}_edited.bin`; // Fallback 
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch && filenameMatch.length > 1) {
          filename = filenameMatch[1].replace(/['"]/g, ''); 
        }
      }
      
      // Trigger the download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

    } catch (error: any) {
      console.error('Download failed:', error);
      alert(`Download failed: ${error.message}`);
    }
  };


  const renderPDF = () => (
    <div className="flex flex-col gap-6">
      <div className="mx-auto w-full max-w-3xl rounded-md bg-card p-6 shadow-lg">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div>
            <h1 className="text-2xl font-bold">{topic}</h1>
            <p className="text-sm text-muted-foreground">PDF • Professional print-ready layout (Downloaded as text file with .pdf extension)</p>
          </div>
          <div className="text-xs text-muted-foreground">Generated · {new Date().toLocaleDateString()}</div>
        </div>
        <div className="mt-4 space-y-4">
          <section>
            <h2 className="text-lg font-semibold">Course Outline</h2>
            <pre className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{displayGenerated.outline}</pre>
          </section>
          <section>
            <h2 className="text-lg font-semibold">Syllabus</h2>
            <pre className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{displayGenerated.syllabus}</pre>
          </section>
        </div>
      </div>
    </div>
  );

  const renderPPT = () => {
    const allContent = (displayGenerated.outline + "\n" + displayGenerated.syllabus);
    const lines = allContent.split('\n').filter(Boolean);
    
    const slides: string[] = [];
    let current = [] as string[];
    
    for (const l of lines) {
      const isStrongHeading = l.startsWith('**') && l.endsWith('**');
      const isNumberedHeading = /^\d+\./.test(l.trim());
      
      if ((isStrongHeading || isNumberedHeading) && current.length > 0) {
        slides.push(current.join('\n'));
        current = [l];
      } else {
        current.push(l);
      }
    }
    if (current.length) slides.push(current.join('\n'));

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{topic}</h1>
            <p className="text-sm text-muted-foreground">PPT • Slide deck preview (Downloaded as text file with .pptx extension)</p>
          </div>
          <div className="text-xs text-muted-foreground">Slides: {slides.length}</div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {slides.map((s, i) => (
            <div key={i} className="rounded-xl bg-card p-6 shadow-md">
              <div className="text-sm font-semibold">Slide {i + 1}</div>
              <div className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">
                {s.split('\n').map((line, idx) => (
                  <p key={idx} className={line.startsWith('**') ? 'font-bold mt-2' : ''}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDocument = () => (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">{topic}</h1>
        <p className="text-sm text-muted-foreground">Document • Detailed write-up (Downloaded as text file with .docx extension)</p>
      </div>

      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold">Content Preview (DOCX output)</h2>
          <pre className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
            {contentToEdit}
          </pre>
        </CardContent>
      </Card>
    </div>
  );

  const renderVideo = () => {
    const points = (displayGenerated.outline + "\n" + displayGenerated.syllabus).split('\n').filter(l => l.trim() && !l.startsWith('---'));
    const scenes = points.slice(0, 8);

    return (
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold">{topic}</h1>
          <p className="text-sm text-muted-foreground">Video • Script & scenes (Downloaded as text file with .txt extension)</p>
        </div>

        <div className="grid gap-4">
          {scenes.map((p, i) => (
            <div key={i} className="rounded-lg bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Scene {i + 1}</div>
                <div className="text-xs text-muted-foreground">00:{(i + 1) * 30}s</div>
              </div>
              <div className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{p.replace(/^\d+\.\s*/, '')}</div>
              <div className="mt-3 text-xs text-muted-foreground">Notes: Keep it conversational, add examples and a short CTA.</div>
            </div>
          ))}
        </div>

        <Card>
          <CardContent>
            <h3 className="text-lg font-medium">Shooting Notes</h3>
            <p className="mt-2 text-sm text-muted-foreground">Use short, focused takes. Show slides for key concepts and demonstrate practical tasks with screen recordings.</p>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background py-12">
      <section className="container">
        <div className="max-w-5xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold">Course Preview</h1>
              <p className="mt-1 text-sm text-muted-foreground">Preview for “{topic}” — format: {format.toUpperCase()}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setIsAssistantOpen(true)} className="bg-green-600 hover:bg-green-700">
                <Edit className="w-4 h-4 mr-2" /> Edit Content
              </Button>
              <Button onClick={() => navigate(-1)} variant="outline">Back</Button>
              <Button onClick={() => navigate('/create', { state: { topic, openFormats: true } })} variant="outline">Change format</Button>
              <Button onClick={download} className="bg-primary">Download</Button>
            </div>
          </div>

          <div className="mt-6">
            {format === "pdf" && renderPDF()}
            {format === "ppt" && renderPPT()}
            {format === "document" && renderDocument()}
            {format === "video" && renderVideo()}
            {!["pdf", "ppt", "document", "video"].includes(format) && (
              <div>
                <Card>
                  <CardContent>
                    <h2 className="text-xl font-semibold">Outline</h2>
                    <pre className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{displayGenerated.outline}</pre>
                  </CardContent>
                </Card>
              </div>
            )}

          </div>
        </div>
      </section>

      {/* Assistant Panel Modal */}
      {isAssistantOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-xl rounded-xl p-6 shadow-2xl bg-white dark:bg-gray-800">
            <div className="flex justify-between items-start">
              <h2 className="text-xl font-bold">Assistant Editor</h2>
              <Button variant="ghost" size="sm" onClick={() => setIsAssistantOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter your request (e.g., "Make the introduction more detailed," or "Change the tone to be formal").
              </p>
              
              <Textarea
                value={editRequest}
                onChange={(e) => setEditRequest(e.target.value)}
                placeholder="Ask the AI to refine the content..."
                rows={4}
                disabled={isEditing}
              />

              {error && (
                <p className="text-xs text-red-500">Error: {error}</p>
              )}

              <div className="flex justify-end">
                <Button 
                  onClick={handleEditRequest} 
                  disabled={!editRequest.trim() || isEditing}
                  className="bg-primary hover:bg-primary/90"
                >
                  {isEditing ? (
                    <>
                      <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">...</svg>
                      Applying Edit...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" /> Submit Edit
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}