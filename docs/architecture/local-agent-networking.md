# DevJarvis Local Agent Networking

DevJarvis는 사용자 PC 방화벽을 열지 않는 구조를 기본으로 한다.

## Runtime placement

| Component | Runtime | Network exposure |
|---|---|---|
| Desktop | User PC | No inbound port |
| Local Agent | User PC | `127.0.0.1:17997` only |
| Ollama | User PC | `127.0.0.1:11434` only |
| Backend | NAS | HTTPS only through reverse proxy |
| AI Server | NAS | Internal network only |
| PostgreSQL | NAS | Internal network only |

## NAS firewall policy

External inbound should expose only HTTPS.

```text
Internet
→ NAS reverse proxy / Cloudflare / Nginx : 443
→ Backend internal port
→ AI Server internal port
→ PostgreSQL internal port
```

Recommended NAS policy:

```text
Allow external inbound:
- TCP 443

Do not expose externally:
- Backend application port
- AI Server port
- PostgreSQL port
- Redis port
- Local Agent port
- Ollama port
```

## Local PC policy

Local Agent and Ollama must stay loopback-only.

```text
Desktop → Local Agent  http://127.0.0.1:17997
Local Agent → Ollama   http://127.0.0.1:11434
```

The NAS should not initiate connections to a user's Local Agent. If server events are needed later, Desktop should open an outbound HTTPS/WebSocket connection to Backend.

## Development exception

For a private development machine, exposing a local model runtime to NAS can be allowed only temporarily with strict source-IP restrictions. This must not be used as the default distribution architecture.
