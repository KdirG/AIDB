package com.example.core.command;

import java.util.ArrayList;
import java.util.List;

/**
 * Mimarideki "İstek Paketleme (Command Pattern)" katmanının ana oyuncusudur.
 * Kullanıcının ham prompt'unu ve güvenlik metadatalarını Python Worker'a taşır.
 */
public class SqlQueryCommand extends BaseCommand {

    private String rawPrompt;           // Kullanıcının TR/EN sorusu
    private String targetDbType;        // "mssql", "postgresql" vb.
    private String targetSchema;        // Hedef DB şema özeti
    private List<String> restrictedTables = new ArrayList<>(); // Yasaklı tablolar
    private String generatedSql;
    private boolean allowDdl = false;   // Güvenlik: CREATE/DROP izni
    private boolean needsTranslation = true;  // translator.py aktif mi?
    private boolean needsRefinement = true;   // refiner.py (Smart Mode) aktif mi?
    
    // ✨ EKLEDİĞİMİZ ALANLAR: Yetki kontrolü ve Dinamik Bağlantı için ✨
    private Long dbId;                  // Frontend'den gelen veritabanı ID'si
    private String connectionUrl;       // Python'un bağlanacağı JDBC -> ODBC URL'i
    private boolean isSandbox = false;  // ✨ YENİ: Veritabanı sandbox mı?

    // ✨ TEMPORAL HISTORY Desteği için ✨
    private java.util.Map<String, Object> rowData; // Geçmişi çekilecek satır verisi
    private String originalSql; // Satırın çekildiği orijinal sorgu
    // -------------------------------------------------------------

    // İş kurallarını (Business Rules) taşımak için
    private List<String> businessRules = new ArrayList<>();

    public SqlQueryCommand() {
        super();
        this.type = "QUERY";
    }

    // --- MEVCUT GETTER VE SETTERLAR (DOKUNULMADI) ---
    public String getGeneratedSql() { return generatedSql; }
    public void setGeneratedSql(String generatedSql) { this.generatedSql = generatedSql; }
    public String getRawPrompt() { return rawPrompt; }
    public void setRawPrompt(String rawPrompt) { this.rawPrompt = rawPrompt; }
    public String getTargetDbType() { return targetDbType; }
    public void setTargetDbType(String targetDbType) { this.targetDbType = targetDbType; }
    public String getTargetSchema() { return targetSchema; }
    public void setTargetSchema(String targetSchema) { this.targetSchema = targetSchema; }
    public List<String> getRestrictedTables() { return restrictedTables; }
    public void setRestrictedTables(List<String> restrictedTables) { this.restrictedTables = restrictedTables; }
    public boolean isAllowDdl() { return allowDdl; }
    public void setAllowDdl(boolean allowDdl) { this.allowDdl = allowDdl; }
    public boolean isNeedsTranslation() { return needsTranslation; }
    public void setNeedsTranslation(boolean needsTranslation) { this.needsTranslation = needsTranslation; }
    public boolean isNeedsRefinement() { return needsRefinement; }
    public void setNeedsRefinement(boolean needsRefinement) { this.needsRefinement = needsRefinement; }
    public List<String> getBusinessRules() { return businessRules; }
    public void setBusinessRules(List<String> businessRules) { this.businessRules = businessRules; }

    // ✨ YENİ GETTER VE SETTERLAR ✨
    public Long getDbId() { return dbId; }
    public void setDbId(Long dbId) { this.dbId = dbId; }
    public String getConnectionUrl() { return connectionUrl; }
    public void setConnectionUrl(String connectionUrl) { this.connectionUrl = connectionUrl; }
    public boolean isSandbox() { return isSandbox; }
    public void setSandbox(boolean sandbox) { this.isSandbox = sandbox; }
    public java.util.Map<String, Object> getRowData() { return rowData; }
    public void setRowData(java.util.Map<String, Object> rowData) { this.rowData = rowData; }
    public String getOriginalSql() { return originalSql; }
    public void setOriginalSql(String originalSql) { this.originalSql = originalSql; }

    @Override
    public String toString() {
        return "SqlQueryCommand{" +
                "requestId='" + requestId + '\'' +
                ", type='" + type + '\'' +
                ", dbId=" + dbId +
                ", rawPrompt='" + rawPrompt + '\'' +
                ", role='" + userRole + '\'' +
                '}';
    }
}