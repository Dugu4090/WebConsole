package es.mesacarlos.webconsole.websocket.response.FileManagement;

import com.google.gson.Gson;

public class FileReadResponse implements es.mesacarlos.webconsole.websocket.response.JSONOutput {
    private static final Gson gson = new Gson();
    
    private final int status = 2001;
    private final String message = "File content retrieved successfully";
    private final String path;
    private final String name;
    private final String content;
    private final String encoding;
    private final long size;
    private final boolean isBinary;

    public FileReadResponse(String content) {
        this.path = "";
        this.name = "";
        this.content = content;
        this.encoding = "base64";
        this.size = 0;
        this.isBinary = false;
    }

    public FileReadResponse(String path, String name, String content, String encoding, long size, boolean isBinary) {
        this.path = path;
        this.name = name;
        this.content = content;
        this.encoding = encoding;
        this.size = size;
        this.isBinary = isBinary;
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
        jsonObj.addProperty("name", name);
        jsonObj.addProperty("content", content);
        jsonObj.addProperty("encoding", encoding);
        jsonObj.addProperty("size", size);
        jsonObj.addProperty("is_binary", isBinary);
        return gson.toJson(jsonObj);
    }
}
