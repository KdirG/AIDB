package com.example.api;

import java.io.Serializable;
import java.util.List;
import java.util.Map;

public class QueryResponse implements Serializable {
    private static final long serialVersionUID = 1L;

    private String requestId;
    private String status;
    private String type;
    private String rawPrompt;     // Python'dan geri dönen gerçek soru
    private String generatedSql;
    private String answer;
    private List<Map<String, Object>> resultData;
    private String chart;
    private boolean isFailover;
    private List<String> tables;
    private String errorMessage;
    private long executionTime;

    public QueryResponse() {}

    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getRawPrompt() { return rawPrompt; }
    public void setRawPrompt(String rawPrompt) { this.rawPrompt = rawPrompt; }

    public String getGeneratedSql() { return generatedSql; }
    public void setGeneratedSql(String generatedSql) { this.generatedSql = generatedSql; }

    public String getAnswer() { return answer; }
    public void setAnswer(String answer) { this.answer = answer; }

    public List<Map<String, Object>> getResultData() { return resultData; }
    public void setResultData(List<Map<String, Object>> resultData) { this.resultData = resultData; }

    public String getChart() { return chart; }
    public void setChart(String chart) { this.chart = chart; }

    public boolean isFailover() { return isFailover; }
    public void setFailover(boolean isFailover) { this.isFailover = isFailover; }

    public List<String> getTables() { return tables; }
    public void setTables(List<String> tables) { this.tables = tables; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

    public long getExecutionTime() { return executionTime; }
    public void setExecutionTime(long executionTime) { this.executionTime = executionTime; }
}