package com.taeo.devjarvis.backend.indexing.domain;

import com.taeo.devjarvis.backend.project.domain.Project;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

@Entity
@Table(name = "dev_indexing_jobs")
public class IndexingJob {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private IndexingJobStatus status;

    @Column(name = "requested_file_count", nullable = false)
    private int requestedFileCount;

    @Column(name = "target_file_count", nullable = false)
    private int targetFileCount;

    @Column(name = "processed_file_count", nullable = false)
    private int processedFileCount;

    @Column(name = "failed_file_count", nullable = false)
    private int failedFileCount;

    @Column(name = "total_chunk_count", nullable = false)
    private int totalChunkCount;

    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;

    @Column(name = "started_at")
    private OffsetDateTime startedAt;

    @Column(name = "finished_at")
    private OffsetDateTime finishedAt;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected IndexingJob() {
    }

    private IndexingJob(Project project, int requestedFileCount, int targetFileCount) {
        this.project = project;
        this.status = IndexingJobStatus.PENDING;
        this.requestedFileCount = requestedFileCount;
        this.targetFileCount = targetFileCount;
        this.processedFileCount = 0;
        this.failedFileCount = 0;
        this.totalChunkCount = 0;
    }

    public static IndexingJob createPending(Project project, int requestedFileCount, int targetFileCount) {
        return new IndexingJob(project, requestedFileCount, targetFileCount);
    }

    @PrePersist
    void prePersist() {
        OffsetDateTime now = OffsetDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.status == null) {
            this.status = IndexingJobStatus.PENDING;
        }
    }

    @PreUpdate
    void preUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public Project getProject() {
        return project;
    }

    public Long getProjectId() {
        return project.getId();
    }

    public IndexingJobStatus getStatus() {
        return status;
    }

    public int getRequestedFileCount() {
        return requestedFileCount;
    }

    public int getTargetFileCount() {
        return targetFileCount;
    }

    public int getProcessedFileCount() {
        return processedFileCount;
    }

    public int getFailedFileCount() {
        return failedFileCount;
    }

    public int getTotalChunkCount() {
        return totalChunkCount;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public OffsetDateTime getStartedAt() {
        return startedAt;
    }

    public OffsetDateTime getFinishedAt() {
        return finishedAt;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }
}
