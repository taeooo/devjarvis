from app.services.ollama_client import OllamaClient


def test_parse_model_json_extracts_json_after_thinking_block() -> None:
    content = '<think>reasoning text</think>\n{"summary":"요약","detail":"상세","actionItems":["확인"]}'

    parsed = OllamaClient._parse_model_json(content)

    assert parsed["summary"] == "요약"
    assert parsed["detail"] == "상세"
    assert parsed["actionItems"] == ["확인"]


def test_parse_model_json_extracts_first_json_object_from_extra_text() -> None:
    content = '결과입니다. {"summary":"번역 완료","detail":"전체 번역문"} 감사합니다.'

    parsed = OllamaClient._parse_model_json(content)

    assert parsed["summary"] == "번역 완료"
    assert parsed["detail"] == "전체 번역문"


def test_parse_model_json_returns_empty_for_plain_text() -> None:
    parsed = OllamaClient._parse_model_json("일반 텍스트 응답")

    assert parsed == {}
