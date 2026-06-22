package com.example.database.repository;

import com.example.database.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Map;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
}