package com.taeo.devjarvis.backend.indexing.controller;

import com.taeo.devjarvis.backend.common.api.ApiResponse;
import com.taeo.devjarvis.backend.indexing.dto.ProjectFileManifestRequest;
import com.taeo.devjarvis.backend.indexing.dto.ProjectFileManifestResponse;
import com.taeo.devjarvis.backend.indexing.dto.ProjectFileResponse;
import com.taeo.devjarvis.backend.indexing.service.ProjectFileService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Validated
@RestController
@RequestMapping("/api/projects/{projectId}/files")
public class ProjectFileController {

    private final ProjectFileService projectFileService;

    public ProjectFileController(ProjectFileService projectFileService) {
        this.projectFileService = projectFileService;
    }

    @PostMapping("/manifest")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ProjectFileManifestResponse> registerManifest(
            @PathVariable @Positive Long projectId,
            @Valid @RequestBody ProjectFileManifestRequest request
    ) {
        return ApiResponse.ok(projectFileService.registerManifest(projectId, request));
    }

    @GetMapping
    public ApiResponse<List<ProjectFileResponse>> findFiles(@PathVariable @Positive Long projectId) {
        return ApiResponse.ok(projectFileService.findFiles(projectId));
    }

    @GetMapping("/{fileId}")
    public ApiResponse<ProjectFileResponse> findFile(
            @PathVariable @Positive Long projectId,
            @PathVariable @Positive Long fileId
    ) {
        return ApiResponse.ok(projectFileService.findFile(projectId, fileId));
    }
}
