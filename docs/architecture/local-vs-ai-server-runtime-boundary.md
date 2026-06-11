# Local Runtime and AI Server Boundary

## 문제 정의

DevJarvis has a Desktop app, Local Agent, Backend, and AI Server. Without a clear runtime boundary, it is easy to start unnecessary services or accidentally route sensitive local data to the wrong process.

## 왜 이 작업이 필요한지

Screen images, OCR text, audio, and local project context are sensitive. The desktop MVP should work with Local Agent and Ollama on the user PC without requiring the AI Server.

## 어떤 방향으로 해결했는지

- Desktop MVP runtime is defined as Desktop + Local Agent + Ollama.
- Backend is optional for project metadata sync and future persistence.
- AI Server is not required for local screen diagnosis, local OCR, local STT, or local project analysis.
- AI Server should be reserved for later non-sensitive backend-side jobs or explicitly approved remote capabilities.

## 보안상 고려사항

- No automatic fallback from Local Agent to AI Server.
- No screen image transfer to AI Server.
- No OCR raw text transfer to AI Server.
- No audio transfer to AI Server.
- No project file content transfer to AI Server.

## 현재 한계

Some backend package names still include AI Server clients from earlier foundations. Those should not be used as the default Desktop MVP path.

## 다음 확장 방향

- Remove or feature-flag legacy AI Server paths that are not part of local MVP.
- Add runtime smoke checks that clearly separate Desktop, Local Agent, Backend, Ollama, and AI Server responsibilities.
