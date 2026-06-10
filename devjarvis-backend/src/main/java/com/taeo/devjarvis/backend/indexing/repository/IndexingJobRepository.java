package com.taeo.devjarvis.backend.indexing.repository;

import com.taeo.devjarvis.backend.indexing.domain.IndexingJob;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface IndexingJobRepository extends JpaRepository<IndexingJob, Long> {

    List<IndexingJob> findAllByProject_IdOrderByCreatedAtDesc(Long projectId);

    Optional<IndexingJob> findByIdAndProject_Id(Long id, Long projectId);
}
