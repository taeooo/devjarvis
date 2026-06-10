package com.taeo.devjarvis.backend.indexing.repository;

import com.taeo.devjarvis.backend.indexing.domain.ProjectFile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ProjectFileRepository extends JpaRepository<ProjectFile, Long> {

    List<ProjectFile> findAllByProject_IdOrderByRelativePathAsc(Long projectId);

    Optional<ProjectFile> findByIdAndProject_Id(Long id, Long projectId);

    List<ProjectFile> findAllByProject_IdAndRelativePathIn(Long projectId, Collection<String> relativePaths);

    long countByProject_Id(Long projectId);

    long countByProject_IdAndExcludedFalse(Long projectId);
}
