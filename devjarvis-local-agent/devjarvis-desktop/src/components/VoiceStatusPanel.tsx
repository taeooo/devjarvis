import type { VoiceState } from "../types/jarvisCommand";
import type { MicrophonePermissionSnapshot } from "../utils/localAudioCapture";

type VoiceStatusPanelProps = {
  micAvailable: boolean | null;
  voiceState: VoiceState;
  disabled?: boolean;
  pendingScreenCommand?: boolean;
  wakeStatusMessage?: string;
  microphonePermission?: MicrophonePermissionSnapshot | null;
  hasKoreanVoice?: boolean;
  localTtsAvailable?: boolean;
  localTtsWarning?: string | null;
  wakeDiagnosticMessage?: string | null;
  onManualVoiceInput: () => void;
  onCheckMicrophone?: () => void;
  onSelectPendingScreen?: () => void;
};

export function VoiceStatusPanel({
  micAvailable,
  voiceState,
  disabled = false,
  pendingScreenCommand = false,
  wakeStatusMessage = "음성 호출 확인 중",
  microphonePermission = null,
  hasKoreanVoice = true,
  localTtsAvailable = false,
  localTtsWarning = null,
  wakeDiagnosticMessage = null,
  onManualVoiceInput,
  onCheckMicrophone,
  onSelectPendingScreen,
}: VoiceStatusPanelProps) {
  const permissionState = microphonePermission?.state ?? "unknown";
  const permissionNeedsAction =
    permissionState === "prompt" ||
    permissionState === "denied" ||
    permissionState === "unsupported" ||
    microphonePermission?.hasAudioInput === false;
  const isUnavailable =
    micAvailable === false ||
    voiceState === "unavailable" ||
    permissionState === "denied" ||
    permissionState === "unsupported";
  const buttonDisabled =
    disabled ||
    isUnavailable ||
    voiceState === "processing" ||
    voiceState === "recording" ||
    voiceState === "speaking";
  const canSelectPendingScreen =
    pendingScreenCommand && Boolean(onSelectPendingScreen) && !disabled;

  return (
    <section
      className={`glass-card voice-card voice-${voiceState}`}
      aria-label="Voice status"
    >
      <div className="card-heading-row">
        <span className="panel-kicker">Voice</span>
        <span
          className={`state-chip ${resolveVoiceChipClass(voiceState, pendingScreenCommand, permissionNeedsAction)}`}
        >
          {formatVoiceState(
            voiceState,
            pendingScreenCommand,
            permissionNeedsAction,
          )}
        </span>
      </div>
      <div className="voice-meter voice-meter-disabled" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      {pendingScreenCommand ? (
        <button
          className="voice-push-button voice-screen-select-button"
          type="button"
          disabled={!canSelectPendingScreen}
          onClick={onSelectPendingScreen}
        >
          화면 선택
        </button>
      ) : permissionNeedsAction ? (
        <button
          className="voice-push-button"
          type="button"
          disabled={disabled || !onCheckMicrophone}
          onClick={onCheckMicrophone}
        >
          마이크 확인
        </button>
      ) : (
        <button
          className="voice-push-button"
          type="button"
          disabled={buttonDisabled}
          onClick={onManualVoiceInput}
        >
          수동 음성 입력
        </button>
      )}
      <p className="voice-note">
        {pendingScreenCommand
          ? "음성 명령을 인식했습니다. 화면 선택 버튼을 눌러 공유 창을 열어주세요."
          : buildVoiceNote(
              permissionNeedsAction,
              wakeStatusMessage,
              localTtsAvailable,
            )}
      </p>
      {!localTtsAvailable && (
        <p className="voice-note voice-note-warning">
          {formatLocalTtsWarning(localTtsWarning)}
        </p>
      )}
      {wakeDiagnosticMessage && !permissionNeedsAction && (
        <p className="voice-note voice-note-diagnostic">
          {wakeDiagnosticMessage}
        </p>
      )}
      {!hasKoreanVoice && !localTtsAvailable && (
        <p className="voice-note voice-note-warning">
          기본 음성에 한국어 음성이 없어 품질이 낮을 수 있습니다. 고품질 로컬
          TTS를 설정하면 이 안내는 사라집니다.
        </p>
      )}
      <div className="compact-stat-row">
        <span>Input</span>
        <strong>
          {formatInputState(
            micAvailable,
            voiceState,
            pendingScreenCommand,
            wakeStatusMessage,
            microphonePermission,
          )}
        </strong>
      </div>
    </section>
  );
}

