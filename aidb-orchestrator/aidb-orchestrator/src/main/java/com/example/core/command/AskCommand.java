package com.example.core.command;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Mimarideki 'İş Emri' (Command Object).
 * Kullanıcının chat üzerinden gönderdiği soruyu ve işletim kurallarını paketler.
 */
public class AskCommand extends BaseCommand {

    private String prompt;              // Kullanıcının ham sorusu
    private String dbType;              // "mssql", "postgresql"
    private boolean useSmartMode;       // refiner.py devreye girsin mi?
    private List<String> businessRules = new ArrayList<>(); // Kurumsal kısıtlar
    
    // Güvenlik (RBAC) Katmanı Metadataları
    private List<String> blacklistedTables = new ArrayList<>();
    private boolean ddlBlocked = true;

    public AskCommand() {
        super();
        this.setType("QUERY"); // Python tarafındaki 'if type == "QUERY"' bloğunu tetikler
    }

    // --- GETTER & SETTER METODLARI ---

    public String getPrompt() {
        return prompt;
    }

    public void setPrompt(String prompt) {
        this.prompt = prompt;
    }

    public String getDbType() {
        return dbType;
    }

    public void setDbType(String dbType) {
        this.dbType = dbType;
    }

    public boolean isUseSmartMode() {
        return useSmartMode;
    }

    public void setUseSmartMode(boolean useSmartMode) {
        this.useSmartMode = useSmartMode;
    }

    public List<String> getBusinessRules() {
        return businessRules;
    }

    public void setBusinessRules(List<String> businessRules) {
        this.businessRules = businessRules;
    }

    public List<String> getBlacklistedTables() {
        return blacklistedTables;
    }

    public void setBlacklistedTables(List<String> blacklistedTables) {
        this.blacklistedTables = blacklistedTables;
    }

    public boolean isDdlBlocked() {
        return ddlBlocked;
    }

    public void setDdlBlocked(boolean ddlBlocked) {
        this.ddlBlocked = ddlBlocked;
    }

    // --- EQUALS & HASHCODE (BaseCommand alanlarını da kapsar) ---

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof AskCommand)) return false;
        if (!super.equals(o)) return false;
        AskCommand that = (AskCommand) o;
        return useSmartMode == that.useSmartMode && 
               ddlBlocked == that.ddlBlocked && 
               Objects.equals(prompt, that.prompt) && 
               Objects.equals(dbType, that.dbType) && 
               Objects.equals(businessRules, that.businessRules) && 
               Objects.equals(blacklistedTables, that.blacklistedTables);
    }

    @Override
    public int hashCode() {
        return Objects.hash(super.hashCode(), prompt, dbType, useSmartMode, businessRules, blacklistedTables, ddlBlocked);
    }

    @Override
    public String toString() {
        return "AskCommand{" +
                "requestId='" + getRequestId() + '\'' +
                ", prompt='" + prompt + '\'' +
                ", dbType='" + dbType + '\'' +
                ", ddlBlocked=" + ddlBlocked +
                '}';
    }
}