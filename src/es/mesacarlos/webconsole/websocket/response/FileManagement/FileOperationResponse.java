package es.mesacarlos.webconsole.websocket.response.FileManagement;

import com.google.gson.Gson;

public class FileOperationResponse implements es.mesacarlos.webconsole.websocket.response.JSONOutput {
    private static final Gson gson = new Gson();
    
    private final int status;
    private final String message;
    private final String path;

    public FileOperationResponse(int status, String message, String path) {
        this.status = status;
        this.message = message;
        this.path = path;
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
        jsonObj.addProperty("path", path);
        return gson.toJson(jsonObj);
    }
}
