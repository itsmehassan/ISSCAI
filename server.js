import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();
console.log("Gemini key loaded:", !!process.env.GEMINI_API_KEY);
console.log("Gemini model:", process.env.GEMINI_MODEL);
console.log("Grok key loaded:", !!process.env.GROK_API_KEY);
console.log("Grok model:", process.env.GROK_MODEL);
console.log("Groq key loaded:", !!process.env.GROQ_API_KEY);
console.log("Groq model:", process.env.GROQ_MODEL);

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 5000;
const isDevelopment = process.env.NODE_ENV !== "production";
const GEMINI_TRY_MODELS = Array.from(
  new Set(
    [
      process.env.GEMINI_MODEL,
      "gemini-2.0-flash"
    ].filter(Boolean)
  )
);
const GROK_TRY_MODELS = Array.from(
  new Set([process.env.GROK_MODEL || "grok-2-latest", "grok-beta"].filter(Boolean))
);
const GROQ_TRY_MODELS = Array.from(
  new Set(
    [
      process.env.GROQ_MODEL,
      "llama-3.1-8b-instant",
      "llama-3.3-70b-versatile"
    ].filter(Boolean)
  )
);

const complaintRules = [
  {
    intent: "Fraud / Unauthorized Access",
    category: "Fraud / Transfer Issue",
    keywords: ["unauthorized", "fraud", "hacked", "double transfer", "amount not received"],
    department: "Account Services / Operations",
    priority: "High",
    sla: "2-4 hours"
  },
  {
    intent: "Card Services",
    category: "Card Issue",
    keywords: ["card", "atm", "limit", "block", "unblock", "ecommerce", "international"],
    department: "Card Operations",
    priority: "Medium",
    sla: "8-24 hours"
  },
  {
    intent: "Payments",
    category: "Payment Issue",
    keywords: ["bill payment", "reversal", "timeout", "otp not received", "otp", "online payment"],
    department: "Payments Team",
    priority: "High",
    sla: "4-8 hours"
  },
  {
    intent: "Account Services",
    category: "Account Query",
    keywords: ["account", "statement", "dormancy", "raast", "opening", "closing"],
    department: "Account Services",
    priority: "Medium",
    sla: "24 hours"
  }
];

const systemPrompt = `
You are ISSCAI, an AI Banking Complaint Assistant.
You help customers register banking complaints.
You support:
English, Roman Urdu, Urdu, Arabic, Hindi, French, Spanish, German, Turkish, Chinese, Indonesian, Malay, Bengali, Persian.

Rules:
- Be realistic and professional like a bank complaint agent.
- Ask short useful follow-up questions.
- Never ask for OTP code, PIN, password, full card number, CVV, or full account password.
- For fraud or unauthorized access, advise immediate blocking and escalation.
- If user is guest/non-banking customer, collect only limited info.
- Always return valid JSON only.
- No markdown in JSON response.

Expected JSON response:
{
  "botReply": "",
  "detectedIntent": "",
  "category": "",
  "priority": "",
  "sentiment": "",
  "validityRisk": "",
  "department": "",
  "sla": "",
  "evidenceChecklist": [],
  "followUpQuestions": [],
  "missingInformation": [],
  "complaintQualityScore": 0,
  "agentNextBestAction": "",
  "englishSummary": "",
  "customerReplies": {
    "formal": "",
    "empathetic": "",
    "whatsapp": ""
  }
}
`;

const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    botReply: { type: "STRING" },
    detectedIntent: { type: "STRING" },
    category: { type: "STRING" },
    priority: { type: "STRING" },
    sentiment: { type: "STRING" },
    validityRisk: { type: "STRING" },
    department: { type: "STRING" },
    sla: { type: "STRING" },
    evidenceChecklist: { type: "ARRAY", items: { type: "STRING" } },
    followUpQuestions: { type: "ARRAY", items: { type: "STRING" } },
    missingInformation: { type: "ARRAY", items: { type: "STRING" } },
    complaintQualityScore: { type: "NUMBER" },
    agentNextBestAction: { type: "STRING" },
    englishSummary: { type: "STRING" },
    customerReplies: {
      type: "OBJECT",
      properties: {
        formal: { type: "STRING" },
        empathetic: { type: "STRING" },
        whatsapp: { type: "STRING" }
      },
      required: ["formal", "empathetic", "whatsapp"]
    }
  },
  required: [
    "botReply",
    "detectedIntent",
    "category",
    "priority",
    "sentiment",
    "validityRisk",
    "department",
    "sla",
    "evidenceChecklist",
    "followUpQuestions",
    "missingInformation",
    "complaintQualityScore",
    "agentNextBestAction",
    "englishSummary",
    "customerReplies"
  ]
};

