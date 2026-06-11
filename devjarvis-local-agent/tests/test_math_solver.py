from app.services.math_solver import extract_arithmetic_solutions, solve_arithmetic_text


def test_extract_arithmetic_solutions_from_worksheet_text() -> None:
    text = "33 - 14 - 9 = □\n27 + 15 - 12 = □\n50 - 13 + 23 = □"

    solutions = extract_arithmetic_solutions(text)

    assert [solution.formatted for solution in solutions] == [
        "33 - 14 - 9 = 10",
        "27 + 15 - 12 = 30",
        "50 - 13 + 23 = 60",
    ]


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
