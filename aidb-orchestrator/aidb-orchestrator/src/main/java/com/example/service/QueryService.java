package com.example.service;

import com.example.core.command.SqlQueryCommand;
import com.example.messaging.MessageProducer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.example.database.repository.QueryHistoryRepository;
import com.example.database.entity.QueryHistory;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class QueryService {

    @Autowired
    private MessageProducer messageProducer;

    @Autowired
    private QueryHistoryRepository historyRepository;

    private final ObjectMapper mapper = new ObjectMapper();

    // Onay bekleyen sorguları hafızada tutuyoruz
    private final Map<String, SqlQueryCommand> pendingQueries = new ConcurrentHashMap<>();

    public void holdForApproval(String requestId, SqlQueryCommand command) {
        pendingQueries.put(requestId, command);
    }

    public boolean confirmAndExecute(String requestId, String userRole, boolean canModify, String editedSql) {
        // GÜVENLİK: Admin rolü olan veya canModify yetkisi bulunan kullanıcılar onay verebilir
        if (!userRole.toUpperCase().contains("ADMIN") && !canModify) {
            System.err.println("[AIDB-SECURITY] Yetkisiz onay denemesi: " + userRole);
            return false;
        }

        SqlQueryCommand command = pendingQueries.get(requestId);
        
        // Eğer hafızadan uçtuysa (sunucu restart veya 2 gün geçtiyse) DB'den kurtar:
        if (command == null) {
            QueryHistory history = historyRepository.findByRequestId(requestId);
            if (history != null && history.getChartData() != null && history.getChartData().contains("\"PENDING_META\"")) {
                try {
                    JsonNode meta = mapper.readTree(history.getChartData());
                    command = new SqlQueryCommand();
                    command.setRequestId(requestId);
                    command.setRawPrompt(history.getUserPrompt());
                    command.setGeneratedSql(history.getGeneratedSql());
                    command.setConnectionUrl(meta.path("connectionUrl").asText());
                    command.setTargetDbType(meta.path("targetDbType").asText());
                    if (!meta.path("dbId").isNull()) {
                        command.setDbId(meta.path("dbId").asLong());
                    }
                    command.setAllowDdl(meta.path("allowDdl").asBoolean());
                    System.out.println("[AIDB-RESTORE] Bekleyen işlem veritabanından kurtarıldı: " + requestId);
                    
                    // İşlem onaylandığı için geçmişteki kaydın başlığını PENDING'den çıkaralım
                    history.setAnswer(history.getAnswer().replace("[PENDING] ", "[ONAYLANDI] "));
                    historyRepository.save(history);
                } catch (Exception e) {
                    System.err.println("DB'den komut kurtarılamadı: " + e.getMessage());
                }
            }
        }

        if (command != null) {
            System.out.println("[AIDB-AUDIT] Admin tarafından onaylanan işlem: " + requestId);
            
            // Eğer kullanıcı SQL'i editlediyse, komutu güncelle
            if (editedSql != null && !editedSql.trim().isEmpty()) {
                command.setGeneratedSql(editedSql);
                System.out.println("[AIDB-EDIT] Kullanıcı onay sırasında SQL'i güncelledi.");
            }
            
            command.setType("EXECUTE_CONFIRMED"); 
            messageProducer.sendCommand(command);
            pendingQueries.remove(requestId); 
            return true;
        }
        return false;
    }

    public boolean rejectQuery(String requestId, String userRole, boolean canModify) {
        if (!userRole.toUpperCase().contains("ADMIN") && !canModify) {
            return false;
        }

        // 1. Hafızadan sil
        pendingQueries.remove(requestId);

        // 2. DB'deki history kaydını güncelle ki sonradan tekrar onaylanamasın
        QueryHistory history = historyRepository.findByRequestId(requestId);
        if (history != null && history.getAnswer().contains("[PENDING]")) {
            history.setAnswer(history.getAnswer().replace("[PENDING]", "[İPTAL EDİLDİ]"));
            
            // Eğer isterseniz, chartData içindeki "PENDING_META"yı temizleyerek bağlantı bilgilerini yok edebilirsiniz:
            history.setChartData(null); 
            
            historyRepository.save(history);
            System.out.println("[AIDB-REJECT] Bekleyen işlem iptal edildi: " + requestId);
            return true;
        }

        return false; // Bulunamadı veya zaten iptal edilmiş
    }
}