import os
import pytesseract 
from PIL import Image, ImageEnhance
import io
import base64
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from openai import OpenAI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
import uvicorn 
# Removed: from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer 
# Removed: from reportlab.lib.styles import getSampleStyleSheet 
# Removed: from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT
import tempfile 
import requests 
from dotenv import load_dotenv

# --- SETUP: Load Environment Variables ---
load_dotenv()

# --- TESSERACT CONFIGURATION ---
TESSERACT_PATH = r"C:\Program Files\Tesseract-OCR\tesseract.exe" 
try:
    pytesseract.pytesseract.pytesseract_cmd = TESSERACT_PATH
except Exception:
    pass 

# ----------------------------
# Setup FastAPI app
# ----------------------------
app = FastAPI(title="AI Course Generator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:8080",
        "http://localhost:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------
# OpenRouter / LLM Client
# ----------------------------
# NOTE: Using the key provided in the last prompt's code block
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY", "Open_ai_api"),
)

# --- MODEL DEFINITIONS ---
GENERATION_MODEL = "google/gemini-2.5-flash"
# --------------------------------------------

# ----------------------------
# OCR Helper Functions
# ----------------------------

def preprocess_image(img): 
    """Applies image enhancement techniques (grayscale, contrast, binarization)."""
    img = img.convert('L') 
    enhancer = ImageEnhance.Contrast(img) 
    img = enhancer.enhance(2.5)  
    threshold = 180  
    img = img.point(lambda x: 0 if x < threshold else 255, '1') 
    return img 

def run_ocr_on_base64(base64_data):
    """Decodes base64, preprocesses, and runs Tesseract to extract text."""
    try:
        image_bytes = base64.b64decode(base64_data)
        image = Image.open(io.BytesIO(image_bytes))
        
        processed_img = preprocess_image(image)
        
        config_param = r'--oem 3 --psm 6' 
        text = pytesseract.image_to_string(processed_img, lang="eng", config=config_param)
        
        return {"success": True, "text": text.strip()}
        
    except pytesseract.TesseractNotFoundError:
        return {"success": False, "error": "Tesseract executable not found on server."}
    except Exception as e:
        return {"success": False, "error": f"OCR processing or image decoding failed: {e}"}


# ----------------------------
# File Creation Utility (Simplified)
# ----------------------------

def save_content_to_file(content: str, topic: str, file_extension: str) -> str:
    """
    Saves content to a temporary file with the specified extension.
    The content is saved as raw text.
    """
    try:
        # CRITICAL FIX: Ensure content is markdown-free before saving to text file
        content = content.replace('**', '').strip()

        # Generate a unique path in the system's temporary directory
        filename_prefix = f"{topic.replace(' ', '_')}_edited_"
        
        # Create a named temporary file
        with tempfile.NamedTemporaryFile(delete=False, prefix=filename_prefix, suffix=f".{file_extension}", mode="w", encoding="utf-8") as tmp:
            tmp.write(content)
            file_path = tmp.name
        
        return file_path
        
    except Exception as e:
        print(f"Error saving file: {e}")
        raise

# ----------------------------
# API Models
# ----------------------------

class ImagePayload(BaseModel):
    data: str
    mimeType: str

class CourseRequest(BaseModel):
    topic: str
    format: str
    lang: str = 'en'
    image: ImagePayload | None = None
    
class EditRequest(BaseModel):
    content: str 
    user_edit: str 
    format: str

class DownloadRequest(BaseModel): 
    topic: str
    content: str
    format: str 
    
# ----------------------------
# Generation Endpoints
# ----------------------------

@app.get("/")
def read_root():
    return {
        "message": "AI Course Generator API is running.", 
        "endpoint": "/api/generate",
        "status": "Ready to receive POST requests from the client on port 8080."
    }

@app.post("/api/generate")
def generate_course_content(req: CourseRequest):
    """
    Handles multimodal input: OCR (Tesseract), VLM (Gemini), and text generation.
    """
    topic = req.topic.strip()
    image_payload = req.image

    if not topic and not image_payload:
        raise HTTPException(status_code=400, detail="Missing topic or image input.")

    messages = []
    text_prompt = ""
    
    if image_payload and image_payload.data:
        ocr_result = run_ocr_on_base64(image_payload.data)
        
        if not ocr_result["success"]:
            raise HTTPException(status_code=500, detail=f"OCR setup failed: {ocr_result['error']}")

        ocr_text = ocr_result['text']
        if ocr_text:
            text_prompt += f"OCR Context (Source of Truth): {ocr_text}. "
        
        messages.append({
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{image_payload.mimeType};base64,{image_payload.data}"
                    }
                }
            ]
        })

    if topic:
        if topic.startswith("[Image uploaded:") and image_payload:
             text_prompt += "User submitted a query based on the image."
        else:
            text_prompt += f"User Topic/Request: '{topic}'. "
    
    # --- FINAL GENERATION SYSTEM INSTRUCTION ---
    system_instruction = (
        f"You are an **expert industrial curriculum designer**. Based on the entire input (OCR text and/or image data), "
        f"generate a complete Course Outline and a Weekly Syllabus tailored for a {req.format} format. "
        f"The content should be high-level, technical, and professional, suitable for an industrial audience. "
        f"The outline must be structured and clear. Start the response with 'Course Outline' and clearly separate the 'Syllabus' section."
    )
    # ---------------------------------------------------------------
    
    final_prompt = f"{system_instruction}\n\nInput Context: {text_prompt}"
    
    messages.append({
        "role": "user",
        "content": final_prompt
    })

    try:
        completion = client.chat.completions.create(
            model=GENERATION_MODEL,
            messages=messages,
            temperature=0.5,
            max_tokens=4096 
        )
        
        generated_content = completion.choices[0].message.content.strip()
        
        return JSONResponse({"generated": generated_content})

    except Exception as e:
        print(f"LLM API Error: {e}")
        error_detail = str(e)
        raise HTTPException(status_code=500, detail=f"AI generation failed: {error_detail}")

