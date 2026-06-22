package com.example.database.repository;

import com.example.database.entity.DatabaseEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

/**
 * Veritabanı Kataloğu için Repository Katmanı.
 * Sisteme kayıtlı veritabanı tanımlarına (conn_str, db_name vb.) erişim sağlar.
 */
@Repository
public interface DatabaseRepository extends JpaRepository<DatabaseEntity, Long> {

    /**
     * Veritabanı adına göre katalog kaydını getirir.
     * Sorgu anında yetki kontrolü yaparken işimize yarayacak.
     */
    Optional<DatabaseEntity> findByDbName(String dbName);
}