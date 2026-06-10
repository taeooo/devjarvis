package com.taeo.devjarvis.backend.security.ratelimit;

import org.springframework.stereotype.Component;

import java.time.Clock;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Component
public class InMemoryRateLimiter {

    private final RateLimitProperties properties;
    private final Clock clock;
    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();
    private final AtomicLong cleanupCursor = new AtomicLong();

    public InMemoryRateLimiter(RateLimitProperties properties) {
        this(properties, Clock.systemUTC());
    }

    InMemoryRateLimiter(RateLimitProperties properties, Clock clock) {
        this.properties = properties;
        this.clock = clock;
    }

    public void check(String key, int limit) {
        if (limit <= 0) {
            throw new RateLimitExceededException("요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.", 60);
        }

        long nowMillis = clock.millis();
        long windowMillis = properties.window().toMillis();
        Bucket bucket = buckets.compute(key, (ignored, current) -> nextBucket(current, nowMillis, windowMillis));

        if (bucket.count() > limit) {
            long retryAfterSeconds = Math.max(1, (bucket.windowStartedAtMillis() + windowMillis - nowMillis + 999) / 1000);
            throw new RateLimitExceededException("요청이 너무 많습니다. 잠시 후 다시 시도해주세요.", retryAfterSeconds);
        }

        cleanupIfNeeded(nowMillis, windowMillis);
    }

    private Bucket nextBucket(Bucket current, long nowMillis, long windowMillis) {
        if (current == null || nowMillis - current.windowStartedAtMillis() >= windowMillis) {
            return new Bucket(nowMillis, 1);
        }
        return new Bucket(current.windowStartedAtMillis(), current.count() + 1);
    }

    private void cleanupIfNeeded(long nowMillis, long windowMillis) {
        long cursor = cleanupCursor.incrementAndGet();
        if (cursor % 256 != 0 && buckets.size() <= properties.getMaxTrackedClients()) {
            return;
        }

        Iterator<Map.Entry<String, Bucket>> iterator = buckets.entrySet().iterator();
        while (iterator.hasNext()) {
            Map.Entry<String, Bucket> entry = iterator.next();
            if (nowMillis - entry.getValue().windowStartedAtMillis() >= windowMillis * 2) {
                iterator.remove();
            }
        }
    }

    private record Bucket(long windowStartedAtMillis, int count) {
    }
}
