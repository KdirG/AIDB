package com.example.service;

import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class ProfilerService {
    private static final List<LogEntry> logs = new CopyOnWriteArrayList<>();
    private static final int MAX_LOGS = 1000;

    public ProfilerService() {
        // Sistem başladığında bir başlangıç logu ekleyelim (Test amaçlı)
        addLog("system", 0, "SQL Profiler başlatıldı. Sorgular bekleniyor...");
    }

    public void addLog(String category, long executionTime, String sql) {
        if (sql == null || sql.trim().isEmpty()) return;
        
        LogEntry entry = new LogEntry(category, executionTime, sql, System.currentTimeMillis());
        logs.add(0, entry);
        
        if (logs.size() > MAX_LOGS) {
            logs.remove(logs.size() - 1);
        }
    }

    public List<LogEntry> getLogs() {
        return Collections.unmodifiableList(logs);
    }

    public void clearLogs() {
        logs.clear();
    }

    public static class LogEntry {
        private String category;
        private long executionTime;
        private String sql;
        private long timestamp;

        public LogEntry(String category, long executionTime, String sql, long timestamp) {
            this.category = category;
            this.executionTime = executionTime;
            this.sql = sql;
            this.timestamp = timestamp;
        }

        public String getCategory() { return category; }
        public long getExecutionTime() { return executionTime; }
        public String getSql() { return sql; }
        public long getTimestamp() { return timestamp; }
    }
}
