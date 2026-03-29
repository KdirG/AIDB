package com.example.messaging;

import com.example.core.command.BaseCommand; // ATA SINIFI IMPORT ET
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
public class MessageProducer {

    @Autowired
    private StringRedisTemplate redisTemplate;

    private final ObjectMapper objectMapper = new ObjectMapper();

    // BURASI KRİTİK: Parametre 'BaseCommand' olmalı!
    public void sendCommand(BaseCommand command) {
        try {
            String jsonMessage = objectMapper.writeValueAsString(command);
            redisTemplate.convertAndSend("aidb_prompt_queue", jsonMessage);
            System.out.println("[JAVA] Mesaj Redis'e fırlatıldı: " + command.getType());
        } catch (Exception e) {
            System.err.println("[HATA] Serileştirme başarısız: " + e.getMessage());
        }
    }
}