package com.taeo.devjarvis.backend.project.repository;

import com.taeo.devjarvis.backend.project.domain.Project;
import com.taeo.devjarvis.backend.project.domain.ProjectStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProjectRepository extends JpaRepository<Project, Long> {

    Optional<Project> findByNameIgnoreCase(String name);

    Optional<Project> findFirstByRootPathAliasAndStatus(String rootPathAlias, ProjectStatus status);

    List<Project> findAllByStatusOrderByCreatedAtDesc(ProjectStatus status);
}
