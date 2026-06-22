package com.example.controller;

import com.example.database.entity.DatabaseEntity;
import com.example.database.entity.User;
import com.example.database.repository.DatabaseRepository;
import com.example.database.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/db-storage")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001", "tauri://localhost"})
public class DbStorageController {

    @Autowired
    private DatabaseRepository databaseRepository;

    @Autowired
    private UserRepository userRepository;

    @GetMapping("/metrics")
    public ResponseEntity<?> getStorageMetrics(
            @RequestParam(value = "dbId", required = false) Long dbId,
            @RequestParam(value = "dbName", required = false) String dbName,
            @RequestParam(value = "connectionUrl", required = false) String connectionUrl) {
        try {
            // Admin manuel bağlantısı: connectionUrl doğrudan sağlanmışsa, DB kayıt araması ATLA
            String jdbcUrl;
            String displayName;
            String dbType = "mssql"; // varsayılan

            if (connectionUrl != null && !connectionUrl.isEmpty()) {
                // Sadece ADMIN yetkisi kontrol et
                String role = SecurityContextHolder.getContext().getAuthentication()
                        .getAuthorities().iterator().next().getAuthority();
                if (!role.contains("ADMIN")) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(Map.of("error", "Doğrudan bağlantı yalnızca yöneticiler içindir."));
                }
                jdbcUrl = connectionUrl;
                displayName = dbName != null ? dbName : "Manuel Bağlantı";
                if (connectionUrl.contains("postgresql")) {
                    dbType = "postgresql";
                }
                System.out.println("[Storage] Admin doğrudan bağlantı: " + displayName);
            } else {
                // Kayıtlı veritabanı üzerinden bağlan
                DatabaseEntity db = getAuthorizedDatabase(dbId, dbName);
                jdbcUrl = db.getConnectionUrl();
                displayName = db.getDbName();
                dbType = db.getDbType();
            }

            if (!"mssql".equalsIgnoreCase(dbType)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Storage metrikleri şu an yalnızca SQL Server için desteklenmektedir."));
            }

            StorageMetricsDto responseDto = new StorageMetricsDto();
            responseDto.setDatabaseName(displayName);

            System.out.println("[Storage] Bağlantı kuruluyor: " + displayName);

            boolean isWindowsAuth = jdbcUrl.contains("integratedSecurity=true");
            List<FileMetricsDto> files = new ArrayList<>();

            if (isWindowsAuth) {
                // ========== WINDOWS AUTH: sqlcmd ile bağlan (DLL gerektirmez) ==========
                String serverHost = "localhost";
                String dbNameParsed = displayName;
                try {
                    String clean = jdbcUrl.replace("jdbc:sqlserver://", "");
                    String[] urlParts = clean.split(";");
                    serverHost = urlParts[0].contains(":") ? urlParts[0].split(":")[0] : urlParts[0];
                    for (String p : urlParts) {
                        if (p.toLowerCase().startsWith("databasename=")) {
                            dbNameParsed = p.split("=", 2)[1];
                        }
                    }
                } catch (Exception ignore) {}

                System.out.println("[Storage] Windows Auth algılandı. sqlcmd ile bağlanılıyor: " + serverHost + "/" + dbNameParsed);

                String sql = "SELECT " +
                    "f.name, f.physical_name, f.type_desc, " +
                    "(f.size * 8) / 1024, " +
                    "ISNULL(CAST(FILEPROPERTY(f.name, 'SpaceUsed') AS BIGINT), 0) * 8 / 1024, " +
                    "f.max_size, f.growth, f.is_percent_growth, d.collation_name " +
                    "FROM sys.database_files f CROSS JOIN sys.databases d WHERE d.name = DB_NAME()";

                ProcessBuilder pb = new ProcessBuilder(
                    "sqlcmd", "-S", serverHost, "-d", dbNameParsed, "-E",
                    "-Q", sql, "-h", "-1", "-W", "-s", "|"
                );
                pb.redirectErrorStream(true);
                Process process = pb.start();

                java.io.BufferedReader reader = new java.io.BufferedReader(
                    new java.io.InputStreamReader(process.getInputStream(), "CP850")
                );
                String line;
                while ((line = reader.readLine()) != null) {
                    line = line.trim();
                    if (line.isEmpty() || line.startsWith("(") || line.startsWith("-")) continue;
                    String[] cols = line.split("\\|", -1);
                    if (cols.length < 9) continue;
                    try {
                        FileMetricsDto fileDto = new FileMetricsDto();
                        fileDto.setLogicalName(cols[0].trim());
                        fileDto.setPhysicalName(cols[1].trim());
                        fileDto.setFileType(cols[2].trim());
                        long sizeMb = Long.parseLong(cols[3].trim());
                        long usedMb = Long.parseLong(cols[4].trim());
                        fileDto.setSizeMb(sizeMb);
                        fileDto.setUsedMb(usedMb);
                        fileDto.setUsedPercentage(sizeMb > 0 ? Math.round(((double) usedMb / sizeMb) * 100.0) : 0);
                        int maxSize = Integer.parseInt(cols[5].trim());
                        fileDto.setMaxSize(formatMaxSize(maxSize));
                        int growth = Integer.parseInt(cols[6].trim());
                        boolean isPercent = "1".equals(cols[7].trim());
                        fileDto.setGrowth(isPercent ? growth + "%" : ((growth * 8) / 1024) + " MB");
                        if (responseDto.getCollation() == null) responseDto.setCollation(cols[8].trim());
                        files.add(fileDto);
                    } catch (NumberFormatException nfe) {
                        System.err.println("[Storage] Satır ayrıştırma hatası: " + line);
                    }
                }
                process.waitFor();
                reader.close();
                System.out.println("[Storage] sqlcmd ile " + files.size() + " dosya bulundu.");

            } else {
                // ========== SQL AUTH: JDBC ile bağlan ==========
                try (Connection conn = DriverManager.getConnection(jdbcUrl)) {
                    System.out.println("[Storage] JDBC bağlantısı başarılı. Catalog: " + conn.getCatalog());
                    String sql = "SELECT " +
                            "f.name AS logical_name, f.physical_name, f.type_desc AS file_type, " +
                            "(f.size * 8) / 1024 AS size_mb, " +
                            "ISNULL(CAST(FILEPROPERTY(f.name, 'SpaceUsed') AS BIGINT), 0) * 8 / 1024 AS used_mb, " +
                            "f.max_size, f.growth, f.is_percent_growth, d.collation_name " +
                            "FROM sys.database_files f CROSS JOIN sys.databases d WHERE d.name = DB_NAME()";
                    try (PreparedStatement pstmt = conn.prepareStatement(sql)) {
                        ResultSet rs = pstmt.executeQuery();
                        while (rs.next()) {
                            FileMetricsDto fileDto = new FileMetricsDto();
                            fileDto.setLogicalName(rs.getString("logical_name"));
                            fileDto.setPhysicalName(rs.getString("physical_name"));
                            fileDto.setFileType(rs.getString("file_type"));
                            long sizeMb = rs.getLong("size_mb");
                            long usedMb = rs.getLong("used_mb");
                            fileDto.setSizeMb(sizeMb);
                            fileDto.setUsedMb(usedMb);
                            fileDto.setUsedPercentage(sizeMb > 0 ? Math.round(((double) usedMb / sizeMb) * 100.0) : 0);
                            int maxSize = rs.getInt("max_size");
                            fileDto.setMaxSize(formatMaxSize(maxSize));
                            int growth = rs.getInt("growth");
                            boolean isPercent = rs.getBoolean("is_percent_growth");
                            fileDto.setGrowth(isPercent ? growth + "%" : ((growth * 8) / 1024) + " MB");
                            if (responseDto.getCollation() == null) responseDto.setCollation(rs.getString("collation_name"));
                            files.add(fileDto);
                        }
                    }
                    System.out.println("[Storage] JDBC ile " + files.size() + " dosya bulundu.");
                }
            }

            responseDto.setFiles(files);
            return ResponseEntity.ok(responseDto);

        } catch (RuntimeException e) {
            System.err.println("[Storage Error] Yetki hatası: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            System.err.println("[Storage Error] Bağlantı/SQL hatası: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Depolama metrikleri alınamadı: " + e.getMessage()));
        }
    }

