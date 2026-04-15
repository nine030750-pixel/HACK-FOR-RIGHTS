import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(".")); // ให้เสิร์ฟไฟล์ html/css/js จากโฟลเดอร์เดียวกัน

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/api/voice-assistant", async (req, res) => {
  try {
    const { transcript, history = [] } = req.body || {};

    if (!transcript || !String(transcript).trim()) {
      return res.status(400).json({ error: "Missing transcript" });
    }

    const systemPrompt = `
คุณคือผู้ช่วยเสียงภาษาไทยสำหรับแอป “สิทธิถึงบ้าน”
หน้าที่:
- ตอบเรื่องสิทธิผู้สูงอายุ เอกสารที่ต้องใช้ การนัดอาสาสมัคร และขั้นตอนพื้นฐาน
- ใช้ภาษาไทยง่าย ชัด อบอุ่น เหมาะกับผู้สูงอายุ
- ตอบสั้นก่อน 2-4 ประโยค
- ถ้าจำเป็น ค่อยสรุปเป็นข้อสั้น ๆ
- ถ้าผู้ใช้ถามไม่ชัด ให้ตอบจากบริบทที่เป็นไปได้มากที่สุดก่อน
- ห้ามแต่งข้อมูลกฎหมายหรือสิทธิแบบเฉพาะเจาะจงเกินจริง
- ถ้าไม่มั่นใจ ให้บอกว่า “ควรตรวจสอบกับ อบต. เทศบาล หรือหน่วยงานในพื้นที่อีกครั้ง”
`;

    const inputMessages = [
      {
        role: "system",
        content: systemPrompt,
      },
      ...history.slice(-6).map((item) => ({
        role: item.role === "assistant" ? "assistant" : "user",
        content: String(item.content || ""),
      })),
      {
        role: "user",
        content: String(transcript),
      },
    ];

    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: inputMessages,
    });

    const answer =
      response.output_text?.trim() ||
      "ขออภัย ระบบยังไม่สามารถตอบได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง";

    res.json({ answer });
  } catch (error) {
    console.error("voice-assistant error:", error);
    res.status(500).json({
      error: "AI request failed",
      message: "เกิดข้อผิดพลาดในการเชื่อมต่อ AI",
    });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
