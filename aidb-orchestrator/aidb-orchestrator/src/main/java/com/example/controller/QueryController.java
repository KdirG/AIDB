package com.example.controller;

import com.example.core.command.ConnectionCommand;
import com.example.core.command.SqlQueryCommand;
import com.example.messaging.MessageProducer;
import com.example.service.QueryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001"})
public class QueryController {

    @Autowired
    private MessageProducer messageProducer;

    @Autowired
    private QueryService queryService;

    @PostMapping("/connect")
    public ResponseEntity<?> connect(@RequestBody ConnectionCommand command) {
        String role = SecurityContextHolder.getContext().getAuthentication().getAuthorities().toString();
        command.setUserRole(role);
        command.setType("CONNECT");

        messageProducer.sendCommand(command);
        return ResponseEntity.ok(Map.of("requestId", command.getRequestId(), "status", "PENDING"));
    }

    @PostMapping("/query")
    public ResponseEntity<?> ask(@RequestBody SqlQueryCommand command) {
        // Gerçek kullanıcı rolünü al (Örn: ROLE_ADMIN veya ROLE_USER)
        String role = SecurityContextHolder.getContext().getAuthentication().getAuthorities().iterator().next().getAuthority();
        
        command.setUserRole(role);
        command.setType("QUERY");

        System.out.println("[CONTROLLER] Sorgu Emri: " + command.getRawPrompt() + " | Rol: " + role);

        messageProducer.sendCommand(command);

        return ResponseEntity.ok(Map.of(
            "requestId", command.getRequestId(),
            "status", "SENT"
        ));
    }

    /**
     * DDL/DML ONAY ENDPOINT'İ
     * Kullanıcı arayüzden "Evet" dediğinde burası tetiklenir.
     */
    @PostMapping("/query/confirm")
    public ResponseEntity<?> confirmQuery(@RequestBody Map<String, String> request) {
        String requestId = request.get("requestId");
        String role = SecurityContextHolder.getContext().getAuthentication().getAuthorities().iterator().next().getAuthority();

        boolean success = queryService.confirmAndExecute(requestId, role);

        if (success) {
            return ResponseEntity.ok(Map.of("message", "İşlem onaylandı, yürütülüyor..."));
        } else {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                 .body(Map.of("error", "Bu işlem için yetkiniz yok veya sorgu süresi doldu."));
        }
    }
}