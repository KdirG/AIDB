package com.example.messaging;

import com.example.controller.SseController;
import com.example.database.entity.QueryHistory;
import com.example.database.repository.QueryHistoryRepository;
import com.example.core.command.SqlQueryCommand;
import com.example.service.QueryService;
import com.example.service.ProfilerService;
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
    private QueryService queryService; 

    @Autowired
    private ProfilerService profilerService;

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            String jsonResponse = new String(message.getBody());
            JsonNode rootNode = objectMapper.readTree(jsonResponse);

            String requestId = rootNode.path("requestId").asText();
            String status = rootNode.path("status").asText();
            String type = rootNode.path("type").asText();

            if (requestId == null || requestId.isEmpty()) return;

            // ✨ ÖNCELİKLİ LOGLAMA: Başarılı AI Sorgusunu En Tepeye Yaz ✨
            if ("SUCCESS".equals(status)) {
                String generatedSql = rootNode.path("generatedSql").asText();
                long execTime = rootNode.path("executionTime").asLong(0);
                if (generatedSql != null && !generatedSql.isEmpty()) {
                    profilerService.addLog("AI_QUERY", execTime, generatedSql);
                    System.out.println("[PROFILER] AI Sorgusu Kaydedildi: " + generatedSql);
                }
            }

            // 1. DURUM: ONAY BEKLEYEN SORGULARI YAKALA
            if ("AWAITING_APPROVAL".equals(status)) {
                System.out.println("[Java Consumer] Riskli sorgu yakalandı, onay bekleniyor: " + requestId);
                
                // Sorguyu QueryService'e "Askıya Alınmışlar" olarak kaydet (İleride 'confirm' için lazım)
                SqlQueryCommand pendingCmd = new SqlQueryCommand();
                pendingCmd.setRequestId(requestId);
                String actualPrompt = rootNode.path("rawPrompt").asText();
                pendingCmd.setRawPrompt(actualPrompt);
                pendingCmd.setGeneratedSql(rootNode.path("generatedSql").asText());
                
                // Bağlantı bilgilerini de koruyalım
                pendingCmd.setConnectionUrl(rootNode.path("connectionUrl").asText());
                pendingCmd.setTargetDbType(rootNode.path("targetDbType").asText());
                pendingCmd.setDbId(rootNode.path("dbId").isNull() ? null : rootNode.path("dbId").asLong());
                pendingCmd.setAllowDdl(rootNode.path("allowDdl").asBoolean(false));
                
                queryService.holdForApproval(requestId, pendingCmd);

                // ✨ YENİ: Kalıcı olması için Veritabanına da "Bekleyen" olarak kaydet
                try {
                    QueryHistory history = new QueryHistory();
                    history.setRequestId(requestId);
                    history.setAnswer("[PENDING] " + rootNode.path("answer").asText());
                    history.setGeneratedSql(rootNode.path("generatedSql").asText());
                    history.setUserPrompt(actualPrompt != null && !actualPrompt.isEmpty() ? actualPrompt : "Onay Bekleyen İşlem");
                    
                    // JSON olarak connection detaylarını chartData içine sakla (Meta veri olarak)
                    String metaJson = String.format("{\"type\":\"PENDING_META\",\"connectionUrl\":\"%s\",\"targetDbType\":\"%s\",\"dbId\":%s,\"allowDdl\":%b}", 
                        rootNode.path("connectionUrl").asText().replace("\"", "\\\"").replace("\\", "\\\\"),
                        rootNode.path("targetDbType").asText(),
                        rootNode.path("dbId").isNull() ? "null" : rootNode.path("dbId").asLong(),
                        rootNode.path("allowDdl").asBoolean(false));
                    history.setChartData(metaJson);
                    history.setCreatedAt(java.time.LocalDateTime.now());
                    historyRepository.save(history);
                    System.out.println("[Java History] İşlem bekleme listesine (PENDING) kaydedildi.");
                } catch (Exception dbEx) {
                    System.err.println("[History PENDING Kayıt Hatası]: " + dbEx.getMessage());
                }
            }

            // 2. DURUM: BAŞARILI SORGULARI VE İNFAZLARI KAYDET
            if ("SUCCESS".equals(status)) {
                String generatedSql = rootNode.path("generatedSql").asText();
                long execTime = rootNode.path("executionTime").asLong(0);
                
                System.out.println("[PROFILER-DEBUG] Başarılı mesaj alındı. Tip: " + type + ", SQL Mevcut mu: " + (generatedSql != null && !generatedSql.isEmpty()));

                if ("QUERY".equals(type) || "EXECUTE_CONFIRMED".equals(type)) {
                    try {
                        QueryHistory history = new QueryHistory();
                        history.setRequestId(requestId);
                        history.setAnswer(rootNode.path("answer").asText());
                        history.setGeneratedSql(generatedSql);
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
            }
            System.out.println("DEBUG SSE SEND: " + jsonResponse);
            // 3. ADIM: SONUCU (Success veya Awaiting) FRONTEND'E FIRLAT
            SseController.sendNotification(requestId, jsonResponse);

        } catch (Exception e) {
            System.err.println("[Consumer Hata]: " + e.getMessage());
        }
    }
}