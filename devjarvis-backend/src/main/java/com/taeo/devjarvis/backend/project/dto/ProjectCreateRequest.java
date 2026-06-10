package com.taeo.devjarvis.backend.project.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ProjectCreateRequest(
        @NotBlank(message = "프로젝트명은 필수입니다.")
        @Size(max = 100, message = "프로젝트명은 100자 이하여야 합니다.")
        String name,

        @Size(max = 500, message = "프로젝트 경로 별칭은 500자 이하여야 합니다.")
        String rootPathAlias,

        @Size(max = 2000, message = "프로젝트 설명은 2000자 이하여야 합니다.")
        String description
) {
}
