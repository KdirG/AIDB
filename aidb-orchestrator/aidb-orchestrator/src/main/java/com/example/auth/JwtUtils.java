package com.example.auth;

import io.jsonwebtoken.*;
import org.springframework.stereotype.Component;
import java.util.Date;

@Component
public class JwtUtils {
    private String jwtSecret = "AIDB_Sifreli_Anahtar_2026"; // Güvenli bir anahtar
    private int jwtExpirationMs = 86400000; // 24 saat geçerli

    public String generateJwtToken(String username, String role) {
        return Jwts.builder()
                .setSubject(username)
                .claim("role", role) // Rolü token'a gömüyoruz
                .setIssuedAt(new Date())
                .setExpiration(new Date((new Date()).getTime() + jwtExpirationMs))
                .signWith(SignatureAlgorithm.HS512, jwtSecret)
                .compact();
    }

    public String getUserNameFromJwtToken(String token) {
        return Jwts.parser().setSigningKey(jwtSecret).parseClaimsJws(token).getBody().getSubject();
    }

    public String getRoleFromJwtToken(String token) {
        return (String) Jwts.parser().setSigningKey(jwtSecret).parseClaimsJws(token).getBody().get("role");
    }

    public boolean validateJwtToken(String authToken) {
        try {
            Jwts.parser().setSigningKey(jwtSecret).parseClaimsJws(authToken);
            return true;
        } catch (Exception e) {
            System.err.println("Geçersiz JWT: " + e.getMessage());
        }
        return false;
    }
}