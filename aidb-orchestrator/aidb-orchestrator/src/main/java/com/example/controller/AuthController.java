package com.example.controller;

import com.example.auth.JwtUtils;
import com.example.database.entity.ERole;
import com.example.database.entity.User;
import com.example.database.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/v1/auth")
@CrossOrigin(origins = "*") // Frontend (Next.js) erişimi için
public class AuthController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtils jwtUtils;

    /**
     * LOGIN: Kullanıcı adı ve şifre kontrolü yapar, başarılıysa JWT Token döner.
     * POST http://localhost:8089/api/v1/auth/login
     */
    @PostMapping("/login")
    public ResponseEntity<?> authenticateUser(@RequestBody Map<String, String> loginRequest) {
        String username = loginRequest.get("username");
        String password = loginRequest.get("password");

        Optional<User> userOptional = userRepository.findByUsername(username);

        if (userOptional.isPresent()) {
            User user = userOptional.get();
            
            // Veritabanındaki BCrypt şifresiyle girilen şifreyi karşılaştır
            if (passwordEncoder.matches(password, user.getPassword())) {
                
                // Kullanıcının ilk rolünü al (User mı Admin mi?)
                ERole role = user.getRoles().iterator().next();
                
                // JWT Token Üret (Role bilgisini içine gömüyoruz)
                String jwt = jwtUtils.generateJwtToken(username, role.name());

                Map<String, Object> response = new HashMap<>();
                response.put("token", jwt);
                response.put("username", username);
                response.put("role", role.name());
                response.put("status", "SUCCESS");

                System.out.println("[AIDB Auth] Giriş Başarılı: " + username + " (" + role.name() + ")");
                return ResponseEntity.ok(response);
            }
        }

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Collections.singletonMap("message", "Hata: Kullanıcı adı veya şifre geçersiz!"));
    }

    /**
     * SIGNUP: Yeni kullanıcı kaydı oluşturur.
     * POST http://localhost:8089/api/v1/auth/signup
     */
    @PostMapping("/signup")
    public ResponseEntity<?> registerUser(@RequestBody Map<String, Object> signUpRequest) {
        String username = (String) signUpRequest.get("username");
        String password = (String) signUpRequest.get("password");
        String roleStr = (String) signUpRequest.get("role"); // "ADMIN" veya "USER"

        // Kullanıcı adı kontrolü
        if (userRepository.findByUsername(username).isPresent()) {
            return ResponseEntity.badRequest()
                    .body(Collections.singletonMap("message", "Hata: Bu kullanıcı adı zaten alınmış!"));
        }

        // Yeni kullanıcı oluştur ve şifreyi BCrypt ile encode et
        User user = new User();
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(password));

        // Rol ataması
        Set<ERole> roles = new HashSet<>();
        if ("ADMIN".equalsIgnoreCase(roleStr)) {
            roles.add(ERole.ROLE_ADMIN);
        } else {
            roles.add(ERole.ROLE_USER);
        }
        user.setRoles(roles);

        userRepository.save(user);
        
        System.out.println("[AIDB Auth] Yeni Kayıt: " + username + " - Rol: " + roleStr);
        return ResponseEntity.ok(Collections.singletonMap("message", "Kullanıcı başarıyla kaydedildi!"));
    }
}