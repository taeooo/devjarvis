package com.taeo.devjarvis.backend.indexing.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ProjectFileManifestRequest(
        @Valid
        @NotEmpty(message = "파일 manifest는 1개 이상이어야 합니다.")
        @Size(max = 10000, message = "한 번에 등록할 수 있는 파일은 최대 10000개입니다.")
        List<ProjectFileManifestItemRequest> files
) {
}
