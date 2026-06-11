# Jarvis Core Viewport Contract

## 문제 정의

The center orb, AI Core readout, Last Command area, and command input could exceed the desktop viewport during project analysis or failure states. The previous layout depended on absolute positioning inside a flexible panel, so long status text could make the UI appear pushed or clipped.

## 왜 이 작업이 필요한지

DevJarvis is intended to be a command-shell style desktop assistant. The main surface must remain stable when command states change, otherwise users cannot trust whether an operation is running, failed, or waiting for input.

## 어떤 방향으로 해결했는지

- Bound the app shell to `100dvh` and disabled outer overflow.
- Bound the command layout to the remaining viewport height.
- Changed the Jarvis Core panel to a grid contract: visual core row plus command readout row.
- Removed readout overlap caused by absolute positioning.
- Limited orb size by both viewport width and viewport height.
- Clamped long readout text inside the panel.

## 보안상 고려사항

This is a layout-only change. It does not change screen capture, OCR, project manifest, LLM, STT, or backend payload boundaries.

## 현재 한계

Very small windows may still require a simplified responsive layout later. Current Tauri minimum window size should keep the main layout stable.

## 다음 확장 방향

- Add visual regression screenshots for the Tauri shell.
- Split command readout into a compact current-state component and an expandable detail viewer.
