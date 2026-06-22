package com.example.database.repository;

import com.example.database.entity.QueryHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface QueryHistoryRepository extends JpaRepository<QueryHistory, Long> {
    // En son yapılan sorguyu en üstte getirmek için
    List<QueryHistory> findAllByOrderByCreatedAtDesc();

    QueryHistory findByRequestId(String requestId);
}