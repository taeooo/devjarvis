package com.taeo.devjarvis.backend.project.service;

import com.taeo.devjarvis.backend.project.domain.Project;
import com.taeo.devjarvis.backend.project.domain.ProjectStatus;
import com.taeo.devjarvis.backend.project.dto.ProjectCreateRequest;
import com.taeo.devjarvis.backend.project.dto.ProjectResponse;
import com.taeo.devjarvis.backend.project.repository.ProjectRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ProjectService {

    private final ProjectRepository projectRepository;

    public ProjectService(ProjectRepository projectRepository) {
        this.projectRepository = projectRepository;
    }

    @Transactional
    public ProjectResponse create(ProjectCreateRequest request) {
        String normalizedName = request.name().trim();
        String normalizedRootPathAlias = normalizeBlankToNull(request.rootPathAlias());

        if (normalizedRootPathAlias != null) {
            Project existing = projectRepository
                    .findFirstByRootPathAliasAndStatus(normalizedRootPathAlias, ProjectStatus.ACTIVE)
                    .orElse(null);
            if (existing != null) {
                return ProjectResponse.from(existing);
            }
        }

        Project existingByName = projectRepository
                .findFirstByNameIgnoreCaseAndStatus(normalizedName, ProjectStatus.ACTIVE)
                .orElse(null);
        if (existingByName != null) {
            return ProjectResponse.from(existingByName);
        }

        if (projectRepository.existsByNameIgnoreCase(normalizedName)) {
            throw new IllegalArgumentException("PROJECT_NAME_CONFLICT");
        }

        Project project = Project.create(
                normalizedName,
                normalizedRootPathAlias,
                normalizeBlankToNull(request.description())
        );

        return ProjectResponse.from(projectRepository.save(project));
    }

    @Transactional(readOnly = true)
    public List<ProjectResponse> findActiveProjects() {
        return projectRepository.findAllByStatusOrderByCreatedAtDesc(ProjectStatus.ACTIVE)
                .stream()
                .map(ProjectResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProjectResponse findById(Long projectId) {
        Project project = projectRepository.findById(projectId)
                .filter(found -> found.getStatus() == ProjectStatus.ACTIVE)
                .orElseThrow(() -> new IllegalArgumentException("프로젝트를 찾을 수 없습니다. projectId=" + projectId));

        return ProjectResponse.from(project);
    }

    private String normalizeBlankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
