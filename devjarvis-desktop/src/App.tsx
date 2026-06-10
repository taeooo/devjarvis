import { useMemo, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { backendBaseUrl, createProject, registerProjectManifest } from './api/backendClient';
import type { ProjectResponse, ProjectScanResult } from './types/projectScanner';

const PREVIEW_LIMIT = 80;

function App() {
  const [scanResult, setScanResult] = useState<ProjectScanResult | null>(null);
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [projectName, setProjectName] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewFiles = useMemo(() => scanResult?.files.slice(0, PREVIEW_LIMIT) ?? [], [scanResult]);

  async function handleSelectAndScan() {
    setMessage(null);
    setError(null);
    setProject(null);

    const selected = await open({
      directory: true,
      multiple: false,
      title: '인덱싱할 프로젝트 폴더 선택',
    });

    if (typeof selected !== 'string') {
      return;
    }

    setIsScanning(true);
    try {
      const result = await invoke<ProjectScanResult>('scan_project_manifest', { rootPath: selected });
      setScanResult(result);
      setProjectName(result.rootName || 'DevJarvis Project');
      setMessage('프로젝트 폴더 스캔이 완료되었습니다. 민감 파일은 기본 제외 처리됩니다.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsScanning(false);
    }
  }

  async function handleCreateProjectAndRegisterManifest() {
    if (!scanResult) {
      setError('먼저 프로젝트 폴더를 선택하고 스캔해주세요.');
      return;
    }

    if (!projectName.trim()) {
      setError('프로젝트명은 필수입니다.');
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const created = await createProject({
        name: projectName.trim(),
        rootPathAlias: scanResult.rootPathAlias,
        description: 'Registered from DevJarvis Desktop project scanner foundation.',
      });
      await registerProjectManifest(created.id, scanResult.files);
      setProject(created);
      setMessage(`프로젝트와 manifest 등록이 완료되었습니다. projectId=${created.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">DevJarvis Desktop</p>
          <h1>Project Scanner Foundation</h1>
          <p className="description">
            로컬 프로젝트 폴더를 스캔해 파일 manifest를 만들고, Backend API로 메타데이터만 등록합니다.
            실제 파일 내용과 OS 절대경로는 Backend로 전송하지 않습니다.
          </p>
        </div>
        <button className="primary-button" onClick={handleSelectAndScan} disabled={isScanning || isSubmitting}>
          {isScanning ? '스캔 중...' : '프로젝트 폴더 선택'}
        </button>
      </section>

      <section className="panel grid-panel">
        <div>
          <h2>Backend 연결</h2>
          <p className="mono-text">{backendBaseUrl}</p>
        </div>
        <div>
          <h2>빌드 방향</h2>
          <p>Windows/macOS 모두 Tauri native bundle 대상으로 구성했습니다.</p>
        </div>
      </section>

      {message && <div className="notice success">{message}</div>}
      {error && <div className="notice error">{error}</div>}

      {scanResult && (
        <section className="panel">
          <div className="section-header">
            <div>
              <h2>스캔 결과</h2>
              <p className="muted">로컬 표시 경로: {scanResult.rootPathDisplay}</p>
              <p className="muted">Backend 저장 별칭: {scanResult.rootPathAlias}</p>
            </div>
          </div>

          <div className="stats-grid">
            <Stat label="전체 파일" value={scanResult.summary.requestedFileCount} />
            <Stat label="인덱싱 대상" value={scanResult.summary.targetFileCount} />
            <Stat label="제외 파일" value={scanResult.summary.excludedFileCount} />
            <Stat label="민감 파일" value={scanResult.summary.sensitiveFileCount} />
            <Stat label="대용량 파일" value={scanResult.summary.largeFileCount} />
            <Stat label="도구/생성물" value={scanResult.summary.generatedOrToolingFileCount} />
          </div>

          <div className="form-row">
            <label htmlFor="projectName">프로젝트명</label>
            <input
              id="projectName"
              value={projectName}
              maxLength={100}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="프로젝트명을 입력하세요"
            />
            <button onClick={handleCreateProjectAndRegisterManifest} disabled={isSubmitting || isScanning}>
              {isSubmitting ? '등록 중...' : 'Backend에 프로젝트 + manifest 등록'}
            </button>
          </div>

          {project && (
            <div className="notice success">
              등록된 프로젝트: {project.name} / projectId={project.id}
            </div>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>상대 경로</th>
                  <th>언어</th>
                  <th>크기</th>
                  <th>상태</th>
                  <th>제외 사유</th>
                </tr>
              </thead>
              <tbody>
                {previewFiles.map((file) => (
                  <tr key={file.relativePath}>
                    <td className="path-cell">{file.relativePath}</td>
                    <td>{file.language}</td>
                    <td>{file.sizeBytes.toLocaleString()} B</td>
                    <td>{file.excluded ? 'EXCLUDED' : 'PENDING'}</td>
                    <td>{file.excludedReason ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {scanResult.files.length > PREVIEW_LIMIT && (
            <p className="muted">미리보기는 최대 {PREVIEW_LIMIT}개까지만 표시합니다.</p>
          )}
        </section>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </div>
  );
}

export default App;
