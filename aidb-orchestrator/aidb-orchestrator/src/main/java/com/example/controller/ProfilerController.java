package com.example.controller;

import com.example.service.ProfilerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/profiler")
@CrossOrigin(origins = "*")
public class ProfilerController {

    @Autowired
    private ProfilerService profilerService;

    @GetMapping("/logs")
    public List<ProfilerService.LogEntry> getLogs() {
        return profilerService.getLogs();
    }

    @DeleteMapping("/logs")
    public void clearLogs() {
        profilerService.clearLogs();
    }
}
