package com.example.service;

import com.example.core.command.SqlQueryCommand;
import com.example.messaging.MessageProducer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class QueryService {

    @Autowired
    private MessageProducer messageProducer;

    // Onay bekleyen sorguları requestId ile eşleyip burada tutuyoruz.
    private final Map<String, SqlQueryCommand> pendingQueries = new ConcurrentHashMap<>();

    public void holdForApproval(String requestId, SqlQueryCommand command) {
        pendingQueries.put(requestId, command);
    }

    public boolean confirmAndExecute(String requestId, String userRole) {
        // GÜVENLİK: Sadece ADMIN DDL/DML onayı verebilir
        if (!"ROLE_ADMIN".equals(userRole)) {
            System.err.println("[SECURITY] Yetkisiz onay denemesi: " + userRole);
            return false;
        }

        SqlQueryCommand command = pendingQueries.get(requestId);
        if (command != null) {
            // Komut tipini "Onaylanmış İnfaz" olarak değiştirip tekrar gönderiyoruz
            command.setType("EXECUTE_CONFIRMED"); 
            messageProducer.sendCommand(command);
            pendingQueries.remove(requestId); // İşlem bitti, listeden çıkar
            return true;
        }
        return false;
    }
}