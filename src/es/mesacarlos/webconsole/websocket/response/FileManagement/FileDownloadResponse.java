package es.mesacarlos.webconsole.websocket.response.FileManagement;

import com.google.gson.Gson;

public class FileDownloadResponse implements es.mesacarlos.webconsole.websocket.response.JSONOutput {
    private static final Gson gson = new Gson();
    
    private final int status = 2003;
    private final String message = "File download ready";
    private final String content;

    public FileDownloadResponse(String content) {
        this.content = content;
    }

    @Override
    public int getStatusCode() {
        return status;
    }

    @Override
    public String getMessage() {
        return message;
    }

    @Override
    public String toJSON() {
        com.google.gson.JsonObject jsonObj = new com.google.gson.JsonObject();
        jsonObj.addProperty("status", status);
        jsonObj.addProperty("message", message);
        jsonObj.addProperty("content", content);
        return gson.toJson(jsonObj);
    }
}