const safeJsonParse = (rawText) => {
  if (!rawText) return null;
  const cleaned = rawText
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      return null;
    }
  }
};

const normalizeAiPayload = (parsed) => {
  const rawScore = Number(parsed?.complaintQualityScore);
  const normalizedScore = Number.isFinite(rawScore)
    ? Math.max(0, Math.min(100, rawScore <= 1 ? rawScore * 100 : rawScore))
    : 0;

  return {
  botReply: parsed?.botReply || "",
  detectedIntent: parsed?.detectedIntent || "",
  category: parsed?.category || "",
  priority: parsed?.priority || "",
  sentiment: parsed?.sentiment || "",
  validityRisk: parsed?.validityRisk || "",
  department: parsed?.department || "",
  sla: parsed?.sla || "",
  evidenceChecklist: Array.isArray(parsed?.evidenceChecklist) ? parsed.evidenceChecklist : [],
  followUpQuestions: Array.isArray(parsed?.followUpQuestions) ? parsed.followUpQuestions : [],
  missingInformation: Array.isArray(parsed?.missingInformation) ? parsed.missingInformation : [],
  complaintQualityScore: normalizedScore,
  agentNextBestAction: parsed?.agentNextBestAction || "",
  englishSummary: parsed?.englishSummary || "",
  customerReplies: {
    formal: parsed?.customerReplies?.formal || "",
    empathetic: parsed?.customerReplies?.empathetic || "",
    whatsapp: parsed?.customerReplies?.whatsapp || ""
  }
};
};

const detectComplaintIntent = (message = "") => {
  const text = message.toLowerCase();
  const rule = complaintRules.find((item) =>
    item.keywords.some((keyword) => text.includes(keyword))
  );
  if (rule) return rule;
  return {
    intent: "General Banking Complaint",
    category: "General Banking Complaint",
    department: "Customer Care Desk",
    priority: "Low",
    sla: "24-48 hours"
  };
};

const detectSentiment = (message = "") => {
  const text = message.toLowerCase();
  if (/(angry|frustrated|urgent|disappointed|bad|worst)/.test(text)) return "Negative";
  if (/(thanks|resolved|good|appreciate)/.test(text)) return "Positive";
  return "Neutral";
};

const calculateValidityRisk = (message = "", intent = {}) => {
  const text = message.toLowerCase();
  if (intent.priority === "High") return "High";
  if (text.length < 20) return "Medium";
  return "Low";
};

const calculateComplaintQuality = (message = "") => {
  const text = message.trim();
  if (!text) return 0;
  let score = 30;
  if (text.length > 40) score += 20;
  if (/\d/.test(text)) score += 10;
  if (/date|time|amount|transaction|account|card|otp/i.test(text)) score += 20;
  if (text.length > 120) score += 20;
  return Math.min(score, 100);
};

const detectDuplicateComplaint = (message, customer, existingComplaints = []) => {
  if (!customer?.contact) return null;
  const rule = detectComplaintIntent(message);
  const duplicate = existingComplaints.find(
    (item) =>
      item.contact === customer.contact &&
      item.category === rule.category &&
      item.status !== "Resolved"
  );
  return duplicate ? `Similar complaint already exists: Ticket ${duplicate.ticketId}` : null;
};

const generateFallbackReply = ({
  message,
  customer,
  language,
  isGuestUser,
  existingComplaints
}) => {
  const intent = detectComplaintIntent(message);
  const sentiment = detectSentiment(message);
  const validityRisk = calculateValidityRisk(message, intent);
  const complaintQualityScore = calculateComplaintQuality(message);
  const duplicateWarning = detectDuplicateComplaint(message, customer, existingComplaints);

  const baseChecklist = [
    "Transaction date and time",
    "Approximate amount",
    "Channel used (ATM/App/Branch/Web)",
    "Last 4 digits of card/account reference",
    "Any screenshot or error text"
  ];

  const missingInformation = [];
  if (!/\d/.test(message)) missingInformation.push("Transaction amount or reference");
  if (!/date|today|yesterday|am|pm/i.test(message)) {
    missingInformation.push("Exact date/time of incident");
  }

  return {
    botReply:
      intent.priority === "High"
        ? "We understand this is urgent. Your complaint is marked high priority and is being escalated immediately."
        : "Thank you for the details. Your complaint is registered and assigned to the relevant team.",
    detectedIntent: intent.intent,
    category: intent.category,
    priority: intent.priority,
    sentiment,
    validityRisk,
    department: intent.department,
    sla: intent.sla,
    evidenceChecklist: baseChecklist,
    followUpQuestions: [
      "Please share transaction date/time.",
      "Please share any reference number or screenshot."
    ],
    missingInformation,
    complaintQualityScore,
    agentNextBestAction:
      intent.priority === "High"
        ? "Escalate immediately and trigger temporary security hold advisory."
        : "Collect remaining evidence and assign to department queue.",
    englishSummary: `Customer reports ${intent.category.toLowerCase()} via ${
      customer?.channel || "unknown channel"
    }. Priority ${intent.priority}.`,
    customerReplies: {
      formal:
        "Dear Customer, we acknowledge your complaint and have routed it to the concerned department for immediate review.",
      empathetic:
        "We are sorry for the inconvenience. Our team is actively reviewing your case and will update you soon.",
      whatsapp:
        "Complaint registered. Team assigned. We will update you shortly."
    },
    aiSource: "fallback",
    fallbackNotice: "Live AI unavailable, offline AI engine used.",
    duplicateWarning,
    language: language || "English",
    isGuestUser: Boolean(isGuestUser)
  };
};

