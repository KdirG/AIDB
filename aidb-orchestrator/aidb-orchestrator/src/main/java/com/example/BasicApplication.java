package com.example;

import com.example.database.entity.ERole;
import com.example.database.entity.User;
import com.example.database.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.HashSet;

/**
 * AIDB Projesi - Ana Giriş ve Global Yapılandırma Katmanı
 * Bu sınıf projenin kalbidir ve masaüstü/web trafiğinin güvenlik kurallarını belirler.
 */
@SpringBootApplication
public class BasicApplication {

    public static void main(String[] args) {
        SpringApplication.run(BasicApplication.class, args);
    }

    /**
     * MİMARİ: Global CORS Yapılandırması
     * Tauri bazen 3001 portunu kullanabildiği için her iki porta da izin veriyoruz.
     * Bu sayede masaüstü uygulamasında 'Failed to Fetch' hataları almazsın.
     */
    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/**") // Tüm endpointleri kapsar
                        .allowedOrigins("http://localhost:3000", "http://localhost:3001", "tauri://localhost") 
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                        .allowedHeaders("*")
                        .allowCredentials(true);
            }
        };
    }

    /**
     * DATABASE INIT: İlk Kullanıcıları Oluşturma
     * Try-Catch bloğu ekleyerek tabloların henüz oluşmaması durumunda uygulamanın çökmesini engelledik.
     */
    @Bean
    CommandLineRunner init(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            try {
                System.out.println("[AIDB] Veritabanı kontrol ediliyor...");

                // ADMIN KULLANICI
                if (userRepository.findByUsername("admin").isEmpty()) {
                    User admin = new User("admin", passwordEncoder.encode("admin123"));
                    admin.setRoles(new HashSet<>()); // Role setini başlat
                    admin.getRoles().add(ERole.ROLE_ADMIN);
                    userRepository.save(admin);
                    System.out.println("[AIDB] Admin kullanıcısı oluşturuldu.");
                }

                // STANDART USER (KADİR)
                if (userRepository.findByUsername("kadir").isEmpty()) {
                    User user = new User("kadir", passwordEncoder.encode("kadir123"));
                    user.setRoles(new HashSet<>());
                    user.getRoles().add(ERole.ROLE_USER);
                    userRepository.save(user);
                    System.out.println("[AIDB] Kadir kullanıcısı oluşturuldu.");
                }

            } catch (Exception e) {
                // Eğer tablolar henüz oluşmadıysa burada hata vermek yerine sessizce devam eder.
                // Hibernate tabloları bir sonraki saniyede oluşturacaktır.
                System.err.println("[AIDB] Başlangıç verileri eklenirken tablo henüz hazır değildi, bir sonraki başlatmada eklenecek.");
            }
        };
    }
}