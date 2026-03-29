package com.example.controller;

import com.example.database.entity.QueryHistory;
import com.example.database.repository.QueryHistoryRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
@CrossOrigin(origins = "*") // Frontend'in (Next.js) erişebilmesi için şart
public class HistoryController {

    @Autowired
    private QueryHistoryRepository historyRepository;

    /**
     * Tüm sorgu geçmişini en yeniden en eskiye sıralı getirir.
     * GET http://localhost:8089/api/v1/history
     */
    @GetMapping("/history")
    public List<QueryHistory> getAllHistory() {
        return historyRepository.findAllByOrderByCreatedAtDesc();
    }

    /**
     * İsteğe bağlı: Tüm geçmişi temizlemek için (Sidebar'daki çöp kutusu butonu için)
     * DELETE http://localhost:8089/api/v1/history
     */
    @DeleteMapping("/history")
    public ResponseEntity<String> clearHistory() {
        historyRepository.deleteAll();
        return ResponseEntity.ok("Geçmiş başarıyla temizlendi.");
    }
}