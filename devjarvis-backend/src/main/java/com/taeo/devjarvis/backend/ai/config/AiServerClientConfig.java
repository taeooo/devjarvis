package com.taeo.devjarvis.backend.ai.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.net.http.HttpClient;
import java.time.Duration;

@Configuration
public class AiServerClientConfig {

    @Bean
    public HttpClient aiServerHttpClient(AiServerProperties properties) {
        return HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(properties.getTimeoutMillis()))
                .build();
    }
}