    /** max_size (8KB page sayısı) değerini okunabilir formata çevirir */
    private String formatMaxSize(int maxSize) {
        if (maxSize == -1) return "Unlimited";
        long totalMb = ((long) maxSize * 8) / 1024;
        if (totalMb >= 1024 * 1024) {
            return (totalMb / (1024 * 1024)) + " TB";
        } else if (totalMb >= 1024) {
            return (totalMb / 1024) + " GB";
        }
        return totalMb + " MB";
    }

    @PostMapping("/optimize-growth")
    public ResponseEntity<?> optimizeGrowth(@RequestBody OptimizeGrowthRequest request) {
        try {
            String role = SecurityContextHolder.getContext().getAuthentication()
                    .getAuthorities().iterator().next().getAuthority();
            if (!role.contains("ADMIN")) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Bu işlem yalnızca yöneticiler içindir."));
            }

            String logicalName = request.getLogicalName();
            String dbNameForAlter = request.getDbName();
            String connUrl = request.getConnectionUrl();

            if (logicalName == null || logicalName.isEmpty()) {
                logicalName = "ROWS".equals(request.getFileType()) ? dbNameForAlter : dbNameForAlter + "_log";
            }

            String alterSql = "ALTER DATABASE [" + dbNameForAlter + "] MODIFY FILE (NAME = N'" + logicalName.replace("'", "''") + "', FILEGROWTH = " + request.getNewGrowthSizeMB() + "MB)";
            System.out.println("[Storage] Optimize SQL: " + alterSql);

            boolean isWindowsAuth = connUrl != null && connUrl.contains("integratedSecurity=true");
            if (isWindowsAuth) {
                runSqlCmd(parseServerHost(connUrl), dbNameForAlter, alterSql);
            } else if (connUrl != null && !connUrl.isEmpty()) {
                try (Connection conn = DriverManager.getConnection(connUrl)) { conn.createStatement().executeUpdate(alterSql); }
            } else {
                DatabaseEntity db = getAuthorizedDatabase(request.getDbId(), request.getDbName());
                try (Connection conn = DriverManager.getConnection(db.getConnectionUrl())) { conn.createStatement().executeUpdate(alterSql); }
            }
            return ResponseEntity.ok(Map.of("message", logicalName + " dosyasının FILEGROWTH değeri " + request.getNewGrowthSizeMB() + " MB olarak güncellendi."));
        } catch (Exception e) {
            System.err.println("[Storage Error] Optimize hatası: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Optimizasyon başarısız: " + e.getMessage()));
        }
    }

    @PostMapping("/shrink-log")
    public ResponseEntity<?> shrinkLog(@RequestBody ShrinkLogRequest request) {
        try {
            String role = SecurityContextHolder.getContext().getAuthentication()
                    .getAuthorities().iterator().next().getAuthority();
            if (!role.contains("ADMIN")) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Bu işlem yalnızca yöneticiler içindir."));
            }
            String logicalName = request.getLogicalName();
            int targetSize = request.getTargetSizeMB();
            String connUrl = request.getConnectionUrl();
            String dbNameForCmd = request.getDbName();

            String shrinkSql = "DBCC SHRINKFILE (N'" + logicalName.replace("'", "''") + "', " + targetSize + ")";
            System.out.println("[Storage] Shrink SQL: " + shrinkSql);

            boolean isWindowsAuth = connUrl != null && connUrl.contains("integratedSecurity=true");
            if (isWindowsAuth) {
                runSqlCmd(parseServerHost(connUrl), dbNameForCmd, shrinkSql);
            } else if (connUrl != null && !connUrl.isEmpty()) {
                try (Connection conn = DriverManager.getConnection(connUrl)) { conn.createStatement().execute(shrinkSql); }
            } else {
                DatabaseEntity db = getAuthorizedDatabase(request.getDbId(), request.getDbName());
                try (Connection conn = DriverManager.getConnection(db.getConnectionUrl())) { conn.createStatement().execute(shrinkSql); }
            }
            return ResponseEntity.ok(Map.of("message", logicalName + " log dosyası " + targetSize + " MB hedefine küçültüldü."));
        } catch (Exception e) {
            System.err.println("[Storage Error] Shrink hatası: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Shrink başarısız: " + e.getMessage()));
        }
    }

    private String parseServerHost(String jdbcUrl) {
        try {
            String clean = jdbcUrl.replace("jdbc:sqlserver://", "");
            String hostPart = clean.split(";")[0];
            return hostPart.contains(":") ? hostPart.split(":")[0] : hostPart;
        } catch (Exception e) { return "localhost"; }
    }

    private void runSqlCmd(String server, String dbName, String sql) throws Exception {
        ProcessBuilder pb = new ProcessBuilder("sqlcmd", "-S", server, "-d", dbName, "-E", "-Q", sql);
        pb.redirectErrorStream(true);
        Process process = pb.start();
        java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(process.getInputStream(), "CP850"));
        StringBuilder output = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) { output.append(line).append("\n"); }
        int exitCode = process.waitFor();
        reader.close();
        System.out.println("[Storage] sqlcmd çıktısı: " + output.toString().trim());
        if (exitCode != 0 && output.toString().contains("Msg")) { throw new RuntimeException("sqlcmd hatası: " + output.toString().trim()); }
    }

    private DatabaseEntity getAuthorizedDatabase(Long dbId, String dbName) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        String role = SecurityContextHolder.getContext().getAuthentication().getAuthorities().iterator().next().getAuthority();
        User user = userRepository.findByUsername(username).orElseThrow(() -> new RuntimeException("Kullanıcı bulunamadı."));
        DatabaseEntity selectedDb;
        if (dbId != null) {
            selectedDb = databaseRepository.findById(dbId).orElseThrow(() -> new RuntimeException("Veritabanı ID ile bulunamadı."));
        } else if (dbName != null && !dbName.isEmpty()) {
            selectedDb = databaseRepository.findByDbName(dbName).orElseThrow(() -> new RuntimeException("'" + dbName + "' sistemde kayıtlı değil."));
        } else { throw new RuntimeException("Veritabanı ID'si veya adı belirtilmeli."); }
        boolean hasAccess = role.contains("ADMIN") || user.getAllowedDatabases().stream().anyMatch(db -> db.getId().equals(selectedDb.getId()));
        if (!hasAccess) { throw new RuntimeException("Bu veritabanına erişim yetkiniz yok."); }
        return selectedDb;
    }

    // --- DTOs ---
    public static class StorageMetricsDto {
        private String databaseName; private String collation; private List<FileMetricsDto> files;
        public String getDatabaseName() { return databaseName; } public void setDatabaseName(String v) { this.databaseName = v; }
        public String getCollation() { return collation; } public void setCollation(String v) { this.collation = v; }
        public List<FileMetricsDto> getFiles() { return files; } public void setFiles(List<FileMetricsDto> v) { this.files = v; }
    }
    public static class FileMetricsDto {
        private String logicalName; private String physicalName; private String fileType;
        private long sizeMb; private long usedMb; private long usedPercentage; private String maxSize; private String growth;
        public String getLogicalName() { return logicalName; } public void setLogicalName(String v) { this.logicalName = v; }
        public String getPhysicalName() { return physicalName; } public void setPhysicalName(String v) { this.physicalName = v; }
        public String getFileType() { return fileType; } public void setFileType(String v) { this.fileType = v; }
        public long getSizeMb() { return sizeMb; } public void setSizeMb(long v) { this.sizeMb = v; }
        public long getUsedMb() { return usedMb; } public void setUsedMb(long v) { this.usedMb = v; }
        public long getUsedPercentage() { return usedPercentage; } public void setUsedPercentage(long v) { this.usedPercentage = v; }
        public String getMaxSize() { return maxSize; } public void setMaxSize(String v) { this.maxSize = v; }
        public String getGrowth() { return growth; } public void setGrowth(String v) { this.growth = v; }
    }
    public static class OptimizeGrowthRequest {
        private Long dbId; private String dbName; private String connectionUrl; private String fileType; private String logicalName; private int newGrowthSizeMB;
        public Long getDbId() { return dbId; } public void setDbId(Long v) { this.dbId = v; }
        public String getDbName() { return dbName; } public void setDbName(String v) { this.dbName = v; }
        public String getConnectionUrl() { return connectionUrl; } public void setConnectionUrl(String v) { this.connectionUrl = v; }
        public String getFileType() { return fileType; } public void setFileType(String v) { this.fileType = v; }
        public String getLogicalName() { return logicalName; } public void setLogicalName(String v) { this.logicalName = v; }
        public int getNewGrowthSizeMB() { return newGrowthSizeMB; } public void setNewGrowthSizeMB(int v) { this.newGrowthSizeMB = v; }
    }
    public static class ShrinkLogRequest {
        private Long dbId; private String dbName; private String connectionUrl; private String logicalName; private int targetSizeMB;
        public Long getDbId() { return dbId; } public void setDbId(Long v) { this.dbId = v; }
        public String getDbName() { return dbName; } public void setDbName(String v) { this.dbName = v; }
        public String getConnectionUrl() { return connectionUrl; } public void setConnectionUrl(String v) { this.connectionUrl = v; }
        public String getLogicalName() { return logicalName; } public void setLogicalName(String v) { this.logicalName = v; }
        public int getTargetSizeMB() { return targetSizeMB; } public void setTargetSizeMB(int v) { this.targetSizeMB = v; }
    }
}

