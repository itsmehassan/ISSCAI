import fs from "node:fs/promises";

const SOURCE_FILE = "C:/Users/hassan.naeem/Downloads/ISSCAI_prompts_with_results.txt";
const OUTPUT_FILE = "E:/hassan/hackaton/c04/ISSCAI_prompt_results_report.md";
const API_URL = "http://localhost:5000/api/ai-complaint-agent";

const todayPrompts = [
  "Build clean hackathon MVP web app called InnerSight Smart Complaint AI Assistant (ISSCAI) for banking complaint triage.",
  "Integrate Firebase Phone OTP authentication into Customer Verification screen with Pakistan number validation and Recaptcha.",
  "Convert Step 2 into realistic AI Complaint Agent chat UI with language selector and AI result card.",
  "Add backend endpoint POST /api/ai-complaint-agent using Gemini API with env key and model configuration.",
  "Use rule-based fallback AI when live AI fails and show Live AI unavailable notice.",
  "Enable multi-provider chain for AI response reliability and keep app demo-ready."
];

const parseFilePrompts = (text) => {
  const lines = text.split(/\r?\n/);
  const prompts = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    const match = line.match(/^PROMPT\s+(\d+)\s*[–-]\s*(.+)$/i);
    if (!match) {
      i += 1;
      continue;
    }

    const number = Number(match[1]);
    const title = match[2].trim();
    i += 1;
    const body = [];
    while (i < lines.length && !/^Result:/i.test(lines[i].trim())) {
      const value = lines[i].trim();
      if (value && !value.startsWith("---")) body.push(value);
      i += 1;
    }
    const promptText = body.join(" ").trim() || title;
    prompts.push({
      source: "file",
      label: `Prompt ${number} - ${title}`,
      message: promptText
    });
    i += 1;
  }
  return prompts;
};

const buildRunList = (filePrompts) => {
  const today = todayPrompts.map((prompt, index) => ({
    source: "today",
    label: `Today Prompt ${index + 1}`,
    message: prompt
  }));
  return [...filePrompts, ...today];
};

const callAgent = async (message) => {
  const payload = {
    message,
    language: /roman urdu|urdu/i.test(message) ? "Roman Urdu" : "English",
    isGuestUser: /guest/i.test(message),
    customer: {
      channel: /whatsapp/i.test(message) ? "WhatsApp" : "Web",
      contact: "+923001234567",
      customerName: "Demo User"
    },
    existingComplaints: []
  };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  return { status: response.status, data };
};

const extractHighlights = (data) => ({
  aiSource: data.aiSource || "unknown",
  category: data.category || "",
  priority: data.priority || "",
  department: data.department || "",
  sentiment: data.sentiment || "",
  sla: data.sla || "",
  risk: data.validityRisk || "",
  botReply: data.botReply || "",
  fallbackNotice: data.fallbackNotice || "",
  geminiStatus: data.geminiLastStatus ?? "",
  grokStatus: data.grokLastStatus ?? "",
  groqStatus: data.groqLastStatus ?? ""
});

const toMarkdown = (runs) => {
  const now = new Date().toISOString();
  const header = [
    "# ISSCAI Prompt Execution Report",
    "",
    `Generated At: ${now}`,
    "",
    `Total Runs: ${runs.length}`,
    "",
    "## Summary Table",
    "",
    "| # | Source | Label | AI Source | Category | Priority | Department |",
    "|---|---|---|---|---|---|---|"
  ];

  const summaryRows = runs.map(
    (run, idx) =>
      `| ${idx + 1} | ${run.source} | ${run.label} | ${run.highlights.aiSource} | ${run.highlights.category} | ${run.highlights.priority} | ${run.highlights.department} |`
  );

  const details = runs.flatMap((run, idx) => [
    "",
    `## Run ${idx + 1}: ${run.label}`,
    "",
    `- Source: ${run.source}`,
    `- HTTP Status: ${run.status}`,
    `- AI Source: ${run.highlights.aiSource}`,
    `- Gemini Status: ${run.highlights.geminiStatus || "N/A"}`,
    `- Grok Status: ${run.highlights.grokStatus || "N/A"}`,
    `- Groq Status: ${run.highlights.groqStatus || "N/A"}`,
    "",
    "### Prompt",
    "",
    run.message,
    "",
    "### Result Highlights",
    "",
    `- Category: ${run.highlights.category || "N/A"}`,
    `- Priority: ${run.highlights.priority || "N/A"}`,
    `- Sentiment: ${run.highlights.sentiment || "N/A"}`,
    `- Validity Risk: ${run.highlights.risk || "N/A"}`,
    `- Department: ${run.highlights.department || "N/A"}`,
    `- SLA: ${run.highlights.sla || "N/A"}`,
    `- Bot Reply: ${run.highlights.botReply || "N/A"}`,
    run.highlights.fallbackNotice
      ? `- Fallback Notice: ${run.highlights.fallbackNotice}`
      : "- Fallback Notice: None",
    "",
    "### Full JSON Response",
    "",
    "```json",
    JSON.stringify(run.raw, null, 2),
    "```"
  ]);

  return [...header, ...summaryRows, ...details].join("\n");
};

const main = async () => {
  const sourceText = await fs.readFile(SOURCE_FILE, "utf8");
  const parsedPrompts = parseFilePrompts(sourceText);
  const allPrompts = buildRunList(parsedPrompts);
  const runs = [];

  for (const item of allPrompts) {
    try {
      const { status, data } = await callAgent(item.message);
      runs.push({
        ...item,
        status,
        raw: data,
        highlights: extractHighlights(data)
      });
    } catch (error) {
      runs.push({
        ...item,
        status: 0,
        raw: { error: error.message },
        highlights: {
          aiSource: "request_failed",
          category: "",
          priority: "",
          department: "",
          sentiment: "",
          sla: "",
          risk: "",
          botReply: "",
          fallbackNotice: error.message
        }
      });
    }
  }

  const markdown = toMarkdown(runs);
  await fs.writeFile(OUTPUT_FILE, markdown, "utf8");
  process.stdout.write(`Report generated: ${OUTPUT_FILE}\n`);
  process.stdout.write(`Prompt runs completed: ${runs.length}\n`);
};

main();
