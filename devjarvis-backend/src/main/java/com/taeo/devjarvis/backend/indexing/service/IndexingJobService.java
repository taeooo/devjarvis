package com.taeo.devjarvis.backend.indexing.service;

import com.taeo.devjarvis.backend.indexing.domain.IndexingJob;
import com.taeo.devjarvis.backend.indexing.dto.IndexingJobResponse;
import com.taeo.devjarvis.backend.indexing.repository.IndexingJobRepository;
import com.taeo.devjarvis.backend.indexing.repository.ProjectFileRepository;
import com.taeo.devjarvis.backend.project.domain.Project;
import com.taeo.devjarvis.backend.project.domain.ProjectStatus;
import com.taeo.devjarvis.backend.project.repository.ProjectRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class IndexingJobService {

    private final ProjectRepository projectRepository;
    private final ProjectFileRepository projectFileRepository;
    private final IndexingJobRepository indexingJobRepository;

    public IndexingJobService(
            ProjectRepository projectRepository,
            ProjectFileRepository projectFileRepository,
            IndexingJobRepository indexingJobRepository
    ) {
        this.projectRepository = projectRepository;
        this.projectFileRepository = projectFileRepository;
        this.indexingJobRepository = indexingJobRepository;
    }

    @Transactional
    public IndexingJobResponse create(Long projectId) {
        Project project = findActiveProject(projectId);
        int requestedFileCount = toIntCount(projectFileRepository.countByProject_Id(projectId));
        int targetFileCount = toIntCount(projectFileRepository.countByProject_IdAndExcludedFalse(projectId));

        IndexingJob indexingJob = IndexingJob.createPending(project, requestedFileCount, targetFileCount);
        return IndexingJobResponse.from(indexingJobRepository.save(indexingJob));
    }

    @Transactional(readOnly = true)
    public List<IndexingJobResponse> findJobs(Long projectId) {
        findActiveProject(projectId);
        return indexingJobRepository.findAllByProject_IdOrderByCreatedAtDesc(projectId)
                .stream()
                .map(IndexingJobResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public IndexingJobResponse findJob(Long projectId, Long jobId) {
        findActiveProject(projectId);
        IndexingJob indexingJob = indexingJobRepository.findByIdAndProject_Id(jobId, projectId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "인덱싱 작업을 찾을 수 없습니다. projectId=" + projectId + ", jobId=" + jobId
                ));
        return IndexingJobResponse.from(indexingJob);
    }

    private Project findActiveProject(Long projectId) {
        return projectRepository.findById(projectId)
                .filter(project -> project.getStatus() == ProjectStatus.ACTIVE)
                .orElseThrow(() -> new IllegalArgumentException("프로젝트를 찾을 수 없습니다. projectId=" + projectId));
    }

    private int toIntCount(long value) {
        if (value > Integer.MAX_VALUE) {
            throw new IllegalArgumentException("파일 수가 허용 범위를 초과했습니다: " + value);
        }
        return (int) value;
    }
}
