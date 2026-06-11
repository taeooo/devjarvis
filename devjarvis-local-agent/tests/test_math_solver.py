from app.services.math_solver import extract_arithmetic_solutions, solve_arithmetic_text


def test_extract_arithmetic_solutions_from_worksheet_text() -> None:
    text = "33 - 14 - 9 = □\n27 + 15 - 12 = □\n50 - 13 + 23 = □"

    solutions = extract_arithmetic_solutions(text)

    assert [solution.formatted for solution in solutions] == [
        "33 - 14 - 9 = 10",
        "27 + 15 - 12 = 30",
        "50 - 13 + 23 = 60",
    ]


def test_extract_arithmetic_solutions_supports_multiplication_division_and_parentheses() -> None:
    text = "6 × 7 = □\n48 ÷ 6 = □\n(3 + 5) × 2 = □\n18 / 5 = □"

    solutions = extract_arithmetic_solutions(text)

    assert [solution.formatted for solution in solutions] == [
        "6 × 7 = 42",
        "48 ÷ 6 = 8",
        "( 3 + 5 ) × 2 = 16",
        "18 ÷ 5 = 3.6 (몫 3, 나머지 3)",
    ]


def test_extract_arithmetic_solutions_supports_korean_operator_words() -> None:
    text = "6 곱하기 7 =\n40 나누기 8 ="

    solutions = extract_arithmetic_solutions(text)

    assert [solution.formatted for solution in solutions] == ["6 × 7 = 42", "40 ÷ 8 = 5"]


def test_extract_arithmetic_solutions_outputs_quotient_when_requested() -> None:
    response = solve_arithmetic_text("17 ÷ 5 =", context="userRequest=몫과 나머지 구해줘")

    assert response is not None
    assert "17 ÷ 5 = 3.4 (몫 3, 나머지 2)" in (response.detail or "")


def test_extract_arithmetic_solutions_deduplicates_ocr_repeats() -> None:
    text = "33 − 9 − 14 = 10\n33 - 9 - 14 = 10"

    solutions = extract_arithmetic_solutions(text)

    assert [solution.formatted for solution in solutions] == ["33 - 9 - 14 = 10"]


def test_solve_arithmetic_text_returns_local_response() -> None:
    response = solve_arithmetic_text("15 + 27 - 12 =")

    assert response is not None
    assert response.status == "completed"
    assert "15 + 27 - 12 = 30" in (response.detail or "")
    assert response.actionItems


def test_solve_arithmetic_text_returns_none_when_no_expression() -> None:
    assert solve_arithmetic_text("계산할 수식이 보이지 않습니다") is None


def test_extract_arithmetic_solutions_ignores_dates_and_division_by_zero() -> None:
    text = "2026-06-11\n10 ÷ 0 ="

    assert extract_arithmetic_solutions(text) == []
