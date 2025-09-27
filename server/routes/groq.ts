import { RequestHandler } from "express";

export const handleGroqGenerate: RequestHandler = async (req, res) => {
  try {
    const { topic, format, lang } = req.body as { topic: string; format?: string; lang?: string };
    if (!topic) return res.status(400).json({ error: "Missing topic" });

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Server missing GROQ_API_KEY env variable" });

    // build prompt
    const prompt = `Design a complete course for the subject: ${topic}.\n\nInclude:\n1) A structured Course Outline (modules/units).\n2) A Weekly Syllabus with learning objectives.\n3) For each module, write detailed contents of about 400-500 words each, explaining concepts in depth (use points where helpful). Include mathematical concepts and formulas where relevant, explain them clearly.\n4) Suggested assessments, assignments, or projects.\n\nRespond in ${lang === "ta" ? "Tamil (தமிழ்) and English where appropriate" : "English"}.\n\nMake the output clear, well-organized, and professional.`;

    const body = {
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: "You are an expert academic course designer. Produce rich, structured output including outlines, syllabus and detailed module content with math explanations where relevant." },
        { role: "user", content: prompt },
      ],
      max_completion_tokens: 3000,
      temperature: 0.7,
    };

    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ error: text });
    }

    const data = await resp.json();
    // Attempt to extract assistant content similar to OpenAI response shape
    const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? JSON.stringify(data);

    return res.json({ generated: content });
  } catch (err: any) {
    console.error("/api/generate error:", err);
    return res.status(500).json({ error: err?.message ?? String(err) });
  }
};
