package com.example.service;

import com.p6spy.engine.logging.Category;
import com.p6spy.engine.spy.appender.P6Logger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;

@Component
public class CustomP6Logger implements P6Logger {

    private static ProfilerService staticProfilerService;

    @Autowired
    private ProfilerService profilerService;

    @PostConstruct
    public void init() {
        staticProfilerService = profilerService;
    }

    @Override
    public void logSQL(int connectionId, String now, long elapsed, Category category, String prepared, String sql, String url) {
        if (staticProfilerService != null) {
            staticProfilerService.addLog(category.getName(), elapsed, sql);
        }
    }

    @Override
    public void logException(Exception e) {
        // Log exceptions if needed
    }

    @Override
    public void logText(String text) {
        // Log general text if needed
    }

    @Override
    public boolean isCategoryEnabled(Category category) {
        return true;
    }
}
