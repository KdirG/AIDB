package com.example.core.command;

public class ConnectionCommand extends BaseCommand {
    private String dbType;
    private String serverName;
    private String databaseName;
    private String username;
    private String password;

    private Long dbId;
    private String connectionUrl;

    public ConnectionCommand() {
        super();
        this.type = "CONNECT"; // BaseCommand'daki type alanını set eder
    }

    public Long getDbId() { return dbId; }
    public void setDbId(Long dbId) { this.dbId = dbId; }

    public String getConnectionUrl() { return connectionUrl; }
    public void setConnectionUrl(String connectionUrl) { this.connectionUrl = connectionUrl; }

    // MANUEL GETTER VE SETTERLAR (IDE Hata Veremez)
    public String getDatabaseName() { return databaseName; }
    public void setDatabaseName(String databaseName) { this.databaseName = databaseName; }

    public String getDbType() { return dbType; }
    public void setDbType(String dbType) { this.dbType = dbType; }

    public String getServerName() { return serverName; }
    public void setServerName(String serverName) { this.serverName = serverName; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
}