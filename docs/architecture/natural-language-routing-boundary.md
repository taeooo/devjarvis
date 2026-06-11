# Natural Language Routing Boundary

## 문제 정의

DevJarvis Desktop source had request examples and keyword lists embedded directly in routing and guide components. Those lists can grow without clear ownership and eventually turn UI examples into implicit behavior contracts.

## 왜 이 작업이 필요한지

A long-lived local assistant must avoid source-level natural-language rule accumulation. Routing behavior should be based on explicit command tokens, structural signals, or a future classifier boundary rather than continuously adding phrase variants to components and utilities.

## 어떤 방향으로 해결했는지

- Removed natural-language example arrays from the assistant guide component.
- Replaced the command input placeholder with command-token guidance.
- Reduced `commandRouter` to explicit slash-command tokens and structural signals.
- Added a selected-project hint so plain text can default to project context only when a project is already selected.
- Kept deterministic math expression detection because it is grammar-like parsing, not a phrase list.

## 보안상 고려사항

Source-level phrase lists can accidentally route sensitive screen, project, or log data into the wrong pipeline. Explicit tokens make it clearer when a request requires screen capture, project manifest use, or local LLM analysis.

## 현재 한계

Plain natural-language screen requests no longer have a broad phrase-list router. Until a local classifier is introduced, screen-specific requests should use tokens such as `/screen`, `/translate`, `/summary`, or `/math`.

## 다음 확장 방향

- Move remaining UI copy into a dedicated copy/i18n boundary.
- Add a local-only intent classifier if natural-language routing is needed again.
- Keep classifier prompts/config separate from component source.
