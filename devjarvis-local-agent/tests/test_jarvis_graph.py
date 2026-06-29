import asyncio

from app.graphs.jarvis_graph import JarvisGraphRunner
from app.schemas.local_llm import LocalLlmAnalyzeRequest, LocalLlmAnalyzeResponse


async def _stub_analyzer(request: LocalLlmAnalyzeRequest) -> LocalLlmAnalyzeResponse:
    return LocalLlmAnalyzeResponse(
        status="completed",
        summary=f"분석 완료: {request.text}",
        detail="상세 분석 내용",
        actionItems=["첫 번째 확인", "두 번째 확인"],
        warnings=[],
    )


def test_normalize_request_marks_screen_context() -> None:
    runner = JarvisGraphRunner(_stub_analyzer)
    state = runner.normalize_request({
        "request": LocalLlmAnalyzeRequest(
            intent="screen_error_analysis",
            text="  오류 확인  ",
            context="Screen OCR text length: 120",
        ),
        "warnings": [],
    })

    assert state["normalized_text"] == "오류 확인"
    assert state["has_screen_context"] is True
    assert state["screen_context"] == "Screen OCR text length: 120"


def test_runner_returns_public_response_contract() -> None:
    runner = JarvisGraphRunner(_stub_analyzer)

    response = asyncio.run(runner.run(LocalLlmAnalyzeRequest(intent="general_chat", text="상태 확인")))

    assert response.status == "completed"
    assert response.summary == "분석 완료: 상태 확인"
    assert response.detail == "상세 분석 내용"
    assert response.actionItems == ["첫 번째 확인", "두 번째 확인"]
    assert not hasattr(response, "provider")
    assert not hasattr(response, "model")
