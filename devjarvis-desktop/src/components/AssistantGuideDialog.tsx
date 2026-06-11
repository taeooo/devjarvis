type AssistantGuideDialogProps = {
  onClose: () => void;
};

const screenExamples = [
  '이 화면 왜 그런거야?',
  '현재 화면 분석해줘',
  '지금 보고 있는 화면 번역해줘',
  '이 화면 계산해줘',
];

const textExamples = [
  '이 에러 원인 분석해줘',
  '아래 로그 보고 해결 방법 알려줘',
];

const projectExamples = [
  '현재 프로젝트 구조 분석해줘',
  '다음에 수정할 파일 알려줘',
];

export function AssistantGuideDialog({ onClose }: AssistantGuideDialogProps) {
  return (
    <div className="guide-overlay" role="presentation" onClick={onClose}>
      <section
        className="guide-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assistant-guide-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="guide-header">
          <div>
            <span className="panel-kicker">Guide</span>
            <h2 id="assistant-guide-title">DevJarvis 사용법</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="사용법 닫기">
            닫기
          </button>
        </div>

        <div className="guide-body">
          <GuideSection
            title="화면 분석"
            description="화면 관련 명령을 입력하면 Windows 공유 선택창이 열립니다. 분석할 창을 직접 선택한 뒤 공유를 눌러주세요."
            examples={screenExamples}
          />

          <GuideSection
            title="텍스트 / 에러 분석"
            description="에러 메시지나 로그를 입력창에 붙여넣고 원인 분석을 요청할 수 있습니다."
            examples={textExamples}
          />

          <GuideSection
            title="프로젝트 분석"
            description="Project를 먼저 선택한 뒤 프로젝트 구조나 다음 수정 방향을 물어볼 수 있습니다."
            examples={projectExamples}
          />

          <section className="guide-section guide-section-muted">
            <h3>음성 명령</h3>
            <p>현재 버전은 채팅 입력 중심입니다. 마이크 기반 음성 명령은 이후 버전에서 지원할 예정입니다.</p>
          </section>

          <section className="guide-section guide-section-safe">
            <h3>보안 안내</h3>
            <p>화면 이미지는 선택한 창/화면만 사용합니다. 민감정보 보호를 위해 전체 모니터를 자동 캡처하지 않습니다.</p>
          </section>
        </div>
      </section>
    </div>
  );
}

type GuideSectionProps = {
  title: string;
  description: string;
  examples: string[];
};

function GuideSection({ title, description, examples }: GuideSectionProps) {
  return (
    <section className="guide-section">
      <h3>{title}</h3>
      <p>{description}</p>
      <ul>
        {examples.map((example) => (
          <li key={example}>{example}</li>
        ))}
      </ul>
    </section>
  );
}
