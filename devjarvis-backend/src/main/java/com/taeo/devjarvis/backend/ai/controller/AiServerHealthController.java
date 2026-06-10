package com.taeo.devjarvis.backend.ai.controller;

import com.taeo.devjarvis.backend.ai.dto.AiServerHealthResponse;
import com.taeo.devjarvis.backend.ai.service.AiServerHealthClient;
import com.taeo.devjarvis.backend.common.api.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/system/ai-server")
public class AiServerHealthController {

    private final AiServerHealthClient aiServerHealthClient;

    public AiServerHealthController(AiServerHealthClient aiServerHealthClient) {
        this.aiServerHealthClient = aiServerHealthClient;
    }

    @GetMapping("/health")
    public ApiResponse<AiServerHealthResponse> health() {
        return ApiResponse.ok(aiServerHealthClient.checkHealth());
    }
}
