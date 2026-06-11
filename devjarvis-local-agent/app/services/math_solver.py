from __future__ import annotations

import re
from dataclasses import dataclass
from fractions import Fraction

from app.schemas.local_llm import LocalLlmAnalyzeResponse

_INLINE_ARITHMETIC_RE = re.compile(
    r"(?<![\w.])(?P<expr>-?\d+(?:\.\d+)?(?:\s*[+\-*/]\s*-?\d+(?:\.\d+)?){1,12})(?![\w.])"
)
_ALLOWED_SEGMENT_RE = re.compile(r"[^0-9+\-*/().\s]+")
_NUMBER_RE = re.compile(r"^-?\d+(?:\.\d+)?$")
_MAX_EXPRESSIONS = 20


@dataclass(frozen=True)
class ArithmeticSolution:
    expression: str
    result: Fraction
    quotient: int | None = None
    remainder: int | None = None

    @property
    def formatted(self) -> str:
        suffix = ""
        if self.quotient is not None and self.remainder is not None:
            suffix = f" (몫 {self.quotient}, 나머지 {self.remainder})"
        return f"{self.expression} = {_format_fraction(self.result)}{suffix}"


def solve_arithmetic_text(text: str, context: str | None = None) -> LocalLlmAnalyzeResponse | None:
    """Return a deterministic response for elementary arithmetic worksheets.

    The solver intentionally supports a constrained arithmetic grammar only:
    numbers, +, -, ×, ÷, *, /, parentheses, and simple quotient/remainder output.
    It does not use eval and does not try to infer hidden values from diagrams. When
    no safe arithmetic expression is found, callers should fall back to the normal
    Local LLM route.
    """

    solutions = extract_arithmetic_solutions(text, context=context)
    if not solutions:
        return None

    detail_lines = [solution.formatted for solution in solutions]
    summary = "계산 결과: " + ", ".join(detail_lines[:6])
    if len(detail_lines) > 6:
        summary += f" 외 {len(detail_lines) - 6}개"

    return LocalLlmAnalyzeResponse(
        status="completed",
        summary=summary,
        detail="\n".join(detail_lines),
        actionItems=[
            "빈칸에는 각 식의 계산 결과를 적어주세요.",
            "곱셈/나눗셈은 덧셈/뺄셈보다 먼저 계산하고, 괄호가 있으면 괄호 안을 먼저 계산합니다.",
            "몫/나머지 문제는 나누어지는 수를 나누는 수로 나눈 정수 몫과 남는 값을 확인하세요.",
        ],
        warnings=[],
    )


def extract_arithmetic_solutions(text: str, context: str | None = None) -> list[ArithmeticSolution]:
    normalized = _normalize_text(text)
    expressions = _extract_expressions(normalized)
    quotient_requested = _has_quotient_request(normalized, context)

    solutions: list[ArithmeticSolution] = []
    for expression in expressions:
        try:
            result = _evaluate(expression)
        except ValueError:
            continue

        quotient: int | None = None
        remainder: int | None = None
        division_pair = _extract_simple_integer_division(expression)
        if division_pair is not None:
            dividend, divisor = division_pair
            if divisor != 0:
                quotient = dividend // divisor
                remainder = dividend % divisor
                if not quotient_requested and remainder == 0:
                    quotient = None
                    remainder = None

        solutions.append(
            ArithmeticSolution(
                expression=_display_expression(expression),
                result=result,
                quotient=quotient,
                remainder=remainder,
            )
        )

    return solutions


def _normalize_text(text: str) -> str:
    normalized = (
        text.replace("−", "-")
        .replace("–", "-")
        .replace("—", "-")
        .replace("－", "-")
        .replace("＝", "=")
        .replace("＋", "+")
        .replace("＊", "*")
        .replace("×", "*")
        .replace("÷", "/")
        .replace("／", "/")
    )
    normalized = re.sub(r"(?<=\d)\s*[xX]\s*(?=\d)", " * ", normalized)
    normalized = normalized.replace("더하기", " + ")
    normalized = normalized.replace("빼기", " - ")
    normalized = normalized.replace("곱하기", " * ")
    normalized = normalized.replace("나누기", " / ")
    normalized = re.sub(r"(?<=\d)\s*\(\s*", " * (", normalized)
    normalized = re.sub(r"\)\s*(?=\d)", ") * ", normalized)
    return normalized


def _extract_expressions(text: str) -> list[str]:
    candidates: list[str] = []

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        # In worksheets the unknown answer usually appears after '='. Only solve the
        # expression on the left side so that a printed answer is not re-parsed.
        source = line.split("=", 1)[0] if "=" in line else line
        parenthesized = _extract_parenthesized_segments(source)
        if parenthesized:
            candidates.extend(parenthesized)
            continue

        candidates.extend(match.group("expr") for match in _INLINE_ARITHMETIC_RE.finditer(source))

    deduped: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        expression = _format_expression(candidate)
        if not expression:
            continue
        compact = expression.replace(" ", "")
        if compact in seen:
            continue
        if _looks_like_date(compact):
            continue
        if not _has_binary_operator(expression):
            continue
        try:
            _evaluate(expression)
        except ValueError:
            continue
        seen.add(compact)
        deduped.append(expression)
        if len(deduped) >= _MAX_EXPRESSIONS:
            break
    return deduped


