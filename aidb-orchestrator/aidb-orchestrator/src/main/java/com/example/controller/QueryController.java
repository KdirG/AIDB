package com.example.controller;

import com.example.core.command.ConnectionCommand;
import com.example.core.command.SqlQueryCommand;
import com.example.database.entity.User;
import com.example.database.entity.DatabaseEntity;
import com.example.database.repository.UserRepository;
import com.example.database.repository.DatabaseRepository;
import com.example.messaging.MessageProducer;
import com.example.service.QueryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Set;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.PreparedStatement;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.List;
@RestController
@RequestMapping("/api/v1")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001", "tauri://localhost"})
public class QueryController {

    @Autowired
    private MessageProducer messageProducer;

    @Autowired
    private QueryService queryService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DatabaseRepository databaseRepository;

    @GetMapping("/databases/me")
    public ResponseEntity<?> getMyDatabases() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Kullanıcı bulunamadı."));
        return ResponseEntity.ok(user.getAllowedDatabases());
    }

    @PostMapping("/connect")
    public ResponseEntity<?> connect(@RequestBody ConnectionCommand command) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        String role = SecurityContextHolder.getContext().getAuthentication().getAuthorities().iterator().next().getAuthority();
        
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Kullanıcı bulunamadı."));

        if (command.getDbId() != null) {
            DatabaseEntity selectedDb = databaseRepository.findById(command.getDbId())
                    .orElseThrow(() -> new RuntimeException("Seçilen veritabanı sistemde kayıtlı değil."));

            boolean hasAccess = user.getAllowedDatabases().stream()
                    .anyMatch(db -> db.getId().equals(selectedDb.getId()));

            if (!hasAccess) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "Bu veritabanına erişim yetkiniz bulunmamaktadır."));
            }
            
            command.setConnectionUrl(selectedDb.getConnectionUrl());
            command.setDbType(selectedDb.getDbType());
            command.setDatabaseName(selectedDb.getDbName());
        }

        command.setUserRole(role);
        command.setType("CONNECT");
        messageProducer.sendCommand(command);
        return ResponseEntity.ok(Map.of("requestId", command.getRequestId(), "status", "PENDING"));
    }

    @PostMapping("/query")
    public ResponseEntity<?> ask(@RequestBody SqlQueryCommand command) {
        // 1. Kullanıcı bilgilerini al
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        String role = SecurityContextHolder.getContext().getAuthentication().getAuthorities().iterator().next().getAuthority();
        
        // 2. Kullanıcıyı ve Seçtiği Veritabanını DB'den çek
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Kullanıcı bulunamadı."));

        // Frontend'den gelen dbId'yi SqlQueryCommand içinden alıyoruz
        if (command.getDbId() == null && !role.contains("ADMIN")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Veritabanı seçimi zorunludur."));
        }

        if (command.getDbId() != null) {
            DatabaseEntity selectedDb = databaseRepository.findById(command.getDbId())
                    .orElseThrow(() -> new RuntimeException("Seçilen veritabanı sistemde kayıtlı değil."));

            // 3. ✨ YETKİ KONTROLÜ (Chinook Filtresi) ✨
            // Kullanıcının allowedDatabases listesinde bu DB var mı?
            boolean hasAccess = role.contains("ADMIN") || user.getAllowedDatabases().stream()
                    .anyMatch(db -> db.getId().equals(selectedDb.getId()));

            if (!hasAccess) {
                System.out.println("[SECURITY ALERT] Yetkisiz Erişim Denemesi! Kullanıcı: " + username + " DB: " + selectedDb.getDbName());
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "Bu veritabanına erişim yetkiniz bulunmamaktadır. Lütfen yöneticiye başvurun."));
            }

            // 4. Komutu Zenginleştir (Python Worker için gerekli bilgiler)
            command.setConnectionUrl(selectedDb.getConnectionUrl()); // Python'un bağlanacağı URL
            command.setTargetDbType(selectedDb.getDbType()); // "mssql" veya "postgresql"
            command.setSandbox(selectedDb.isSandbox()); // ✨ YENİ: Sandbox bilgisi
        }

        command.setUserRole(role);
        command.setAllowDdl(user.isCanModify()); // Admin panelinden gelen DML/DDL izni
        command.setType("QUERY");

        System.out.println("[AIDB-LOG] Sorgu Yönlendiriliyor: " + command.getRawPrompt() + " | Hedef DB: " + (command.getDbId() != null ? command.getDbId() : "Manuel(Admin)"));

        // 5. Mesajı Redis'e fırlat
        messageProducer.sendCommand(command);

        return ResponseEntity.ok(Map.of("requestId", command.getRequestId(), "status", "SENT"));
    }

    @PostMapping("/history")
    public ResponseEntity<?> getHistory(@RequestBody SqlQueryCommand command) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        String role = SecurityContextHolder.getContext().getAuthentication().getAuthorities().iterator().next().getAuthority();
        
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Kullanıcı bulunamadı."));

        if (command.getDbId() == null && !role.contains("ADMIN")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Veritabanı seçimi zorunludur."));
        }

        if (command.getDbId() != null) {
            DatabaseEntity selectedDb = databaseRepository.findById(command.getDbId())
                    .orElseThrow(() -> new RuntimeException("Seçilen veritabanı sistemde kayıtlı değil."));

            boolean hasAccess = role.contains("ADMIN") || user.getAllowedDatabases().stream()
                    .anyMatch(db -> db.getId().equals(selectedDb.getId()));

            if (!hasAccess) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "Bu veritabanına erişim yetkiniz bulunmamaktadır."));
            }

            command.setConnectionUrl(selectedDb.getConnectionUrl());
            command.setTargetDbType(selectedDb.getDbType());
        }

        command.setUserRole(role);
        command.setAllowDdl(false); // Sadece okuma (FOR SYSTEM_TIME) yapılacak
        command.setType("HISTORY_QUERY");

        System.out.println("[AIDB-LOG] Temporal History Sorgusu Yönlendiriliyor. Hedef DB: " + (command.getDbId() != null ? command.getDbId() : "Manuel"));

        messageProducer.sendCommand(command);

        return ResponseEntity.ok(Map.of("requestId", command.getRequestId(), "status", "SENT"));
    }

    // ✨ NATIVE RECOVERY SERVICE ✨
    // AI veya mesaj kuyruğu kullanmadan, doğrudan JDBC üzerinden deterministik geri yükleme.
    @PostMapping("/restore")
    public ResponseEntity<?> restoreTemporalData(@RequestBody Map<String, Object> payload) {
        try {
            String username = SecurityContextHolder.getContext().getAuthentication().getName();
            String role = SecurityContextHolder.getContext().getAuthentication().getAuthorities().iterator().next().getAuthority();
            
            User user = userRepository.findByUsername(username)
                    .orElseThrow(() -> new RuntimeException("Kullanıcı bulunamadı."));

            Number dbIdNum = (Number) payload.get("dbId");
            if (dbIdNum == null) return ResponseEntity.badRequest().body(Map.of("error", "Veritabanı seçimi zorunludur."));
            
            Long dbId = dbIdNum.longValue();
            DatabaseEntity selectedDb = databaseRepository.findById(dbId)
                    .orElseThrow(() -> new RuntimeException("Veritabanı bulunamadı."));

            boolean hasAccess = role.contains("ADMIN") || user.getAllowedDatabases().stream()
                    .anyMatch(db -> db.getId().equals(selectedDb.getId()));

            if (!hasAccess) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Erişim yetkiniz yok."));
            }

            String originalSql = (String) payload.get("originalSql");
            Map<String, Object> rowData = (Map<String, Object>) payload.get("rowData");

            // 1. Tablo ismini Regex ile bul
            Pattern pattern = Pattern.compile("FROM\\s+\\[?([\\w\\u00C0-\\u017F]+)\\]?", Pattern.CASE_INSENSITIVE);
            Matcher matcher = pattern.matcher(originalSql);
            if (!matcher.find()) throw new RuntimeException("Tablo adı bulunamadı.");
            String tableName = matcher.group(1);

            // 2. Doğrudan JDBC Bağlantısı Kur (Native)
            try (Connection conn = DriverManager.getConnection(selectedDb.getConnectionUrl())) {
                
                // 3. PK (Primary Key) Bul (DatabaseMetaData üzerinden kesin sonuç)
                DatabaseMetaData meta = conn.getMetaData();
                ResultSet pkRs = meta.getPrimaryKeys(null, null, tableName);
                String pkColumn = null;
                if (pkRs.next()) {
                    pkColumn = pkRs.getString("COLUMN_NAME");
                } else {
                    pkColumn = rowData.keySet().iterator().next(); // Fallback
                }
                
                Object pkValue = rowData.get(pkColumn);
                if (pkValue == null) throw new RuntimeException("Primary Key değeri eksik.");

                // 4. PreparedStatement İnşası (SQL Injection İmkansız)
                StringBuilder sqlBuilder = new StringBuilder("UPDATE [" + tableName + "] SET ");
                List<String> keys = new java.util.ArrayList<>();
                
                for (String key : rowData.keySet()) {
                    if (key.equalsIgnoreCase("SysStartTime") || key.equalsIgnoreCase("SysEndTime") || key.equalsIgnoreCase(pkColumn)) {
                        continue;
                    }
                    keys.add(key);
                    sqlBuilder.append("[").append(key).append("] = ?, ");
                }
                
                // Son virgülü sil
                sqlBuilder.setLength(sqlBuilder.length() - 2);
                sqlBuilder.append(" WHERE [").append(pkColumn).append("] = ?");

                System.out.println("[Native Recovery] Executing: " + sqlBuilder.toString());

                // 5. Parametreleri Yükle ve Çalıştır (Data Object Mapping)
                try (PreparedStatement pstmt = conn.prepareStatement(sqlBuilder.toString())) {
                    int paramIndex = 1;
                    for (String key : keys) {
                        pstmt.setObject(paramIndex++, rowData.get(key));
                    }
                    pstmt.setObject(paramIndex, pkValue); // WHERE PK = ?
                    
                    int affectedRows = pstmt.executeUpdate();
                    
                    return ResponseEntity.ok(Map.of(
                        "status", "SUCCESS", 
                        "message", affectedRows + " satır başarıyla sistem arşivinden (Native) geri yüklendi."
                    ));
                }
            }
        } catch (Exception e) {
            System.err.println("[Native Recovery Error] " + e.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/query/confirm")
    public ResponseEntity<?> confirmQuery(@RequestBody Map<String, String> request) {
        String requestId = request.get("requestId");
        String editedSql = request.get("editedSql");
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        String role = SecurityContextHolder.getContext().getAuthentication().getAuthorities().iterator().next().getAuthority();

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Kullanıcı bulunamadı."));

        boolean success = queryService.confirmAndExecute(requestId, role, user.isCanModify(), editedSql);

        if (success) {
            return ResponseEntity.ok(Map.of("message", "İşlem onaylandı, yürütülüyor..."));
        } else {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Bu işlem için yetkiniz yok veya sorgu süresi doldu."));
        }
    }

    @PostMapping("/query/reject")
    public ResponseEntity<?> rejectQuery(@RequestBody Map<String, String> request) {
        String requestId = request.get("requestId");
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        String role = SecurityContextHolder.getContext().getAuthentication().getAuthorities().iterator().next().getAuthority();

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Kullanıcı bulunamadı."));

        boolean success = queryService.rejectQuery(requestId, role, user.isCanModify());

        if (success) {
            return ResponseEntity.ok(Map.of("message", "İşlem başarıyla iptal edildi."));
        } else {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Bu işlem için yetkiniz yok veya işlem zaten iptal edilmiş."));
        }
    }
}