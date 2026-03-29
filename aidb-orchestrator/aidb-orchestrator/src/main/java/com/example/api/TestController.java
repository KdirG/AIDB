package com.example.api;

import com.example.core.command.SqlQueryCommand;
import com.example.messaging.MessageProducer;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TestController {

    private final MessageProducer messageProducer;

    // Manuel Constructor (Lombok'suz)
    public TestController(MessageProducer messageProducer) {
        this.messageProducer = messageProducer;
    }

    @GetMapping("/test-send")
    public String testSend(@RequestParam String prompt) {
        // Builder yerine klasik yöntemle oluşturuyoruz
        SqlQueryCommand command = new SqlQueryCommand();
        command.setRawPrompt(prompt);
        command.setUserId("kadir_gocer");
        command.setUserRole("ADMIN");
        command.setTargetDbType("POSTGRESQL");

       messageProducer.sendCommand(command);

        return "Mesaj Redis'e fırlatıldı! ID: " + command.getRequestId();
    }
}