const withDevDebug = (payload, debugFields) =>
  isDevelopment ? { ...payload, ...debugFields } : payload;

const buildModelPrompt = ({ message, language, customer, isGuestUser, existingComplaints }) => `
${systemPrompt}

Critical output instruction:
- Return exactly one compact JSON object.
- Do not use markdown.
- Do not add explanation text before or after JSON.
- Keep botReply concise (max 2 short sentences).

Customer Context:
${JSON.stringify({ language, customer, isGuestUser })}

Existing Complaints:
${JSON.stringify(existingComplaints || [])}

Customer Message:
${message}
`;

const tryGemini = async ({
  message,
  language,
  customer,
  isGuestUser,
  existingComplaints,
  geminiTriedModels
}) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      status: null,
      error: "Missing GEMINI_API_KEY"
    };
  }

  let geminiLastStatus = null;
  let geminiLastError = null;
  const promptText = buildModelPrompt({
    message,
    language,
    customer,
    isGuestUser,
    existingComplaints
  });

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: promptText }]
      }
    ],
    generationConfig: {
      temperature: 0.3,
      topK: 20,
      topP: 0.9,
      maxOutputTokens: 700,
      responseMimeType: "application/json",
      responseSchema: GEMINI_RESPONSE_SCHEMA
    }
  };

  for (const model of GEMINI_TRY_MODELS) {
    geminiTriedModels.push(model);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify(payload)
        }
      );
      const rawBody = await response.text();
      geminiLastStatus = response.status;

      if (!response.ok) {
        geminiLastError = rawBody;
        continue;
      }

      const data = safeJsonParse(rawBody);
      const aiText =
        data?.candidates?.[0]?.content?.parts?.map((item) => item.text).join("") || "";
      const parsed = safeJsonParse(aiText);

      if (!parsed) {
        geminiLastError = "Gemini response text could not be parsed as JSON";
        continue;
      }

      return { ok: true, provider: "gemini", parsed, status: geminiLastStatus, error: null };
    } catch (error) {
      geminiLastStatus = 0;
      geminiLastError = error?.message || "Unknown Gemini fetch error";
    }
  }

  return { ok: false, status: geminiLastStatus, error: geminiLastError };
};

const tryGrok = async ({
  message,
  language,
  customer,
  isGuestUser,
  existingComplaints,
  grokTriedModels
}) => {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      status: null,
      error: "Missing GROK_API_KEY"
    };
  }

  let grokLastStatus = null;
  let grokLastError = null;
  const promptText = buildModelPrompt({
    message,
    language,
    customer,
    isGuestUser,
    existingComplaints
  });

  for (const model of GROK_TRY_MODELS) {
    grokTriedModels.push(model);
    try {
      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: promptText }
          ]
        })
      });
      const rawBody = await response.text();
      grokLastStatus = response.status;

      if (!response.ok) {
        grokLastError = rawBody;
        continue;
      }

      const data = safeJsonParse(rawBody);
      const aiText = data?.choices?.[0]?.message?.content || "";
      const parsed = safeJsonParse(aiText);
      if (!parsed) {
        grokLastError = "Grok response text could not be parsed as JSON";
        continue;
      }

      return { ok: true, provider: "grok", parsed, status: grokLastStatus, error: null };
    } catch (error) {
      grokLastStatus = 0;
      grokLastError = error?.message || "Unknown Grok fetch error";
    }
  }

  return { ok: false, status: grokLastStatus, error: grokLastError };
};