def _extract_parenthesized_segments(source: str) -> list[str]:
    if "(" not in source and ")" not in source:
        return []

    segments: list[str] = []
    for segment in _ALLOWED_SEGMENT_RE.split(source):
        cleaned = segment.strip()
        if not cleaned or not any(operator in cleaned for operator in "+-*/"):
            continue
        if "(" in cleaned or ")" in cleaned:
            segments.append(cleaned)
    return segments


def _format_expression(expression: str) -> str:
    try:
        tokens = _tokenize(expression)
    except ValueError:
        return ""
    return " ".join(tokens)


def _display_expression(expression: str) -> str:
    return expression.replace("*", "×").replace("/", "÷")


def _tokenize(expression: str) -> list[str]:
    compact = expression.replace(" ", "")
    raw_tokens = re.findall(r"\d+(?:\.\d+)?|[()+\-*/]", compact)
    if not raw_tokens:
        raise ValueError("empty expression")

    tokens: list[str] = []
    index = 0
    while index < len(raw_tokens):
        token = raw_tokens[index]
        previous = tokens[-1] if tokens else None
        unary_position = previous is None or previous in {"+", "-", "*", "/", "("}

        if token in {"+", "-"} and unary_position:
            next_token = raw_tokens[index + 1] if index + 1 < len(raw_tokens) else None
            if next_token and _is_number(next_token):
                tokens.append(next_token if token == "+" else f"-{next_token}")
                index += 2
                continue
            if next_token == "(":
                tokens.extend(["0", token])
                index += 1
                continue
            raise ValueError("invalid unary operator")

        tokens.append(token)
        index += 1

    return tokens


def _evaluate(expression: str) -> Fraction:
    tokens = _tokenize(expression)
    values: list[Fraction] = []
    operators: list[str] = []

    def apply_operator() -> None:
        if len(values) < 2 or not operators:
            raise ValueError("invalid expression")
        operator = operators.pop()
        right = values.pop()
        left = values.pop()
        if operator == "+":
            values.append(left + right)
        elif operator == "-":
            values.append(left - right)
        elif operator == "*":
            values.append(left * right)
        elif operator == "/":
            if right == 0:
                raise ValueError("division by zero")
            values.append(left / right)
        else:
            raise ValueError(f"unsupported operator: {operator}")

    previous_was_value = False
    for token in tokens:
        if _is_number(token):
            if previous_was_value:
                raise ValueError("missing operator")
            values.append(Fraction(token))
            previous_was_value = True
            continue

        if token == "(":
            if previous_was_value:
                raise ValueError("missing operator before parenthesis")
            operators.append(token)
            previous_was_value = False
            continue

        if token == ")":
            while operators and operators[-1] != "(":
                apply_operator()
            if not operators or operators[-1] != "(":
                raise ValueError("unmatched parenthesis")
            operators.pop()
            previous_was_value = True
            continue

        if token in {"+", "-", "*", "/"}:
            if not previous_was_value:
                raise ValueError("operator without left operand")
            while operators and operators[-1] != "(" and _precedence(operators[-1]) >= _precedence(token):
                apply_operator()
            operators.append(token)
            previous_was_value = False
            continue

        raise ValueError(f"unsupported token: {token}")

    if not previous_was_value:
        raise ValueError("expression ended with operator")

    while operators:
        if operators[-1] == "(":
            raise ValueError("unmatched parenthesis")
        apply_operator()

    if len(values) != 1:
        raise ValueError("invalid expression")
    return values[0]


def _precedence(operator: str) -> int:
    return 2 if operator in {"*", "/"} else 1


def _is_number(token: str) -> bool:
    return bool(_NUMBER_RE.match(token))


def _has_binary_operator(expression: str) -> bool:
    try:
        tokens = _tokenize(expression)
    except ValueError:
        return False
    return any(token in {"+", "-", "*", "/"} for token in tokens[1:])


def _looks_like_date(compact_expression: str) -> bool:
    return bool(re.fullmatch(r"\d{4}-\d{1,2}-\d{1,2}", compact_expression))


def _extract_simple_integer_division(expression: str) -> tuple[int, int] | None:
    tokens = _tokenize(expression)
    if len(tokens) != 3 or tokens[1] != "/":
        return None
    if not tokens[0].lstrip("-").isdigit() or not tokens[2].lstrip("-").isdigit():
        return None
    return int(tokens[0]), int(tokens[2])


def _has_quotient_request(text: str, context: str | None) -> bool:
    target = f"{text}\n{context or ''}"
    return any(keyword in target for keyword in ["몫", "나머지", "remainder", "quotient"])


def _format_fraction(value: Fraction) -> str:
    if value.denominator == 1:
        return str(value.numerator)

    decimal = _terminating_decimal(value)
    if decimal is not None:
        return decimal

    return f"{value.numerator}/{value.denominator}"


def _terminating_decimal(value: Fraction) -> str | None:
    denominator = value.denominator
    for prime in (2, 5):
        while denominator % prime == 0:
            denominator //= prime
    if denominator != 1:
        return None

    number = value.numerator / value.denominator
    formatted = f"{number:.8f}".rstrip("0").rstrip(".")
    return formatted if formatted != "-0" else "0"
