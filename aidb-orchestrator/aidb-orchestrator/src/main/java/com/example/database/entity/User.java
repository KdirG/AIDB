package com.example.database.entity;

import javax.persistence.*;
import java.util.HashSet;
import java.util.Set;

/**
 * AIDB Kullanıcı Modeli
 * Kullanıcı kimlik bilgileri, rolleri (Admin/User), DML yetkisi (canModify) 
 * ve erişebileceği veritabanı kataloglarını (allowedDatabases) yönetir.
 */
@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private boolean canModify = false; // Admin panelindeki "DML Yetkisi" switch'i

    // ✨ VERİTABANI KISITLAMA: Kullanıcının erişebileceği kayıtlı veritabanları
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "user_allowed_databases", // İlişkiyi tutacak ara tablonun adı
        joinColumns = @JoinColumn(name = "user_id"),
        inverseJoinColumns = @JoinColumn(name = "database_id")
    )
    private Set<DatabaseEntity> allowedDatabases = new HashSet<>();

    // KULLANICI ROLLERİ (ROLE_USER, ROLE_ADMIN)
    @ElementCollection(targetClass = ERole.class, fetch = FetchType.EAGER)
    @CollectionTable(name = "user_roles", joinColumns = @JoinColumn(name = "user_id"))
    @Enumerated(EnumType.STRING)
    private Set<ERole> roles = new HashSet<>();

    public User() {}

    public User(String username, String password) {
        this.username = username;
        this.password = password;
    }

    // --- GETTER & SETTER METODLARI ---

    public Long getId() { 
        return id; 
    }

    public String getUsername() { 
        return username; 
    }

    public void setUsername(String username) { 
        this.username = username; 
    }

    public String getPassword() { 
        return password; 
    }

    public void setPassword(String password) { 
        this.password = password; 
    }

    public boolean isCanModify() { 
        return canModify; 
    }

    public void setCanModify(boolean canModify) { 
        this.canModify = canModify; 
    }

    public Set<ERole> getRoles() { 
        return roles; 
    }

    public void setRoles(Set<ERole> roles) { 
        this.roles = roles; 
    }

    public Set<DatabaseEntity> getAllowedDatabases() { 
        return allowedDatabases; 
    }

    public void setAllowedDatabases(Set<DatabaseEntity> allowedDatabases) { 
        this.allowedDatabases = allowedDatabases; 
    }
}