# DevJarvis Model Routing and Screen Target Policy

## Model routing policy

DevJarvis should not depend on a single LLM model. The Local Agent resolves a model by command intent so each feature can use the model family that fits the task.

```text
Desktop
→ Local Agent
→ Model Router
   ├─ default model
   ├─ code model
   ├─ translation model
   ├─ reasoning model
   └─ fallback model
→ Ollama
```

Initial routing:

| Intent | Model role |
|---|---|
| screen_translate | translation |
| screen_summary | reasoning |
| screen_error_analysis | code |
| project_diagnosis | code |
| log_analysis | code |
| general_chat | default |

Recommended first local configuration:

```env
DEVJARVIS_LOCAL_AGENT_DEFAULT_MODEL=qwen3:8b
DEVJARVIS_LOCAL_AGENT_CODE_MODEL=qwen2.5-coder:7b
DEVJARVIS_LOCAL_AGENT_TRANSLATION_MODEL=qwen3:8b
DEVJARVIS_LOCAL_AGENT_REASONING_MODEL=qwen3:8b
DEVJARVIS_LOCAL_AGENT_FALLBACK_MODEL=qwen3:8b
```

The single-model setting `DEVJARVIS_LOCAL_AGENT_OLLAMA_MODEL` remains available for backward compatibility. Prefer role-based settings for long-term expansion.

## Screen target policy

The phrase "current screen" is ambiguous in multi-monitor environments. DevJarvis keeps a separate screen target state instead of assuming every monitor should be captured.

### Voice command

For future STT commands, the preferred target policy is:

```text
1. foreground window at command time
2. monitor containing the foreground window
3. cursor monitor
4. explicit monitor/window mentioned by the user
5. manual picker fallback
```

### Text fallback command

Text fallback is different because the user clicks the DevJarvis input field first. If the app simply used the active window, it would capture DevJarvis itself. Therefore text commands use this policy:

```text
1. last selected screen target
2. last captured target
3. manual picker
```

Current implementation uses the secure manual picker for text commands and records the selected target state. It does not automatically capture all monitors.

## Security rules

- Do not capture all monitors by default.
- Do not infer a target when the target is ambiguous.
- Use a user-selected screen/window picker when text fallback has no prior target.
- Keep screen capture image handling memory-only.
- Keep Local Agent and Ollama bound to loopback.
- Do not expose Local Agent or Ollama through NAS firewall or public ports.
