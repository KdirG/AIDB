package com.example.controller;

import com.example.database.entity.DatabaseEntity;
import com.example.database.entity.User;
import com.example.database.repository.DatabaseRepository;
import com.example.database.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = "*")
public class AdminController {

    private final UserRepository userRepository;
    private final DatabaseRepository databaseRepository;

    public AdminController(UserRepository userRepository, DatabaseRepository databaseRepository) {
        this.userRepository = userRepository;
        this.databaseRepository = databaseRepository;
    }

    @PostMapping("/databases")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> addDatabase(@RequestBody DatabaseRequest request) {
        try {
            // Sadece kaydet, JDBC testi yapma (Python halledecek)
            DatabaseEntity db = new DatabaseEntity();
            db.setDbName(request.getDatabaseName());
            db.setDbType(request.getDbType());
            db.setConnectionUrl(request.getConnectionUrl());
            db.setSandbox(request.isSandbox());
            
            databaseRepository.save(db);
            return ResponseEntity.ok(Map.of("message", "Veritabanı kaydedildi."));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Kayıt hatası: " + e.getMessage()));
        }
    }

    @PostMapping("/users/{id}/toggle-modify")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> toggleModify(@PathVariable Long id) {
        User user = userRepository.findById(id).orElseThrow();
        user.setCanModify(!user.isCanModify()); // DML yetkisi burada değişiyor
        userRepository.save(user);
        return ResponseEntity.ok(user);
    }

    @PostMapping("/databases/{id}/toggle-sandbox")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> toggleSandbox(@PathVariable Long id) {
        DatabaseEntity db = databaseRepository.findById(id).orElseThrow();
        db.setSandbox(!db.isSandbox()); // Sandbox durumunu değiştir
        databaseRepository.save(db);
        return ResponseEntity.ok(db);
    }

    @GetMapping("/users") @PreAuthorize("hasRole('ADMIN')") public List<User> getAllUsers() { return userRepository.findAll(); }
    @GetMapping("/databases") @PreAuthorize("hasRole('ADMIN')") public List<DatabaseEntity> getAllDatabases() { return databaseRepository.findAll(); }

    @PostMapping("/users/{userId}/assign-db/{dbId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> assignDb(@PathVariable Long userId, @PathVariable Long dbId) {
        User user = userRepository.findById(userId).orElseThrow();
        DatabaseEntity db = databaseRepository.findById(dbId).orElseThrow();
        user.getAllowedDatabases().add(db);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Erişim verildi."));
    }

    @PostMapping("/users/{userId}/revoke-db/{dbId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> revokeDb(@PathVariable Long userId, @PathVariable Long dbId) {
        User user = userRepository.findById(userId).orElseThrow();
        user.getAllowedDatabases().removeIf(db -> db.getId().equals(dbId));
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Erişim geri alındı."));
    }

    @DeleteMapping("/databases/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteDatabase(@PathVariable Long id) {
        try {
            List<User> users = userRepository.findAll();
            for (User user : users) {
                user.getAllowedDatabases().removeIf(db -> db.getId().equals(id));
                userRepository.save(user);
            }
            databaseRepository.deleteById(id);
            return ResponseEntity.ok(Map.of("message", "Veritabanı silindi."));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Silme hatası: " + e.getMessage()));
        }
    }

    public static class DatabaseRequest {
        private String databaseName;
        private String connectionUrl;
        private String dbType;
        private boolean isSandbox;
        public String getDatabaseName() { return databaseName; }
        public void setDatabaseName(String databaseName) { this.databaseName = databaseName; }
        public String getConnectionUrl() { return connectionUrl; }
        public void setConnectionUrl(String connectionUrl) { this.connectionUrl = connectionUrl; }
        public String getDbType() { return dbType; }
        public void setDbType(String dbType) { this.dbType = dbType; }
        public boolean isSandbox() { return isSandbox; }
        public void setSandbox(boolean sandbox) { isSandbox = sandbox; }
    }
}