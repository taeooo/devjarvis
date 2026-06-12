package com.taeo.devjarvis.backend.project.service;

import com.taeo.devjarvis.backend.project.domain.Project;
import com.taeo.devjarvis.backend.project.domain.ProjectStatus;
import com.taeo.devjarvis.backend.project.dto.ProjectCreateRequest;
import com.taeo.devjarvis.backend.project.repository.ProjectRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProjectServiceTest {

    private final ProjectRepository projectRepository = mock(ProjectRepository.class);
    private final ProjectService projectService = new ProjectService(projectRepository);

    @Test
    void createReturnsExistingProjectWhenRootPathAliasAlreadyExists() {
        Project existing = Project.create("devjarvis", "LOCAL_PROJECT::devjarvis", null);
        when(projectRepository.findFirstByRootPathAliasAndStatus("LOCAL_PROJECT::devjarvis", ProjectStatus.ACTIVE))
                .thenReturn(Optional.of(existing));

        var response = projectService.create(new ProjectCreateRequest(
                "devjarvis",
                "LOCAL_PROJECT::devjarvis",
                null
        ));

        assertThat(response.name()).isEqualTo("devjarvis");
        verify(projectRepository, never()).save(any(Project.class));
    }

    @Test
    void createReturnsExistingProjectWhenNameAlreadyExists() {
        Project existing = Project.create("devjarvis", "LOCAL_PROJECT::devjarvis", null);
        when(projectRepository.findFirstByRootPathAliasAndStatus("LOCAL_PROJECT::other", ProjectStatus.ACTIVE))
                .thenReturn(Optional.empty());
        when(projectRepository.findFirstByNameIgnoreCaseAndStatus("devjarvis", ProjectStatus.ACTIVE))
                .thenReturn(Optional.of(existing));

        var response = projectService.create(new ProjectCreateRequest(
                "devjarvis",
                "LOCAL_PROJECT::other",
                null
        ));

        assertThat(response.name()).isEqualTo("devjarvis");
        verify(projectRepository, never()).save(any(Project.class));
    }
}
