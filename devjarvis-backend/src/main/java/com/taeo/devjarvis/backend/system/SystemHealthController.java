package com.taeo.devjarvis.backend.system;

import com.taeo.devjarvis.backend.common.api.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@RestController
@RequestMapping("/api/system")
public class SystemHealthController {

    @GetMapping("/health")
    public ApiResponse<SystemHealthResponse> health() {
        return ApiResponse.ok(new SystemHealthResponse(
                "UP",
                "devjarvis-backend",
                Instant.now()
        ));
    }

    public record SystemHealthResponse(
            String status,
            String service,
            Instant checkedAt
    ) {
    }
}
