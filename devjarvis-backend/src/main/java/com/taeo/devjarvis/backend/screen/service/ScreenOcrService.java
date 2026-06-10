package com.taeo.devjarvis.backend.screen.service;

import com.taeo.devjarvis.backend.ai.dto.ocr.AiServerOcrImageResponse;
import com.taeo.devjarvis.backend.ai.dto.ocr.AiServerOcrRequest;
import com.taeo.devjarvis.backend.ai.dto.ocr.AiServerOcrResponse;
import com.taeo.devjarvis.backend.ai.service.AiServerOcrClient;
import com.taeo.devjarvis.backend.screen.config.ScreenOcrProperties;
import com.taeo.devjarvis.backend.screen.dto.ScreenOcrRequest;
import com.taeo.devjarvis.backend.screen.dto.ScreenOcrResponse;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class ScreenOcrService {

    private final ScreenImageValidator imageValidator;
    private final AiServerOcrClient aiServerOcrClient;
    private final ScreenOcrProperties properties;

    public ScreenOcrService(
            ScreenImageValidator imageValidator,
            AiServerOcrClient aiServerOcrClient,
            ScreenOcrProperties properties
    ) {
        this.imageValidator = imageValidator;
        this.aiServerOcrClient = aiServerOcrClient;
        this.properties = properties;
    }

    public ScreenOcrResponse extract(ScreenOcrRequest request) {
        ValidatedScreenImage image = imageValidator.validate(request.image());
        String requestId = UUID.randomUUID().toString();

        AiServerOcrResponse aiResponse = aiServerOcrClient.extract(new AiServerOcrRequest(
                requestId,
                request.commandId(),
                request.intent(),
                request.contextMode(),
                image.mimeType(),
                image.base64(),
                image.width(),
                image.height(),
                image.byteSize(),
                image.capturedAt()
        ));

        String text = sanitizeText(aiResponse.text());
        String preview = createPreview(text, properties.getPreviewCharacters());
        AiServerOcrImageResponse responseImage = aiResponse.image();
        List<String> warnings = aiResponse.warnings() == null ? List.of() : aiResponse.warnings();

        return new ScreenOcrResponse(
                aiResponse.requestId() == null ? requestId : aiResponse.requestId(),
                safeValue(aiResponse.provider(), "unknown"),
                safeValue(aiResponse.status(), "completed"),
                text,
                !text.isBlank(),
                text.length(),
                preview,
                responseImage == null ? image.width() : responseImage.width(),
                responseImage == null ? image.height() : responseImage.height(),
                responseImage == null ? image.mimeType() : responseImage.mimeType(),
                responseImage == null ? image.byteSize() : responseImage.byteSize(),
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

    private String createPreview(String text, int maxCharacters) {
        if (text.isBlank()) {
            return "";
        }
        int safeLimit = Math.max(80, maxCharacters);
        if (text.length() <= safeLimit) {
            return text;
        }
        return text.substring(0, safeLimit).trim() + "…";
    }

    private String safeValue(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
