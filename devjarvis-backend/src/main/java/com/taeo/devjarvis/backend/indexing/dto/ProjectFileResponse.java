package com.taeo.devjarvis.backend.indexing.dto;

import com.taeo.devjarvis.backend.indexing.domain.FileIndexingStatus;
import com.taeo.devjarvis.backend.indexing.domain.ProjectFile;

import java.time.OffsetDateTime;

public record ProjectFileResponse(
        Long id,
        Long projectId,
        String relativePath,
        String fileName,
        String extension,
        String language,
        Long sizeBytes,
        String sha256,
        FileIndexingStatus indexingStatus,
        boolean excluded,
        String excludedReason,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
    public static ProjectFileResponse from(ProjectFile projectFile) {
        return new ProjectFileResponse(
                projectFile.getId(),
                projectFile.getProjectId(),
                projectFile.getRelativePath(),
                projectFile.getFileName(),
                projectFile.getExtension(),
                projectFile.getLanguage(),
                projectFile.getSizeBytes(),
                projectFile.getSha256(),
                projectFile.getIndexingStatus(),
                projectFile.isExcluded(),
                projectFile.getExcludedReason(),
                projectFile.getCreatedAt(),
                projectFile.getUpdatedAt()
        );
    }
}
