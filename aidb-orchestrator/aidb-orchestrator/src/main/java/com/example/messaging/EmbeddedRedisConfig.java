package com.example.messaging;

import org.springframework.context.annotation.Configuration;
import redis.embedded.RedisServer;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import java.io.IOException;

/**
 * AIDB SIDECAR: Embedded Redis Yapılandırması
 * Bu sınıf sayesinde projenin çalışması için dışarıdan Docker veya manuel Redis başlatılmasına gerek kalmaz.
 * Spring Boot başladığında Redis 6379 portunda otomatik olarak ayağa kalkar.
 */
@Configuration
public class EmbeddedRedisConfig {

    private RedisServer redisServer;

    @PostConstruct
    public void startRedis() throws IOException {
        try {
            // Redis'i 6379 portunda başlatıyoruz
            redisServer = new RedisServer(6379);
            redisServer.start();
            System.out.println("[AIDB-SIDECAR] Embedded Redis başarıyla başlatıldı (Port: 6379).");
        } catch (Exception e) {
            // Eğer port zaten kullanımda ise (Docker üzerinden açıksa vb.) hata vermiyoruz, sessizce devam ediyoruz.
            System.err.println("[AIDB-SIDECAR] Redis başlatılamadı: " + e.getMessage());
            System.err.println("[AIDB-SIDECAR] Muhtemelen port (6379) zaten kullanımda. Mevcut Redis kullanılacak.");
        }
    }

    @PreDestroy
    public void stopRedis() {
        if (redisServer != null) {
            redisServer.stop();
            System.out.println("[AIDB-SIDECAR] Embedded Redis durduruldu.");
        }
    }
}
