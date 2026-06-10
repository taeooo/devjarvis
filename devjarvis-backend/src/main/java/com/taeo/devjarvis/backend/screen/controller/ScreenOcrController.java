package com.taeo.devjarvis.backend.screen.controller;

import com.taeo.devjarvis.backend.common.api.ApiResponse;
import com.taeo.devjarvis.backend.screen.dto.ScreenOcrRequest;
import com.taeo.devjarvis.backend.screen.dto.ScreenOcrResponse;
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

    public ScreenOcrController(ScreenOcrService screenOcrService) {
        this.screenOcrService = screenOcrService;
    }

    @PostMapping("/ocr")
    public ApiResponse<ScreenOcrResponse> extract(@Valid @RequestBody ScreenOcrRequest request) {
        return ApiResponse.ok(screenOcrService.extract(request));
    }
}
