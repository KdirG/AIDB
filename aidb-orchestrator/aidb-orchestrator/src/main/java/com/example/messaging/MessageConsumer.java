package com.example.messaging;

import com.example.controller.SseController;
import com.example.database.entity.QueryHistory;
import com.example.database.repository.QueryHistoryRepository;
import com.example.core.command.SqlQueryCommand;
import com.example.service.QueryService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;

@Service
public class MessageConsumer implements MessageListener {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private QueryHistoryRepository historyRepository;

    @Autowired
    private QueryService queryService; // Yeni eklenen servis

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            String jsonResponse = new String(message.getBody());
            JsonNode rootNode = objectMapper.readTree(jsonResponse);

            String requestId = rootNode.path("requestId").asText();
            String status = rootNode.path("status").asText();
            String type = rootNode.path("type").asText();

            if (requestId == null || requestId.isEmpty()) return;

            // 1. DURUM: ONAY BEKLEYEN SORGULARI YAKALA
            if ("AWAITING_APPROVAL".equals(status)) {
                System.out.println("[Java Consumer] Riskli sorgu yakalandı, onay bekleniyor: " + requestId);
                
                // Sorguyu QueryService'e "Askıya Alınmışlar" olarak kaydet (İleride 'confirm' için lazım)
                SqlQueryCommand pendingCmd = new SqlQueryCommand();
                pendingCmd.setRequestId(requestId);
                pendingCmd.setRawPrompt(rootNode.path("rawPrompt").asText());
                pendingCmd.setGeneratedSql(rootNode.path("generatedSql").asText());
                
                queryService.holdForApproval(requestId, pendingCmd);
            }

            // 2. DURUM: BAŞARILI SORGULARI VE İNFAZLARI KAYDET
            // Hem normal QUERY hem de EXECUTE_CONFIRMED başarılıysa kaydet
            if ("SUCCESS".equals(status) && ("QUERY".equals(type) || "EXECUTE_CONFIRMED".equals(type))) {
                try {
                    QueryHistory history = new QueryHistory();
                    history.setRequestId(requestId);
                    history.setAnswer(rootNode.path("answer").asText());
                    history.setGeneratedSql(rootNode.path("generatedSql").asText());
                    history.setChartData(rootNode.path("chart").asText());
                    
                    String actualPrompt = rootNode.path("rawPrompt").asText();
                    history.setUserPrompt(actualPrompt != null && !actualPrompt.isEmpty() ? actualPrompt : "İsimsiz Sorgu");
                    
                    history.setCreatedAt(LocalDateTime.now());
                    historyRepository.save(history);
                    System.out.println("[Java History] İşlem başarıyla kaydedildi: " + actualPrompt);
                } catch (Exception dbEx) {
                    System.err.println("[History Kayıt Hatası]: " + dbEx.getMessage());
                }
            }
            System.out.println("DEBUG SSE SEND: " + jsonResponse);
            // 3. ADIM: SONUCU (Success veya Awaiting) FRONTEND'E FIRLAT
            SseController.sendNotification(requestId, jsonResponse);

        } catch (Exception e) {
            System.err.println("[Consumer Hata]: " + e.getMessage());
        }
    }
}