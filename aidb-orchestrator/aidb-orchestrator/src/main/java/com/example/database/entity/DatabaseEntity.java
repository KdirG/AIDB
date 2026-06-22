package com.example.database.entity;

import javax.persistence.*;

@Entity
@Table(name = "databases")
public class DatabaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String dbName; // Admin'in panelde gördüğü isim (Örn: "Mersin_Uni_Ogrenci")

    @Column(nullable = false)
    private String connectionUrl; // Python'a gidecek gerçek conn_str

    @Column(nullable = false)
    private String dbType; // "mssql", "postgresql" vb.

    @Column(nullable = false)
    private boolean isSandbox = false; // Bu veritabanı bir oyun alanı (Sandbox) mı?

    public DatabaseEntity() {}

    public DatabaseEntity(String dbName, String connectionUrl, String dbType) {
        this.dbName = dbName;
        this.connectionUrl = connectionUrl;
        this.dbType = dbType;
    }

    // Getter ve Setterlar
    public Long getId() { return id; }
    public String getDbName() { return dbName; }
    public void setDbName(String dbName) { this.dbName = dbName; }
    public String getConnectionUrl() { return connectionUrl; }
    public void setConnectionUrl(String connectionUrl) { this.connectionUrl = connectionUrl; }
    public String getDbType() { return dbType; }
    public void setDbType(String dbType) { this.dbType = dbType; }
    public boolean isSandbox() { return isSandbox; }
    public void setSandbox(boolean sandbox) { isSandbox = sandbox; }
}