package com.taeo.devjarvis.backend.screen.service;

import com.taeo.devjarvis.backend.ai.config.AiServerProperties;
import com.taeo.devjarvis.backend.ai.dto.analysis.AiServerScreenAnalysisRequest;
import com.taeo.devjarvis.backend.ai.dto.analysis.AiServerScreenAnalysisResponse;
import com.taeo.devjarvis.backend.ai.service.AiServerScreenAnalysisClient;
import com.taeo.devjarvis.backend.screen.config.ScreenAnalysisProperties;
import com.taeo.devjarvis.backend.screen.dto.ScreenAnalysisRequest;
import com.taeo.devjarvis.backend.screen.dto.ScreenAnalysisResponse;
import org.junit.jupiter.api.Test;

import java.net.http.HttpClient;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ScreenAnalysisServiceTest {

    @Test
    void analyzeReturnsSanitizedPreview() {
        ScreenAnalysisProperties properties = new ScreenAnalysisProperties();
        ScreenAnalysisService service = new ScreenAnalysisService(new FakeScreenAnalysisClient(), properties);

        ScreenAnalysisResponse response = service.analyze(new ScreenAnalysisRequest(
                "command-analysis-test-1",
                "screen_summary",
                "screen",
                "rapidocr",
                "hello\u0000 world",
                true,
                1280,
                720,
                "2026-06-10T00:00:00Z"
        ));

        assertThat(response.provider()).isEqualTo("test-provider");
        assertThat(response.preview()).contains("hello  world");
        assertThat(response.actionItems()).contains("next step");
    }

    @Test
    void analyzeRejectsUnsupportedIntent() {
        ScreenAnalysisProperties properties = new ScreenAnalysisProperties();
        ScreenAnalysisService service = new ScreenAnalysisService(new FakeScreenAnalysisClient(), properties);

        assertThatThrownBy(() -> service.analyze(new ScreenAnalysisRequest(
                "command-analysis-test-2",
                "project_diagnosis",
                "project",
                "rapidocr",
                "hello",
                true,
                1280,
                720,
                "2026-06-10T00:00:00Z"
        ))).isInstanceOf(IllegalArgumentException.class);
    }

    private static class FakeScreenAnalysisClient extends AiServerScreenAnalysisClient {
        FakeScreenAnalysisClient() {
            super(new AiServerProperties(), HttpClient.newHttpClient());
        }

        @Override
        public AiServerScreenAnalysisResponse analyze(AiServerScreenAnalysisRequest payload) {
            return new AiServerScreenAnalysisResponse(
                    payload.requestId(),
                    "test-provider",
                    "analysis_ready",
                    payload.intent(),
                    "title",
                    "summary",
                    "detail " + payload.ocrText(),
                    List.of("next step"),
                    payload.ocrText().length(),
                    List.of(),
                    1L
            );
        }
    }
}
