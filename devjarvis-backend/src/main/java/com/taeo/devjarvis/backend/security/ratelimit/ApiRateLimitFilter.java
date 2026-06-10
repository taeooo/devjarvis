package com.taeo.devjarvis.backend.security.ratelimit;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

@Component
public class ApiRateLimitFilter extends OncePerRequestFilter {

    public static final String CLIENT_SESSION_HEADER = "X-DevJarvis-Client-Session-Id";

    private static final Pattern SAFE_SESSION_ID = Pattern.compile("^[A-Za-z0-9._:-]{8,128}$");
    private static final Set<String> MUTATING_METHODS = Set.of(
            HttpMethod.POST.name(),
            HttpMethod.PUT.name(),
            HttpMethod.PATCH.name(),
            HttpMethod.DELETE.name()
    );

    private final RateLimitProperties properties;
    private final InMemoryRateLimiter rateLimiter;

    public ApiRateLimitFilter(RateLimitProperties properties, InMemoryRateLimiter rateLimiter) {
        this.properties = properties;
        this.rateLimiter = rateLimiter;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!properties.isEnabled()) {
            return true;
        }

        String path = request.getRequestURI();
        if (!path.startsWith("/api/")) {
            return true;
        }

        if (HttpMethod.OPTIONS.name().equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        if (!MUTATING_METHODS.contains(request.getMethod().toUpperCase(Locale.ROOT))) {
            return true;
        }

        return properties.getExcludedPaths().stream().anyMatch(path::equals);
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        try {
            int limit = resolveLimit(request);
            rateLimiter.check(resolveClientKey(request), limit);
            filterChain.doFilter(request, response);
        } catch (RateLimitExceededException exception) {
            writeRateLimitResponse(response, exception);
        }
    }

    private int resolveLimit(HttpServletRequest request) {
        String path = request.getRequestURI();
        if (path.matches("/api/projects/\\d+/files/manifest")) {
            return properties.getManifestRequestsPerMinute();
        }
        if (path.equals("/api/screen/ocr")) {
            return properties.getScreenOcrRequestsPerMinute();
        }
        return properties.getWriteRequestsPerMinute();
    }

    private String resolveClientKey(HttpServletRequest request) {
        String clientSessionId = request.getHeader(CLIENT_SESSION_HEADER);
        if (clientSessionId != null && SAFE_SESSION_ID.matcher(clientSessionId).matches()) {
            return "session:" + clientSessionId;
        }

        return "remote:" + request.getRemoteAddr();
    }

    private void writeRateLimitResponse(HttpServletResponse response, RateLimitExceededException exception) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setHeader(HttpHeaders.RETRY_AFTER, String.valueOf(exception.getRetryAfterSeconds()));
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{"
                + "\"success\":false,"
                + "\"data\":null,"
                + "\"error\":{"
                + "\"code\":\"RATE_LIMIT_EXCEEDED\","
                + "\"message\":\"" + exception.getMessage() + "\""
                + "},"
                + "\"timestamp\":\"" + Instant.now() + "\""
                + "}");
    }
}
