package com.example.core.command;

import lombok.Data;
import lombok.EqualsAndHashCode;
import java.util.ArrayList;
import java.util.List;

/**
 * Mimarideki 'İş Emri' (Command Object).
 * Kullanıcının chat üzerinden gönderdiği soruyu ve işletim kurallarını paketler.
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class AskCommand extends BaseCommand {

    private String prompt;             // Kullanıcının ham sorusu
    private String dbType;             // "mssql", "postgresql" (Strategy Pattern için)
    private boolean useSmartMode;      // refiner.py devreye girsin mi?
    private List<String> businessRules = new ArrayList<>(); // Kurumsal kısıtlar
    
    // Güvenlik (RBAC) Katmanı Metadataları
    private List<String> blacklistedTables = new ArrayList<>();
    private boolean ddlBlocked = true;

    public AskCommand() {
        super();
        this.setType("QUERY"); // Python tarafındaki 'if type == "QUERY"' bloğunu tetikler
    }
}