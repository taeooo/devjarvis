package com.taeo.devjarvis.backend.screen.service;

import com.taeo.devjarvis.backend.ai.dto.analysis.AiServerScreenAnalysisRequest;
import com.taeo.devjarvis.backend.ai.dto.analysis.AiServerScreenAnalysisResponse;
import com.taeo.devjarvis.backend.ai.service.AiServerScreenAnalysisClient;
import com.taeo.devjarvis.backend.screen.config.ScreenAnalysisProperties;
import com.taeo.devjarvis.backend.screen.dto.ScreenAnalysisRequest;
import com.taeo.devjarvis.backend.screen.dto.ScreenAnalysisResponse;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class ScreenAnalysisService {

    private static final Set<String> SAFE_CONTEXT_MODES = Set.of("screen", "project", "general", "auto");

    private final AiServerScreenAnalysisClient aiServerScreenAnalysisClient;
    private final ScreenAnalysisProperties properties;

    public ScreenAnalysisService(
            AiServerScreenAnalysisClient aiServerScreenAnalysisClient,
            ScreenAnalysisProperties properties
    ) {
        this.aiServerScreenAnalysisClient = aiServerScreenAnalysisClient;
        this.properties = properties;
    }

    public ScreenAnalysisResponse analyze(ScreenAnalysisRequest request) {
        if (!properties.isEnabled()) {
            throw new IllegalArgumentException("Screen analysis is disabled.");
        }

        String intent = normalize(request.intent());
        String contextMode = normalize(request.contextMode());
        if (!properties.getAllowedIntents().contains(intent)) {
            throw new IllegalArgumentException("Unsupported screen analysis intent.");
        }
        if (!SAFE_CONTEXT_MODES.contains(contextMode)) {
            throw new IllegalArgumentException("Unsupported screen analysis context mode.");
        }

        String sanitizedText = sanitizeText(request.ocrText());
        if (sanitizedText.length() > properties.getMaxOcrTextCharacters()) {
            throw new IllegalArgumentException("OCR text is too large for screen analysis.");
        }

        String requestId = UUID.randomUUID().toString();
        AiServerScreenAnalysisResponse aiResponse = aiServerScreenAnalysisClient.analyze(new AiServerScreenAnalysisRequest(
                requestId,
                request.commandId(),
                intent,
                contextMode,
                sanitizeLabel(request.ocrProvider()),
                sanitizedText,
                request.ocrTextFound() && !sanitizedText.isBlank(),
                request.width(),
                request.height(),
                request.capturedAt()
        ));

        String detail = sanitizeText(aiResponse.detail());
        String summary = sanitizeText(aiResponse.summary());
        List<String> actionItems = aiResponse.actionItems() == null
                ? List.of()
                : aiResponse.actionItems().stream().map(this::sanitizeText).filter(value -> !value.isBlank()).limit(6).toList();
        List<String> warnings = aiResponse.warnings() == null
                ? List.of()
                : aiResponse.warnings().stream().map(this::sanitizeText).filter(value -> !value.isBlank()).limit(6).toList();

        return new ScreenAnalysisResponse(
                safeValue(aiResponse.requestId(), requestId),
                safeValue(aiResponse.provider(), "unknown"),
                safeValue(aiResponse.status(), "analysis_ready"),
                safeValue(aiResponse.intent(), intent),
                sanitizeText(safeValue(aiResponse.title(), "Screen analysis ready")),
                summary,
                detail,
                createPreview(detail.isBlank() ? summary : detail, properties.getPreviewCharacters()),
                actionItems,
                aiResponse.textUsedLength(),
                warnings,
                Instant.now()
        );
    }

    private String sanitizeText(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return value
                .replace('\u0000', ' ')
                .replaceAll("[\\p{Cntrl}&&[^\\r\\n\\t]]", " ")
                .trim();
    }

    private String createPreview(String value, int maxCharacters) {
        if (value == null || value.isBlank()) {
            return "";
        }
        int safeLimit = Math.max(120, maxCharacters);
        if (value.length() <= safeLimit) {
            return value;
        }
        return value.substring(0, safeLimit).trim() + "…";
    }

    private String sanitizeLabel(String value) {
        if (value == null || value.isBlank()) {
            return "unknown";
        }
        return value.replaceAll("[^A-Za-z0-9._:-]", "").trim();
    }

    private String normalize(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT).trim();
    }

    private String safeValue(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