# NEW ENDPOINT: Assistant Edit
@app.post("/api/edit")
def edit_course_content(req: EditRequest):
    """
    Receives current content and user's edit request, sends to LLM for refinement/reformatting.
    """
    if not req.content or not req.user_edit:
        raise HTTPException(status_code=400, detail="Missing current content or edit request.")
    
    # --- FINAL, DETAILED SYSTEM INSTRUCTION for Editing/Reformatting ---
    
    format_guidance = ""
    
    # Setting specific formatting instructions based on the requested file type
    if req.format == "pdf":
        format_guidance = "For PDFs: ensure the text is concise and fits within a standard PDF page layout without overflowing. Prioritize formal, professional language. Use numbered lists or clear headers."
    elif req.format == "ppt":
        format_guidance = "For PowerPoint (.pptx): structure the content as slide-ready bullet points (using standard list markers like - or *), suitable for quick presentation slides."
    elif req.format == "document":
        format_guidance = "For Word documents (.docx): maintain detailed, readable paragraphs and structured sections suitable for a formal report."
    elif req.format == "video":
        format_guidance = "For video scripts: structure the content using short scenes or segment headings, using punchy, conversational language suitable for a video narrative."
        
    system_instruction = (
        "You are an **expert industrial curriculum editor**. Your task is to apply a user's requested edit "
        "to the provided course content. Your tone must be high-level, technical, and professional. "
        "You must return ONLY the revised, single block of text. "
        "The final output must maintain the structure (Course Outline and Syllabus headers) of the original content. "
        f"Additionally, format the revised text specifically for a **{req.format.upper()}** output type. {format_guidance} "
        "Always optimize the content so it is directly usable in the requested format."
    )
    # ------------------------------------------------------------------
    
    user_prompt = f"""
    --- ORIGINAL CONTENT (Format: {req.format.upper()}) ---
    {req.content}
    
    --- USER EDIT REQUEST ---
    {req.user_edit}
    
    --- REVISED CONTENT (ONLY RETURN THIS SINGLE BLOCK) ---
    """

    try:
        completion = client.chat.completions.create(
            model=GENERATION_MODEL,
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.4,
            max_tokens=4096 
        )
        
        revised_content = completion.choices[0].message.content.strip()
        
        return JSONResponse({"revised": revised_content})

    except Exception as e:
        print(f"LLM API Error during edit: {e}")
        raise HTTPException(status_code=500, detail=f"AI editing failed: {e}")

# FINAL DOWNLOAD ENDPOINT: Handles ALL File Downloads (Now using plain text for all)
@app.post("/api/download")
def download_content(req: DownloadRequest):
    """
    Generates file and serves the file for download as a plain text file 
    with a format-specific extension (.pdf, .docx, .pptx, .txt).
    """
    
    # Determine the file extension and MIME type based on the format ID
    ext_map = {
        'pdf': 'pdf',           # Now saves as text file with .pdf extension
        'ppt': 'pptx',          # Saves as text file with .pptx extension
        'document': 'docx',     # Saves as text file with .docx extension
        'video': 'txt',         # Standard text file for script
    }
    
    file_ext = ext_map.get(req.format, 'txt')
    media_type = "text/plain"

    # Save content as a text file (cleans markdown inside utility function)
    # The file content will be the raw text from the LLM, regardless of the extension.
    file_path = save_content_to_file(req.content, req.topic, file_ext)

    return FileResponse(
        file_path,
        filename=f"{req.topic.replace(' ', '_')}_edited.{file_ext}",
        media_type=media_type,
    )

# --- Legacy Endpoints ---

class CourseRequestLegacy(BaseModel):
    topic: str

@app.post("/generate-course")
def generate_course_outline_legacy(req: CourseRequestLegacy):
    raise HTTPException(status_code=410, detail="Endpoint moved. Use /api/generate.")

@app.post("/generate-course-pdf")
def generate_course_pdf_legacy(req: CourseRequestLegacy):
    raise HTTPException(status_code=410, detail="PDF generation endpoint is deprecated. Use /api/download.")

if __name__ == "__main__":
    import uvicorn
    # WARNING: Check your folder structure. Use "APP:app" if APP.py is in the root.
    uvicorn.run("APP:app", host="127.0.0.1", port=8000, reload=True)