const tryGroq = async ({
  message,
  language,
  customer,
  isGuestUser,
  existingComplaints,
  groqTriedModels
}) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      status: null,
      error: "Missing GROQ_API_KEY"
    };
  }

  let groqLastStatus = null;
  let groqLastError = null;
  const promptText = buildModelPrompt({
    message,
    language,
    customer,
    isGuestUser,
    existingComplaints
  });

  for (const model of GROQ_TRY_MODELS) {
    groqTriedModels.push(model);
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: promptText }
          ]
        })
      });
      const rawBody = await response.text();
      groqLastStatus = response.status;

      if (!response.ok) {
        groqLastError = rawBody;
        continue;
      }

      const data = safeJsonParse(rawBody);
      const aiText = data?.choices?.[0]?.message?.content || "";
      const parsed = safeJsonParse(aiText);
      if (!parsed) {
        groqLastError = "Groq response text could not be parsed as JSON";
        continue;
      }

      return { ok: true, provider: "groq", parsed, status: groqLastStatus, error: null };
    } catch (error) {
      groqLastStatus = 0;
      groqLastError = error?.message || "Unknown Groq fetch error";
    }
  }

  return { ok: false, status: groqLastStatus, error: groqLastError };
};

app.post("/api/ai-complaint-agent", async (req, res) => {
  const { message, language, customer, isGuestUser, existingComplaints } = req.body || {};

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Message is required." });
  }

  const geminiTriedModels = [];
  const grokTriedModels = [];
  const groqTriedModels = [];
  let geminiLastStatus = null;
  let geminiLastError = null;
  let grokLastStatus = null;
  let grokLastError = null;
  let groqLastStatus = null;
  let groqLastError = null;

  const geminiResult = await tryGemini({
    message,
    language,
    customer,
    isGuestUser,
    existingComplaints,
    geminiTriedModels
  });
  geminiLastStatus = geminiResult.status;
  geminiLastError = geminiResult.error;
  if (geminiResult.ok) {
    return res.json(
      withDevDebug(
        {
          ...normalizeAiPayload(geminiResult.parsed),
          aiSource: "gemini",
          duplicateWarning: detectDuplicateComplaint(
            message,
            customer,
            existingComplaints || []
          )
        },
        {
          geminiTriedModels,
          geminiLastStatus,
          geminiLastError,
          grokTriedModels,
          grokLastStatus,
          grokLastError,
          groqTriedModels,
          groqLastStatus,
          groqLastError
        }
      )
    );
  }

  const grokResult = await tryGrok({
    message,
    language,
    customer,
    isGuestUser,
    existingComplaints,
    grokTriedModels
  });
  grokLastStatus = grokResult.status;
  grokLastError = grokResult.error;
  if (grokResult.ok) {
    return res.json(
      withDevDebug(
        {
          ...normalizeAiPayload(grokResult.parsed),
          aiSource: "grok",
          duplicateWarning: detectDuplicateComplaint(
            message,
            customer,
            existingComplaints || []
          )
        },
        {
          geminiTriedModels,
          geminiLastStatus,
          geminiLastError,
          grokTriedModels,
          grokLastStatus,
          grokLastError,
          groqTriedModels,
          groqLastStatus,
          groqLastError
        }
      )
    );
  }

  const groqResult = await tryGroq({
    message,
    language,
    customer,
    isGuestUser,
    existingComplaints,
    groqTriedModels
  });
  groqLastStatus = groqResult.status;
  groqLastError = groqResult.error;
  if (groqResult.ok) {
    return res.json(
      withDevDebug(
        {
          ...normalizeAiPayload(groqResult.parsed),
          aiSource: "groq",
          duplicateWarning: detectDuplicateComplaint(
            message,
            customer,
            existingComplaints || []
          )
        },
        {
          geminiTriedModels,
          geminiLastStatus,
          geminiLastError,
          grokTriedModels,
          grokLastStatus,
          grokLastError,
          groqTriedModels,
          groqLastStatus,
          groqLastError
        }
      )
    );
  }

  const fallback = generateFallbackReply({
    message,
    customer,
    language,
    isGuestUser,
    existingComplaints
  });
  return res.json(
    withDevDebug(fallback, {
      aiSource: "fallback",
      geminiTriedModels,
      geminiLastStatus,
      geminiLastError,
      grokTriedModels,
      grokLastStatus,
      grokLastError,
      groqTriedModels,
      groqLastStatus,
      groqLastError
    })
  );
});

app.listen(PORT, () => {
  process.stdout.write(`ISSCAI AI server running on http://localhost:${PORT}\n`);
});
