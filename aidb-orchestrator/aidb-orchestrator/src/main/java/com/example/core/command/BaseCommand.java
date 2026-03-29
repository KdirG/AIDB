package com.example.core.command;

import java.io.Serializable;
import java.util.UUID;

public abstract class BaseCommand implements Serializable {
    private static final long serialVersionUID = 1L;

    protected String requestId = UUID.randomUUID().toString();
    protected long createdAt = System.currentTimeMillis();
    protected String userId;
    protected String userRole;
    protected String type; // CONNECT veya QUERY

    // Boş Constructor (Jackson için)
    public BaseCommand() {}

    // Getter & Setterlar
    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    public long getCreatedAt() { return createdAt; }
    public void setCreatedAt(long createdAt) { this.createdAt = createdAt; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getUserRole() { return userRole; }
    public void setUserRole(String userRole) { this.userRole = userRole; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
}