function resolveVoiceChipClass(
  state: VoiceState,
  pendingScreenCommand: boolean,
  permissionNeedsAction: boolean,
): string {
  if (pendingScreenCommand) return "state-active";
  if (permissionNeedsAction) return "state-warning";
  if (
    state === "processing" ||
    state === "recording" ||
    state === "speaking" ||
    state === "wake_listening"
  )
    return "state-active";
  if (state === "error" || state === "unavailable") return "state-warning";
  return "state-idle";
}

function formatVoiceState(
  state: VoiceState,
  pendingScreenCommand: boolean,
  permissionNeedsAction: boolean,
): string {
  if (pendingScreenCommand) return "화면 선택 필요";
  if (permissionNeedsAction) return "마이크 확인 필요";

  switch (state) {
    case "wake_listening":
      return "호출 감지 중";
    case "recording":
      return "듣는 중";
    case "processing":
      return "명령 인식 중";
    case "speaking":
      return "응답 중";
    case "text_ready":
      return "명령 인식됨";
    case "error":
      return "확인 필요";
    case "unavailable":
      return "마이크 없음";
    case "idle":
      return "호출 대기";
  }
}

function formatInputState(
  micAvailable: boolean | null,
  state: VoiceState,
  pendingScreenCommand: boolean,
  wakeStatusMessage: string,
  microphonePermission: MicrophonePermissionSnapshot | null,
): string {
  if (pendingScreenCommand) return "화면 선택 대기";
  if (microphonePermission?.hasAudioInput === false) return "마이크 없음";
  if (microphonePermission?.state === "denied") return "권한 차단됨";
  if (microphonePermission?.state === "prompt") return "권한 확인 필요";
  if (micAvailable === null) return "장치 확인 중";
  if (micAvailable === false || state === "unavailable") return "텍스트 입력";
  if (state === "wake_listening") return "호출 대기";
  if (state === "recording") return "말씀해주세요";
  if (state === "processing") return "음성 인식 중";
  if (state === "speaking") return "음성 응답 중";
  return wakeStatusMessage;
}

function buildVoiceNote(
  permissionNeedsAction: boolean,
  wakeStatusMessage: string,
  localTtsAvailable: boolean,
): string {
  if (permissionNeedsAction) {
    return "마이크 권한과 장치 상태를 먼저 확인해주세요. 권한이 이미 허용된 경우 새 권한 창은 뜨지 않을 수 있습니다.";
  }
  if (localTtsAvailable) {
    return `마이크는 로컬에서만 사용됩니다. 현재 상태: ${wakeStatusMessage}`;
  }
  return `마이크는 로컬에서만 사용됩니다. 현재 상태: ${wakeStatusMessage}`;
}


function formatLocalTtsWarning(warning: string | null): string {
  if (!warning) {
    return "고품질 로컬 음성은 아직 준비되지 않았습니다. 음성 호출은 계속 동작하며, 응답은 기본 음성으로 재생됩니다.";
  }
  if (warning.includes('reference') || warning.includes('prompt') || warning.includes('voice')) {
    return "고품질 음성은 남성 reference WAV와 문장 txt가 필요합니다. 준비 전에는 기본 음성으로 응답합니다.";
  }
  if (warning.includes('model')) {
    return "고품질 음성 모델을 찾지 못했습니다. 준비 전에는 기본 음성으로 응답합니다.";
  }
  if (warning.includes('runtime') || warning.includes('repo')) {
    return "고품질 음성 런타임 설정이 필요합니다. 준비 전에는 기본 음성으로 응답합니다.";
  }
  return "고품질 로컬 음성은 아직 준비되지 않았습니다. 음성 호출은 계속 동작하며, 응답은 기본 음성으로 재생됩니다.";
}
