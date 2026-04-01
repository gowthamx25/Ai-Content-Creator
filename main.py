from fastapi import FastAPI
from pydantic import BaseModel
from openai import OpenAI
import json
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
import tempfile, os

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
# OpenRouter / OpenAI Client
# ----------------------------
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="++++++++++++++++++++++++++++++++++++++++++++++++++++++",
)

MODEL = "qwen/qwen-max:free"



# ----------------------------
# Helpers
# ----------------------------
def clean_json_text(text: str):
    if text.startswith("```"):
        text = text.strip("`").replace("json", "").strip()
    return text

def generate_course_outline(topic: str):
    prompt = f"""
Generate a clear, numbered course outline for "{topic}".
Return only a JSON object like this:

{{
  "lessons": [
    "Lesson 1 title",
    "Lesson 2 title",
    "Lesson 3 title"
  ]
}}
Do not include code fences or extra text.
"""
    completion = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
    )
    text = clean_json_text(completion.choices[0].message.content.strip())
    try:
        return json.loads(text)["lessons"]
    except:
        return [line.strip() for line in text.splitlines() if line.strip()]

def generate_lesson_content(lesson_title: str, topic: str):
    prompt = f"""
Write a structured, concise lesson for "{lesson_title}" in the course "{topic}".
Return JSON:

{{
  "content": "<text>",
  "key_points": ["..."],
  "examples": ["..."],
  "quiz": [{{"question": "?", "options": ["A","B"], "answer": "A"}}],
  "diagram_suggestion": "<diagram>"
}}
"""
    completion = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
    )
    text = clean_json_text(completion.choices[0].message.content.strip())
    try:
        return json.loads(text)
    except:
        return {"content": text, "key_points": [], "examples": [], "quiz": [], "diagram_suggestion": ""}


# ----------------------------
# API Models
# ----------------------------
class CourseRequest(BaseModel):
    topic: str


# ----------------------------
# Endpoints
# ----------------------------
@app.post("/generate-course")
def generate_course(req: CourseRequest):
    topic = req.topic.strip()
    lessons = generate_course_outline(topic)

    course = {"topic": topic, "lessons": []}
    for lesson in lessons:
        lesson_data = generate_lesson_content(lesson, topic)
        course["lessons"].append({
            "title": lesson,
            "content": lesson_data["content"],
            "key_points": lesson_data["key_points"],
            "examples": lesson_data["examples"],
            "quiz": lesson_data["quiz"],
            "diagram_suggestion": lesson_data["diagram_suggestion"]
        })

    return course


@app.post("/generate-course-pdf")
def generate_course_pdf(req: CourseRequest):
    topic = req.topic.strip()
    lessons = generate_course_outline(topic)

    course = {"topic": topic, "lessons": []}
    for lesson in lessons:
        lesson_data = generate_lesson_content(lesson, topic)
        course["lessons"].append({
            "title": lesson,
            "content": lesson_data["content"],
        })

    # Create PDF
    tmpfile = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    doc = SimpleDocTemplate(tmpfile.name)
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph(f"<b>Course: {topic}</b>", styles["Title"]))
    story.append(Spacer(1, 12))

    for i, lesson in enumerate(course["lessons"], 1):
        story.append(Paragraph(f"<b>{i}. {lesson['title']}</b>", styles["Heading2"]))
        story.append(Paragraph(lesson["content"], styles["BodyText"]))
        story.append(Spacer(1, 12))

    doc.build(story)

    return FileResponse(tmpfile.name, filename=f"{topic.replace(' ', '_')}.pdf", media_type="application/pdf")
