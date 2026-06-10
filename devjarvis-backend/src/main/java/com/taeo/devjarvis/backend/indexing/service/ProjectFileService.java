package com.taeo.devjarvis.backend.indexing.service;

import com.taeo.devjarvis.backend.indexing.domain.ProjectFile;
import com.taeo.devjarvis.backend.indexing.dto.ProjectFileManifestItemRequest;
import com.taeo.devjarvis.backend.indexing.dto.ProjectFileManifestRequest;
import com.taeo.devjarvis.backend.indexing.dto.ProjectFileManifestResponse;
import com.taeo.devjarvis.backend.indexing.dto.ProjectFileResponse;
import com.taeo.devjarvis.backend.indexing.repository.ProjectFileRepository;
import com.taeo.devjarvis.backend.project.domain.Project;
import com.taeo.devjarvis.backend.project.domain.ProjectStatus;
import com.taeo.devjarvis.backend.project.repository.ProjectRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class ProjectFileService {

    private static final Pattern WINDOWS_DRIVE_PATH_PATTERN = Pattern.compile("^[A-Za-z]:.*");
    private static final Set<String> SENSITIVE_EXTENSIONS = Set.of("pem", "key", "jks", "p12");
    private static final Set<String> SENSITIVE_NAME_KEYWORDS = Set.of("secret", "password", "token");
    private static final String SENSITIVE_FILE_PATTERN_REASON = "SENSITIVE_FILE_PATTERN";
    private static final String CLIENT_EXCLUDED_REASON = "CLIENT_EXCLUDED";

    private final ProjectRepository projectRepository;
    private final ProjectFileRepository projectFileRepository;

    public ProjectFileService(
            ProjectRepository projectRepository,
            ProjectFileRepository projectFileRepository
    ) {
        this.projectRepository = projectRepository;
        this.projectFileRepository = projectFileRepository;
    }

    @Transactional
    public ProjectFileManifestResponse registerManifest(Long projectId, ProjectFileManifestRequest request) {
        Project project = findActiveProject(projectId);
        List<NormalizedManifestItem> normalizedItems = normalizeAndValidate(request.files());

        Map<String, ProjectFile> existingByPath = projectFileRepository
                .findAllByProject_IdAndRelativePathIn(
                        projectId,
                        normalizedItems.stream().map(NormalizedManifestItem::relativePath).toList()
                )
                .stream()
                .collect(Collectors.toMap(ProjectFile::getRelativePath, projectFile -> projectFile));

        List<ProjectFile> filesToSave = new ArrayList<>();
        for (NormalizedManifestItem item : normalizedItems) {
            ProjectFile existing = existingByPath.get(item.relativePath());
            if (existing == null) {
                filesToSave.add(ProjectFile.create(
                        project,
                        item.relativePath(),
                        item.fileName(),
                        item.extension(),
                        item.language(),
                        item.sizeBytes(),
                        item.sha256(),
                        item.excluded(),
                        item.excludedReason()
                ));
            } else {
                existing.updateMetadata(
                        item.fileName(),
                        item.extension(),
                        item.language(),
                        item.sizeBytes(),
                        item.sha256(),
                        item.excluded(),
                        item.excludedReason()
                );
                filesToSave.add(existing);
            }
        }

        projectFileRepository.saveAll(filesToSave);

        int excludedFileCount = (int) normalizedItems.stream().filter(NormalizedManifestItem::excluded).count();
        int targetFileCount = normalizedItems.size() - excludedFileCount;

        return new ProjectFileManifestResponse(
                projectId,
                normalizedItems.size(),
                filesToSave.size(),
                targetFileCount,
                excludedFileCount
        );
    }

    @Transactional(readOnly = true)
    public List<ProjectFileResponse> findFiles(Long projectId) {
        findActiveProject(projectId);
        return projectFileRepository.findAllByProject_IdOrderByRelativePathAsc(projectId)
                .stream()
                .map(ProjectFileResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProjectFileResponse findFile(Long projectId, Long fileId) {
        findActiveProject(projectId);
        ProjectFile projectFile = projectFileRepository.findByIdAndProject_Id(fileId, projectId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "프로젝트 파일을 찾을 수 없습니다. projectId=" + projectId + ", fileId=" + fileId
                ));
        return ProjectFileResponse.from(projectFile);
    }

    private Project findActiveProject(Long projectId) {
        return projectRepository.findById(projectId)
                .filter(project -> project.getStatus() == ProjectStatus.ACTIVE)
                .orElseThrow(() -> new IllegalArgumentException("프로젝트를 찾을 수 없습니다. projectId=" + projectId));
    }

    private List<NormalizedManifestItem> normalizeAndValidate(List<ProjectFileManifestItemRequest> files) {
        Set<String> seenPaths = new HashSet<>();
        List<NormalizedManifestItem> normalizedItems = new ArrayList<>(files.size());

        for (ProjectFileManifestItemRequest file : files) {
            NormalizedManifestItem normalizedItem = normalizeAndValidate(file);
            if (!seenPaths.add(normalizedItem.relativePath())) {
                throw new IllegalArgumentException("중복된 상대 경로가 manifest에 포함되어 있습니다: " + normalizedItem.relativePath());
            }
            normalizedItems.add(normalizedItem);
        }

        return normalizedItems;
    }

    private NormalizedManifestItem normalizeAndValidate(ProjectFileManifestItemRequest file) {
        String relativePath = normalizeRelativePath(file.relativePath());
        String fileName = normalizeRequired(file.fileName(), "파일명");
        validateFileNameMatchesRelativePath(relativePath, fileName);

        String extension = normalizeExtension(file.extension());
        String language = normalizeBlankToDefault(file.language(), "unknown").toLowerCase(Locale.ROOT);
        String sha256 = normalizeBlankToNull(file.sha256());

        boolean clientExcluded = Boolean.TRUE.equals(file.excluded());
        boolean sensitive = isSensitiveFile(relativePath, fileName, extension);
        boolean excluded = clientExcluded || sensitive;
        String excludedReason = resolveExcludedReason(excluded, sensitive, file.excludedReason());

        return new NormalizedManifestItem(
                relativePath,
                fileName,
                extension,
                language,
                file.sizeBytes(),
                sha256,
                excluded,
                excludedReason
        );
    }

    private String normalizeRelativePath(String value) {
        String normalized = normalizeRequired(value, "상대 경로").replace('\\', '/');

        if (normalized.startsWith("/")
                || normalized.startsWith("//")
                || normalized.startsWith("~")
                || WINDOWS_DRIVE_PATH_PATTERN.matcher(normalized).matches()) {
            throw new IllegalArgumentException("상대 경로만 등록할 수 있습니다: " + value);
        }

        String[] segments = normalized.split("/", -1);
        for (String segment : segments) {
            if (segment.isBlank() || ".".equals(segment) || "..".equals(segment)) {
                throw new IllegalArgumentException("허용되지 않는 상대 경로입니다: " + value);
            }
        }

        return normalized;
    }

    private void validateFileNameMatchesRelativePath(String relativePath, String fileName) {
        int lastSeparatorIndex = relativePath.lastIndexOf('/');
        String expectedFileName = lastSeparatorIndex < 0 ? relativePath : relativePath.substring(lastSeparatorIndex + 1);
        if (!expectedFileName.equals(fileName)) {
            throw new IllegalArgumentException(
                    "relativePath의 마지막 파일명과 fileName이 일치해야 합니다: " + relativePath
            );
        }
    }

    private String normalizeExtension(String value) {
        String extension = normalizeBlankToDefault(value, "");
        if (extension.startsWith(".")) {
            extension = extension.substring(1);
        }
        return extension.toLowerCase(Locale.ROOT);
    }

    private String normalizeRequired(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + "은(는) 필수입니다.");
        }
        return value.trim();
    }

    private String normalizeBlankToDefault(String value, String defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        return value.trim();
    }

    private String normalizeBlankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private boolean isSensitiveFile(String relativePath, String fileName, String extension) {
        String lowerRelativePath = relativePath.toLowerCase(Locale.ROOT);
        String lowerFileName = fileName.toLowerCase(Locale.ROOT);
        if (".env".equals(lowerFileName) || lowerFileName.startsWith(".env.")) {
            return true;
        }
        if (SENSITIVE_EXTENSIONS.contains(extension)) {
            return true;
        }
        return SENSITIVE_NAME_KEYWORDS.stream().anyMatch(keyword -> lowerRelativePath.contains(keyword));
    }

    private String resolveExcludedReason(boolean excluded, boolean sensitive, String requestedExcludedReason) {
        if (!excluded) {
            return null;
        }
        if (sensitive) {
            return SENSITIVE_FILE_PATTERN_REASON;
        }
        String reason = normalizeBlankToNull(requestedExcludedReason);
        return reason == null ? CLIENT_EXCLUDED_REASON : reason;
    }

    private record NormalizedManifestItem(
            String relativePath,
            String fileName,
            String extension,
            String language,
            Long sizeBytes,
            String sha256,
            boolean excluded,
            String excludedReason
    ) {
    }
}
