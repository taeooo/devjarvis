package com.taeo.devjarvis.backend.project.dto;

import com.taeo.devjarvis.backend.project.domain.Project;
import com.taeo.devjarvis.backend.project.domain.ProjectStatus;

import java.time.OffsetDateTime;

public record ProjectResponse(
        Long id,
        String name,
        String rootPathAlias,
        String description,
        ProjectStatus status,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
    public static ProjectResponse from(Project project) {
        return new ProjectResponse(
                project.getId(),
                project.getName(),
                project.getRootPathAlias(),
                project.getDescription(),
                project.getStatus(),
                project.getCreatedAt(),
                project.getUpdatedAt()
        );
    }
}
