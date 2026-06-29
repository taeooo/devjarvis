from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any, NotRequired, TypedDict

from app.schemas.local_llm import LocalLlmAnalyzeRequest, LocalLlmAnalyzeResponse

AnalyzeCallable = Callable[[LocalLlmAnalyzeRequest], Awaitable[LocalLlmAnalyzeResponse]]


class JarvisGraphState(TypedDict):
    """Internal graph state. This state is never returned to Desktop UI."""

    request: LocalLlmAnalyzeRequest
    normalized_text: NotRequired[str]
    has_screen_context: NotRequired[bool]
    has_project_context: NotRequired[bool]
    screen_context: NotRequired[str | None]
    project_context: NotRequired[str | None]
    analysis_response: NotRequired[LocalLlmAnalyzeResponse]
    final_response: NotRequired[LocalLlmAnalyzeResponse]
    warnings: NotRequired[list[str]]


class JarvisGraphRunner:
    """Small LangGraph foundation around the existing local analysis service.

    The runner keeps the existing Local Agent response contract intact while making
    the request pipeline explicit enough to extend with future observer, RAG, tool,
    or project-context nodes.
    """

    def __init__(self, analyzer: AnalyzeCallable) -> None:
        self._analyzer = analyzer
        self._compiled_graph: Any | None = None
        self._graph_import_warning: str | None = None

    async def run(self, request: LocalLlmAnalyzeRequest) -> LocalLlmAnalyzeResponse:
        initial_state: JarvisGraphState = {
            "request": request,
            "warnings": [],
        }

        graph = self._get_compiled_graph()
        if graph is None:
            state = await self._run_sequential_fallback(initial_state)
        else:
            state = await graph.ainvoke(initial_state)

        response = state.get("final_response") or state.get("analysis_response")
        if response is None:
            return LocalLlmAnalyzeResponse(
                status="failed",
                summary="요청 분석 결과를 만들지 못했습니다.",
                detail="Jarvis workflow finished without a response.",
                warnings=[*state.get("warnings", []), "jarvis_workflow_empty_response"],
            )
        return response

    def _get_compiled_graph(self) -> Any | None:
        if self._compiled_graph is not None:
            return self._compiled_graph
        if self._graph_import_warning is not None:
            return None

        try:
            from langchain_core.runnables import RunnableLambda
            from langgraph.graph import END, START, StateGraph
        except ImportError:
            self._graph_import_warning = "jarvis_graph_dependency_missing"
            return None

        builder = StateGraph(JarvisGraphState)
        builder.add_node("normalize_request", RunnableLambda(self.normalize_request))
        builder.add_node("collect_screen_context", RunnableLambda(self.collect_screen_context))
        builder.add_node("collect_project_context", RunnableLambda(self.collect_project_context))
        builder.add_node("analyze_request", RunnableLambda(self.analyze_request))
        builder.add_node("format_jarvis_response", RunnableLambda(self.format_jarvis_response))

        builder.add_edge(START, "normalize_request")
        builder.add_edge("normalize_request", "collect_screen_context")
        builder.add_edge("collect_screen_context", "collect_project_context")
        builder.add_edge("collect_project_context", "analyze_request")
        builder.add_edge("analyze_request", "format_jarvis_response")
        builder.add_edge("format_jarvis_response", END)

        self._compiled_graph = builder.compile()
        return self._compiled_graph

    async def _run_sequential_fallback(self, state: JarvisGraphState) -> JarvisGraphState:
        current = self.normalize_request(state)
        current = self.collect_screen_context(current)
        current = self.collect_project_context(current)
        current = await self.analyze_request(current)
        current = self.format_jarvis_response(current)
        if self._graph_import_warning:
            current.setdefault("warnings", []).append(self._graph_import_warning)
            response = current.get("final_response")
            if response is not None:
                response.warnings.extend([self._graph_import_warning])
        return current

    def normalize_request(self, state: JarvisGraphState) -> JarvisGraphState:
        request = state["request"]
        normalized_text = request.text.strip()
        context = _normalize_optional_text(request.context)

        return {
            **state,
            "normalized_text": normalized_text,
            "has_screen_context": _looks_like_screen_context(context),
            "has_project_context": _looks_like_project_context(context),
            "screen_context": context if _looks_like_screen_context(context) else None,
            "project_context": context if _looks_like_project_context(context) else None,
        }

    def collect_screen_context(self, state: JarvisGraphState) -> JarvisGraphState:
        request = state["request"]
        if request.intent.startswith("screen_") and request.context:
            return {
                **state,
                "has_screen_context": True,
                "screen_context": _normalize_optional_text(request.context),
            }
        return state

    def collect_project_context(self, state: JarvisGraphState) -> JarvisGraphState:
        request = state["request"]
        if request.intent in {"project_diagnosis", "log_analysis"} and request.context:
            return {
                **state,
                "has_project_context": True,
                "project_context": _normalize_optional_text(request.context),
            }
        return state

    async def analyze_request(self, state: JarvisGraphState) -> JarvisGraphState:
        request = state["request"]
        normalized_request = request.model_copy(update={"text": state.get("normalized_text") or request.text})
        response = await self._analyzer(normalized_request)
        return {**state, "analysis_response": response}

    def format_jarvis_response(self, state: JarvisGraphState) -> JarvisGraphState:
        response = state.get("analysis_response")
        if response is None:
            return state

        summary = _compact_summary(response.summary)
        detail = _normalize_optional_text(response.detail)
        if detail and detail == summary:
            detail = None

        final_response = response.model_copy(
            update={
                "summary": summary,
                "detail": detail,
                "actionItems": _compact_action_items(response.actionItems),
                "warnings": list(dict.fromkeys(response.warnings)),
            }
        )
        return {**state, "final_response": final_response}


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _looks_like_screen_context(context: str | None) -> bool:
    if not context:
        return False
    lowered = context.lower()
    return any(marker in lowered for marker in ("screen", "ocr", "captured", "visible", "화면"))


def _looks_like_project_context(context: str | None) -> bool:
    if not context:
        return False
    lowered = context.lower()
    return any(marker in lowered for marker in ("project", "file", "manifest", "source", "프로젝트", "파일"))


def _compact_summary(value: str) -> str:
    normalized = " ".join(value.strip().split())
    if len(normalized) <= 360:
        return normalized
    return f"{normalized[:357].rstrip()}..."


def _compact_action_items(items: list[str]) -> list[str]:
    compacted: list[str] = []
    for item in items:
        normalized = " ".join(str(item).strip().split())
        if not normalized:
            continue
        compacted.append(normalized[:220])
        if len(compacted) >= 5:
            break
    return compacted
