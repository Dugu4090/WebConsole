package es.mesacarlos.webconsole.websocket.response.FileManagement;

import com.google.gson.Gson;

public class FileWriteResponse implements es.mesacarlos.webconsole.websocket.response.JSONOutput {
    private static final Gson gson = new Gson();
    
    private final int status = 2002;
    private final String message;
    private final String path;

    public FileWriteResponse(String path, boolean created) {
        this.path = path;
        this.message = created ? "File created successfully" : "File updated successfully";
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
