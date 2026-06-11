# Local-first Project Analysis

## 문제 정의

Project analysis was tied too closely to backend project registration and manifest sync. If backend registration failed because a project name already existed or the backend was unavailable, the local project analysis flow could fail even though the local manifest scan had already succeeded.

## 왜 이 작업이 필요한지

Project analysis in the desktop MVP should not depend on NAS or backend availability. Backend sync is useful for future history, indexing, and persistence, but the local assistant should still be able to analyze the selected project manifest on the user PC.

## 어떤 방향으로 해결했는지

- The desktop scans the project manifest locally first.
- Backend project creation and manifest registration are treated as best-effort sync.
- Project analysis continues when backend sync fails.
- Backend project creation now reuses an existing active project with the same `rootPathAlias`.
- Project name conflict for a different alias remains rejected with a stable code.
- Local Agent analysis context is kept under a fixed character budget.

## 보안상 고려사항

- The desktop passes only manifest summary and relative path samples to Local Agent.
- File contents are not sent for project analysis.
- Absolute OS paths and root path aliases are not sent to Local Agent analysis context.
- Backend failure does not trigger remote OCR, remote STT, or remote analysis fallback.

## 현재 한계

The current analysis is manifest-level. It can suggest likely areas but does not yet inspect file contents or build a full project RAG index.

## 다음 확장 방향

- Add explicit user consent before reading selected file contents.
- Add local-only project chunking/indexing.
- Sync sanitized metadata/history to backend after the local MVP is stable.
