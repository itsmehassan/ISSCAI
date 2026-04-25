import fs from "node:fs/promises";

const INPUT_MD = "E:/hassan/hackaton/c04/ISSCAI_prompt_results_report.md";
const OUT_JSON = "E:/hassan/hackaton/c04/ISSCAI_prompt_results_report.json";
const OUT_CSV = "E:/hassan/hackaton/c04/ISSCAI_prompt_results_report.csv";

const parseRuns = (mdText) => {
  const runBlocks = mdText.split(/\n## Run \d+:/).slice(1);
  const titleMatches = [...mdText.matchAll(/\n## Run \d+: (.+)\n/g)].map((m) => m[1].trim());

  return runBlocks.map((block, idx) => {
    const title = titleMatches[idx] || `Run ${idx + 1}`;
    const getLine = (label) => {
      const m = block.match(new RegExp(`- ${label}:\\s*(.*)`));
      return m ? m[1].trim() : "";
    };
    const promptMatch = block.match(/### Prompt\s+([\s\S]*?)\s+### Result Highlights/);
    const jsonMatch = block.match(/```json\s*([\s\S]*?)\s*```/);
    let parsed = {};
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[1]);
      } catch {
        parsed = {};
      }
    }

    return {
      run: idx + 1,
      label: title,
      source: getLine("Source"),
      httpStatus: getLine("HTTP Status"),
      aiSource: getLine("AI Source"),
      geminiStatus: getLine("Gemini Status"),
      grokStatus: getLine("Grok Status"),
      groqStatus: getLine("Groq Status"),
      prompt: (promptMatch?.[1] || "").trim(),
      category: parsed.category || "",
      priority: parsed.priority || "",
      sentiment: parsed.sentiment || "",
      validityRisk: parsed.validityRisk || "",
      department: parsed.department || "",
      sla: parsed.sla || "",
      botReply: parsed.botReply || "",
      fullResponse: parsed
    };
  });
};

const csvEscape = (value) => {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
};

const toCsv = (rows) => {
  const headers = [
    "run",
    "label",
    "source",
    "httpStatus",
    "aiSource",
    "geminiStatus",
    "grokStatus",
    "groqStatus",
    "prompt",
    "category",
    "priority",
    "sentiment",
    "validityRisk",
    "department",
    "sla",
    "botReply"
  ];

  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      headers.map((h) => csvEscape(r[h])).join(",")
    )
  ];
  return lines.join("\n");
};

const main = async () => {
  const md = await fs.readFile(INPUT_MD, "utf8");
  const runs = parseRuns(md);
  await fs.writeFile(OUT_JSON, JSON.stringify(runs, null, 2), "utf8");
  await fs.writeFile(OUT_CSV, toCsv(runs), "utf8");
  process.stdout.write(`JSON exported: ${OUT_JSON}\n`);
  process.stdout.write(`CSV exported: ${OUT_CSV}\n`);
  process.stdout.write(`Total rows: ${runs.length}\n`);
};

main();
