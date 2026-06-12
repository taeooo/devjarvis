from app.schemas.local_llm import LocalLlmIntent


_INTENT_TASKS: dict[str, str] = {
    "screen_translate": "Translate the screen text into Korean. Preserve technical terms when useful.",
    "screen_summary": "Summarize the screen text into concise Korean bullet points.",
    "screen_error_analysis": "Analyze the visible error. Explain likely causes and safe next actions in Korean.",
    "screen_math_solver": "Solve the visible arithmetic or worksheet problems in Korean. Show final answers clearly. If exact calculation is not possible, say what is unclear.",
    "project_diagnosis": "Analyze the local project deep index in Korean. Explain runtime flow, module boundaries, API/UI/service links, risk areas, and next checks. Do not merely restate file counts.",
    "log_analysis": "Analyze the log text. Identify errors, root cause candidates, and next checks in Korean.",
    "general_chat": "Answer the user's command in Korean based only on the provided text.",
}


def build_local_llm_prompt(intent: LocalLlmIntent, text: str, context: str | None) -> str:
    task = _INTENT_TASKS.get(intent, _INTENT_TASKS["general_chat"])
    context_section = f"\n[Context]\n{context.strip()}\n" if context and context.strip() else ""

    return (
        "You are DevJarvis, a local-only desktop AI assistant.\n"
        "Security rules:\n"
        "- Do not ask for secrets, tokens, or passwords.\n"
        "- Do not invent file contents or hidden screen details.\n"
        "- If information is insufficient, say what must be checked next.\n"
        "- Keep the response practical and concise.\n\n"
        f"[Task]\n{task}\n"
        f"{context_section}"
        f"\n[Observed Text]\n{text}\n\n"
        "Return JSON only with keys: summary, detail, actionItems. Do not wrap JSON in markdown fences."
    )
