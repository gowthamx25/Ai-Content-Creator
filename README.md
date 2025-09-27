# Ai-Content-Creator
AI Course Generator with Multimodal Input
The AI Course Generator is a FastAPI-powered backend application that generates structured course content (Course Outline + Weekly Syllabus) in multiple output formats — PDF, Word Document, PowerPoint, and Video Script.

The system integrates OCR (Optical Character Recognition), LLM-based text generation, and file export capabilities into a single workflow, making it possible to generate and refine curriculum content from text, images, or voice inputs.

🔑 Key Features

📷 Image-to-Text (OCR):
Uses Tesseract OCR with preprocessing (contrast, binarization) to extract high-quality text from uploaded images.

🤖 AI-Powered Content Generation:
Leverages Google Gemini (via OpenRouter) to generate course outlines and syllabi tailored to a chosen format.

✍️ User-Guided Edits:
Provides an /api/edit endpoint that allows users to request modifications to the generated content (e.g., expand, shorten, reformat).

📂 Multiple Export Formats:
Supports direct file download in:

PDF (via ReportLab)

Word DOCX (via python-docx)

PowerPoint PPTX (via python-pptx, Gamma AI–style slides)

Plain Text TXT

🌐 Frontend Integration Ready:
With CORS enabled, it can connect seamlessly to a React frontend for user interaction.

⚡ Single-Line Output Pipeline:
Regardless of input type (image, text, or voice transcription), the system produces clean, structured text as a single output, ensuring consistency for downstream phases.

🛠️ Tech Stack

Backend: FastAPI (Python)

AI/LLM: Google Gemini 2.5 Flash (via OpenRouter API)

OCR: Tesseract + Pillow (image preprocessing)

File Generation: ReportLab, python-docx, python-pptx

Deployment: Uvicorn (local or server hosting)
