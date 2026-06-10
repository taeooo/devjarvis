package com.taeo.devjarvis.backend.screen.controller;

import com.taeo.devjarvis.backend.common.api.ApiResponse;
import com.taeo.devjarvis.backend.screen.dto.ScreenAnalysisRequest;
import com.taeo.devjarvis.backend.screen.dto.ScreenAnalysisResponse;
import com.taeo.devjarvis.backend.screen.dto.ScreenOcrRequest;
import com.taeo.devjarvis.backend.screen.dto.ScreenOcrResponse;
import com.taeo.devjarvis.backend.screen.service.ScreenAnalysisService;
import com.taeo.devjarvis.backend.screen.service.ScreenOcrService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/screen")
public class ScreenOcrController {

    private final ScreenOcrService screenOcrService;
    private final ScreenAnalysisService screenAnalysisService;

    public ScreenOcrController(
            ScreenOcrService screenOcrService,
            ScreenAnalysisService screenAnalysisService
    ) {
        this.screenOcrService = screenOcrService;
        this.screenAnalysisService = screenAnalysisService;
    }

    @PostMapping("/ocr")
    public ApiResponse<ScreenOcrResponse> extract(@Valid @RequestBody ScreenOcrRequest request) {
        return ApiResponse.ok(screenOcrService.extract(request));
    }

    @PostMapping("/analyze")
    public ApiResponse<ScreenAnalysisResponse> analyze(@Valid @RequestBody ScreenAnalysisRequest request) {
        return ApiResponse.ok(screenAnalysisService.analyze(request));
    }
}
