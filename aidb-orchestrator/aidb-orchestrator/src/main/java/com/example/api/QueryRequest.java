package com.example.api;

import java.io.Serializable;

/**
 * MİMARİ: Request DTO (Data Transfer Object)
 * Lombok bağımlılığı olmadan, %100 uyumlu veri taşıyıcı.
 */
public class QueryRequest implements Serializable {
    private static final long serialVersionUID = 1L;

    private String requestId;      // Frontend'de üretilen benzersiz ID
    private String rawPrompt;      // Kullanıcının "Müşterileri listele" sorusu
    private boolean useSmartMode;  // Refiner (Smart Mode) aktif mi?
    private String targetDbType;   // "mssql", "postgresql" vb.

    /**
     * Boş Constructor (Jackson JSON serileştirme için şarttır)
     */
    public QueryRequest() {
    }

    // --- GETTER VE SETTERLAR (Manuel) ---

    public String getRequestId() {
        return requestId;
    }

    public void setRequestId(String requestId) {
        this.requestId = requestId;
    }

    public String getRawPrompt() {
        return rawPrompt;
    }

    public void setRawPrompt(String rawPrompt) {
        this.rawPrompt = rawPrompt;
    }

    public boolean isUseSmartMode() {
        return useSmartMode;
    }

    public void setUseSmartMode(boolean useSmartMode) {
        this.useSmartMode = useSmartMode;
    }

    public String getTargetDbType() {
        return targetDbType;
    }

    public void setTargetDbType(String targetDbType) {
        this.targetDbType = targetDbType;
    }

    @Override
    public String toString() {
        return "QueryRequest{" +
                "requestId='" + requestId + '\'' +
                ", rawPrompt='" + rawPrompt + '\'' +
                ", useSmartMode=" + useSmartMode +
                '}';
    }
}