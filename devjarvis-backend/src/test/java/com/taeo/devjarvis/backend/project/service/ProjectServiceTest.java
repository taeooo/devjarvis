package com.taeo.devjarvis.backend.project.service;

import com.taeo.devjarvis.backend.project.domain.Project;
import com.taeo.devjarvis.backend.project.domain.ProjectStatus;
import com.taeo.devjarvis.backend.project.dto.ProjectCreateRequest;
import com.taeo.devjarvis.backend.project.dto.ProjectResponse;
import com.taeo.devjarvis.backend.project.repository.ProjectRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProjectServiceTest {

    @Test
    void createReturnsExistingProjectWhenRootPathAliasAlreadyRegistered() {
        ProjectRepository repository = mock(ProjectRepository.class);
        Project existing = Project.create("devjarvis", "alias-001", "existing");
        when(repository.findFirstByRootPathAliasAndStatus("alias-001", ProjectStatus.ACTIVE))
                .thenReturn(Optional.of(existing));

        ProjectService service = new ProjectService(repository);
        ProjectResponse response = service.create(new ProjectCreateRequest(
                "devjarvis",
                "alias-001",
                "new request"
        ));

        assertEquals("devjarvis", response.name());
        assertEquals("alias-001", response.rootPathAlias());
        verify(repository, never()).save(any(Project.class));
    }

    @Test
    void createRejectsSameNameWithDifferentRootPathAlias() {
        ProjectRepository repository = mock(ProjectRepository.class);
        Project existing = Project.create("devjarvis", "alias-001", "existing");
        when(repository.findFirstByRootPathAliasAndStatus("alias-002", ProjectStatus.ACTIVE))
                .thenReturn(Optional.empty());
        when(repository.findByNameIgnoreCase("devjarvis"))
                .thenReturn(Optional.of(existing));

        ProjectService service = new ProjectService(repository);
        IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> service.create(new ProjectCreateRequest("devjarvis", "alias-002", null))
        );

        assertEquals("PROJECT_NAME_CONFLICT", exception.getMessage());
        verify(repository, never()).save(any(Project.class));
    }
}
