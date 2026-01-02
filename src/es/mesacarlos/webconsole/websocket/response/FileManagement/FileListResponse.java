package es.mesacarlos.webconsole.websocket.response.FileManagement;

import com.google.gson.Gson;

public class FileListResponse implements es.mesacarlos.webconsole.websocket.response.JSONOutput {
    private static final Gson gson = new Gson();
    
    private final int status = 2000;
    private final String message = "File list retrieved successfully";
    private final String files;
    private final String currentPath;

    public FileListResponse(String files, String currentPath) {
        this.files = files;
        this.currentPath = currentPath;
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
        jsonObj.addProperty("files", files);
        jsonObj.addProperty("currentPath", currentPath);
        return gson.toJson(jsonObj);
    }
}
