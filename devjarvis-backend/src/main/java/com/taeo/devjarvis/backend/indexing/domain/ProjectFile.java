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
import jakarta.persistence.UniqueConstraint;

import java.time.OffsetDateTime;

@Entity
@Table(
        name = "dev_project_files",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_dev_project_files_project_relative_path",
                        columnNames = {"project_id", "relative_path"}
                )
        }
)
public class ProjectFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Column(name = "relative_path", nullable = false, length = 1000)
    private String relativePath;

    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;

    @Column(nullable = false, length = 50)
    private String extension;

    @Column(nullable = false, length = 50)
    private String language;

    @Column(name = "size_bytes", nullable = false)
    private Long sizeBytes;

    @Column(length = 128)
    private String sha256;

    @Enumerated(EnumType.STRING)
    @Column(name = "indexing_status", nullable = false, length = 30)
    private FileIndexingStatus indexingStatus;

    @Column(nullable = false)
    private boolean excluded;

    @Column(name = "excluded_reason", length = 100)
    private String excludedReason;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected ProjectFile() {
    }

    private ProjectFile(
            Project project,
            String relativePath,
            String fileName,
            String extension,
            String language,
            Long sizeBytes,
            String sha256,
            boolean excluded,
            String excludedReason
    ) {
        this.project = project;
        applyMetadata(relativePath, fileName, extension, language, sizeBytes, sha256, excluded, excludedReason);
    }

    public static ProjectFile create(
            Project project,
            String relativePath,
            String fileName,
            String extension,
            String language,
            Long sizeBytes,
            String sha256,
            boolean excluded,
            String excludedReason
    ) {
        return new ProjectFile(project, relativePath, fileName, extension, language, sizeBytes, sha256, excluded, excludedReason);
    }

    public void updateMetadata(
            String fileName,
            String extension,
            String language,
            Long sizeBytes,
            String sha256,
            boolean excluded,
            String excludedReason
    ) {
        applyMetadata(this.relativePath, fileName, extension, language, sizeBytes, sha256, excluded, excludedReason);
    }

    private void applyMetadata(
            String relativePath,
            String fileName,
            String extension,
            String language,
            Long sizeBytes,
            String sha256,
            boolean excluded,
            String excludedReason
    ) {
        this.relativePath = relativePath;
        this.fileName = fileName;
        this.extension = extension;
        this.language = language;
        this.sizeBytes = sizeBytes;
        this.sha256 = sha256;
        this.excluded = excluded;
        this.excludedReason = excluded ? excludedReason : null;
        this.indexingStatus = excluded ? FileIndexingStatus.EXCLUDED : FileIndexingStatus.PENDING;
    }

    @PrePersist
    void prePersist() {
        OffsetDateTime now = OffsetDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.indexingStatus == null) {
            this.indexingStatus = this.excluded ? FileIndexingStatus.EXCLUDED : FileIndexingStatus.PENDING;
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

    public String getRelativePath() {
        return relativePath;
    }

    public String getFileName() {
        return fileName;
    }

    public String getExtension() {
        return extension;
    }

    public String getLanguage() {
        return language;
    }

    public Long getSizeBytes() {
        return sizeBytes;
    }

    public String getSha256() {
        return sha256;
    }

    public FileIndexingStatus getIndexingStatus() {
        return indexingStatus;
    }

    public boolean isExcluded() {
        return excluded;
    }

    public String getExcludedReason() {
        return excludedReason;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }
}
