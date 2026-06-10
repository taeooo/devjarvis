from app.schemas.local_llm import LocalLlmIntent


_INTENT_TASKS: dict[str, str] = {
    "screen_translate": "Translate the screen text into Korean. Preserve technical terms when useful.",
    "screen_summary": "Summarize the screen text into concise Korean bullet points.",
    "screen_error_analysis": "Analyze the visible error. Explain likely causes and safe next actions in Korean.",
    "project_diagnosis": "Analyze the project context and suggest likely causes and next checks in Korean.",
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
        "Return JSON only with keys: summary, detail, actionItems."
    )
