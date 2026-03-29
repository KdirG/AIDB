package com.example.controller;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.http.MediaType;
import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Controller;

@RestController
@RequestMapping("/api/sse")
@CrossOrigin(origins = "*") // Frontend erişimi için
public class SseController {

    // requestId ile SseEmitter nesnelerini eşleştiriyoruz
    public static final Map<String, SseEmitter> emitters = new ConcurrentHashMap<>();

    @GetMapping(value = "/subscribe/{requestId}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribe(@PathVariable String requestId) {
        // 10 dakikalık bir zaman aşımı (timeout) belirliyoruz
        SseEmitter emitter = new SseEmitter(600_000L); 
        
        emitters.put(requestId, emitter);

        // Bağlantı bittiğinde veya hata aldığında listeden sil
        emitter.onCompletion(() -> emitters.remove(requestId));
        emitter.onTimeout(() -> emitters.remove(requestId));
        emitter.onError((e) -> emitters.remove(requestId));

        System.out.println("[SSE] Yeni abonelik başlatıldı. ID: " + requestId);
        return emitter;
    }

    // Python'dan veri geldiğinde MessageConsumer bu metodu çağıracak
    public static void sendNotification(String requestId, String data) {
        SseEmitter emitter = emitters.get(requestId);
        if (emitter != null) {
            try {
                emitter.send(SseEmitter.event()
                        .name("query_result") // Frontend bu isimle dinleyecek
                        .data(data)
                        .id(requestId));
                
                // Veri gönderildikten sonra bağlantıyı kapatmak istersen:
                // emitter.complete();
            } catch (IOException e) {
                emitters.remove(requestId);
                System.err.println("[SSE] Gönderim hatası: " + e.getMessage());
            }
        }
    }
}