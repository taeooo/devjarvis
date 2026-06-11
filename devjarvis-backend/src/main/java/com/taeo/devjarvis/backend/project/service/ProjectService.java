package com.taeo.devjarvis.backend.project.service;

import com.taeo.devjarvis.backend.project.domain.Project;
import com.taeo.devjarvis.backend.project.domain.ProjectStatus;
import com.taeo.devjarvis.backend.project.dto.ProjectCreateRequest;
import com.taeo.devjarvis.backend.project.dto.ProjectResponse;
import com.taeo.devjarvis.backend.project.repository.ProjectRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

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

        Optional<Project> existingByAlias = normalizedRootPathAlias == null
                ? Optional.empty()
                : projectRepository.findFirstByRootPathAliasAndStatus(normalizedRootPathAlias, ProjectStatus.ACTIVE);
        if (existingByAlias.isPresent()) {
            return ProjectResponse.from(existingByAlias.get());
        }

        Optional<Project> existingByName = projectRepository.findByNameIgnoreCase(normalizedName);
        if (existingByName.isPresent()) {
            Project existing = existingByName.get();
            if (existing.getStatus() == ProjectStatus.ACTIVE
                    && Objects.equals(existing.getRootPathAlias(), normalizedRootPathAlias)) {
                return ProjectResponse.from(existing);
            }
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
