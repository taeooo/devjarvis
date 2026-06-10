package com.taeo.devjarvis.backend.indexing.controller;

import com.taeo.devjarvis.backend.common.api.ApiResponse;
import com.taeo.devjarvis.backend.indexing.dto.IndexingJobResponse;
import com.taeo.devjarvis.backend.indexing.service.IndexingJobService;
import jakarta.validation.constraints.Positive;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Validated
@RestController
@RequestMapping("/api/projects/{projectId}/indexing-jobs")
public class IndexingJobController {

    private final IndexingJobService indexingJobService;

    public IndexingJobController(IndexingJobService indexingJobService) {
        this.indexingJobService = indexingJobService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<IndexingJobResponse> create(@PathVariable @Positive Long projectId) {
        return ApiResponse.ok(indexingJobService.create(projectId));
    }

    @GetMapping
    public ApiResponse<List<IndexingJobResponse>> findJobs(@PathVariable @Positive Long projectId) {
        return ApiResponse.ok(indexingJobService.findJobs(projectId));
    }

    @GetMapping("/{jobId}")
    public ApiResponse<IndexingJobResponse> findJob(
            @PathVariable @Positive Long projectId,
            @PathVariable @Positive Long jobId
    ) {
        return ApiResponse.ok(indexingJobService.findJob(projectId, jobId));
    }
}
