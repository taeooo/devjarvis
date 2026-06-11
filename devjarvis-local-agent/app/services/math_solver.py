from __future__ import annotations

import re
from dataclasses import dataclass

from app.schemas.local_llm import LocalLlmAnalyzeResponse

_ARITHMETIC_EXPR_RE = re.compile(
    r"(?<![\w.])(?P<expr>\d{1,7}(?:\s*[+\-−–]\s*\d{1,7}){1,8})\s*=",
)
_INLINE_ARITHMETIC_RE = re.compile(r"\d{1,7}(?:\s*[+\-−–]\s*\d{1,7}){1,8}")
_MAX_EXPRESSIONS = 20


@dataclass(frozen=True)
class ArithmeticSolution:
    expression: str
    result: int

    @property
    def formatted(self) -> str:
        return f"{self.expression} = {self.result}"


def solve_arithmetic_text(text: str) -> LocalLlmAnalyzeResponse | None:
    """Return a deterministic response for simple + / - worksheets.

    This solver intentionally supports only integer addition/subtraction. It does not use
    eval and does not try to infer hidden values from diagrams. When no expression is
    found, callers should fall back to the normal Local LLM route.
    """

    solutions = extract_arithmetic_solutions(text)
    if not solutions:
        return None

    detail_lines = [solution.formatted for solution in solutions]
    summary = "계산 결과: " + ", ".join(detail_lines[:8])
    if len(detail_lines) > 8:
        summary += f" 외 {len(detail_lines) - 8}개"

    return LocalLlmAnalyzeResponse(
        status="completed",
        summary=summary,
        detail="\n".join(detail_lines),
        actionItems=[
            "빈칸에는 각 식의 계산 결과를 적어주세요.",
            "중간 계산칸이 있는 문제는 왼쪽부터 순서대로 계산해도 최종 결과는 같습니다.",
        ],
        warnings=[],
    )


def extract_arithmetic_solutions(text: str) -> list[ArithmeticSolution]:
    normalized = _normalize_text(text)
    expressions = _extract_expressions(normalized)
    return [ArithmeticSolution(expression=expr, result=_evaluate(expr)) for expr in expressions]


def _normalize_text(text: str) -> str:
    return (
        text.replace("−", "-")
        .replace("–", "-")
        .replace("＝", "=")
        .replace("＋", "+")
    )


def _extract_expressions(text: str) -> list[str]:
    candidates = [match.group("expr") for match in _ARITHMETIC_EXPR_RE.finditer(text)]

    # Some OCR providers drop the trailing '=' or split worksheet items by line. In that
    # case, still extract obvious arithmetic chains, but keep ordering and de-duplicate.
    if not candidates:
        candidates = [match.group(0) for match in _INLINE_ARITHMETIC_RE.finditer(text)]

    deduped: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        expression = _format_expression(candidate)
        compact = expression.replace(" ", "")
        if compact in seen:
            continue
        if len(_tokenize(expression)) < 3:
            continue
        seen.add(compact)
        deduped.append(expression)
        if len(deduped) >= _MAX_EXPRESSIONS:
            break
    return deduped


def _format_expression(expression: str) -> str:
    tokens = _tokenize(expression)
    return " ".join(tokens)


def _tokenize(expression: str) -> list[str]:
    return re.findall(r"\d+|[+\-]", expression.replace(" ", ""))


def _evaluate(expression: str) -> int:
    tokens = _tokenize(expression)
    if not tokens or not tokens[0].isdigit():
        raise ValueError("expression must start with a number")

    total = int(tokens[0])
    index = 1
    while index < len(tokens):
        operator = tokens[index]
        if index + 1 >= len(tokens) or not tokens[index + 1].isdigit():
            raise ValueError("operator must be followed by a number")
        value = int(tokens[index + 1])
        if operator == "+":
            total += value
        elif operator == "-":
            total -= value
        else:
            raise ValueError(f"unsupported operator: {operator}")
        index += 2
    return total
