package com.taeo.devjarvis.backend.indexing.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record ProjectFileManifestItemRequest(
        @NotBlank(message = "상대 경로는 필수입니다.")
        @Size(max = 1000, message = "상대 경로는 1000자 이하여야 합니다.")
        String relativePath,

        @NotBlank(message = "파일명은 필수입니다.")
        @Size(max = 255, message = "파일명은 255자 이하여야 합니다.")
        String fileName,

        @Size(max = 50, message = "확장자는 50자 이하여야 합니다.")
        String extension,

        @Size(max = 50, message = "언어 값은 50자 이하여야 합니다.")
        String language,

        @NotNull(message = "파일 크기는 필수입니다.")
        @PositiveOrZero(message = "파일 크기는 0 이상이어야 합니다.")
        Long sizeBytes,

        @Size(max = 128, message = "SHA-256 값은 128자 이하여야 합니다.")
        String sha256,

        Boolean excluded,

        @Size(max = 100, message = "제외 사유는 100자 이하여야 합니다.")
        String excludedReason
) {
}
