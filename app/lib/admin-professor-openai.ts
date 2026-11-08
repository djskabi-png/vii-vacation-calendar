type ProfessorInterpretation = {
  canonicalQuestion: string;
  provider: "openai" | "deterministic";
  warning: string | null;
};

async function professorEnvironment() {
  let workerKey = "";
  let workerModel = "";
  try {
    const runtimeName = "cloudflare:workers";
    const runtime = await import(/* @vite-ignore */ runtimeName);
    const env = (runtime.env || {}) as { OPENAI_API_KEY?: string; OPENAI_PROFESSOR_MODEL?: string };
    workerKey = String(env.OPENAI_API_KEY || "").trim();
    workerModel = String(env.OPENAI_PROFESSOR_MODEL || "").trim();
  } catch {
    // Local tests and builds do not expose Cloudflare bindings.
  }
  return {
    apiKey: workerKey || String(process.env.OPENAI_API_KEY || "").trim(),
    model: workerModel || String(process.env.OPENAI_PROFESSOR_MODEL || "").trim() || "gpt-5-mini",
  };
}

function responseText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as { output_text?: unknown; output?: unknown };
  if (typeof record.output_text === "string") return record.output_text;
  if (!Array.isArray(record.output)) return "";
  return record.output.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) return [];
    return content.flatMap((part) => part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string"
      ? [(part as { text: string }).text]
      : []);
  }).join("\n");
}

export async function interpretProfessorQuestion(question: string): Promise<ProfessorInterpretation> {
  const {parseProfessorIntent}=await import('./admin-professor-intent.ts');
  const explicit=parseProfessorIntent(question,[]);
  if(explicit.breakdown&&explicit.explicitMetrics)return {canonicalQuestion:question,provider:'deterministic',warning:null};
  const env = await professorEnvironment();
  if (!env.apiKey) return { canonicalQuestion: question, provider: "deterministic", warning: "openai_not_configured" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: { authorization: `Bearer ${env.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: env.model,
        max_output_tokens: 220,
        input: [{
          role: "system",
          content: [
            "אתה מתרגם שאלת ניהול בעברית לשאילתה קנונית עבור מנוע דוחות VII.",
            "שמור במדויק שמות עסקים ותאריכים. אל תענה על השאלה ואל תמציא נתונים.",
            "העולמות המותרים: נופש, אירועים, חדרים לפי שעה, ספא.",
            "המדדים המותרים: חשיפות, כניסות לעמודים, טלפונים, וואטסאפ, בקשות הזמנה מ-V, שיחות Maskyoo, הזמנות Biz, הכנסות Biz.",
            "אם מבקשים השוואה כתוב לעומת התקופה הקודמת. אם מבקשים מובילים כתוב מי הכי מוביל.",
            "החזר רק JSON לפי הסכמה.",
          ].join(" "),
        }, { role: "user", content: question }],
        text: {
          format: {
            type: "json_schema",
            name: "vii_professor_query",
            strict: true,
            schema: {
              type: "object",
              properties: { canonical_question: { type: "string", minLength: 1, maxLength: 800 } },
              required: ["canonical_question"],
              additionalProperties: false,
            },
          },
        },
      }),
    });
    if (!response.ok) return { canonicalQuestion: question, provider: "deterministic", warning: `openai_http_${response.status}` };
    const raw = responseText(await response.json());
    const parsed = JSON.parse(raw) as { canonical_question?: unknown };
    const canonical = typeof parsed.canonical_question === "string" ? parsed.canonical_question.trim().slice(0, 800) : "";
    return canonical
      ? { canonicalQuestion: canonical, provider: "openai", warning: null }
      : { canonicalQuestion: question, provider: "deterministic", warning: "openai_empty_result" };
  } catch (error) {
    return {
      canonicalQuestion: question,
      provider: "deterministic",
      warning: error instanceof Error && error.name === "AbortError" ? "openai_timeout" : "openai_invalid_result",
    };
  } finally {
    clearTimeout(timeout);
  }
}
