package es.mesacarlos.webconsole.web;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;

public class StaticHandler implements HttpHandler {

    private static final Map<String, String> CONTENT_TYPES = new HashMap<>();
    
    static {
        CONTENT_TYPES.put("html", "text/html; charset=utf-8");
        CONTENT_TYPES.put("css", "text/css; charset=utf-8");
        CONTENT_TYPES.put("js", "application/javascript; charset=utf-8");
        CONTENT_TYPES.put("json", "application/json");
        CONTENT_TYPES.put("png", "image/png");
        CONTENT_TYPES.put("jpg", "image/jpeg");
        CONTENT_TYPES.put("ico", "image/x-icon");
        CONTENT_TYPES.put("svg", "image/svg+xml");
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath();
        
        if (path.equals("/") || path.isEmpty()) {
            path = "/index.html";
        }

        if (path.contains("..") || path.contains("//")) {
            exchange.sendResponseHeaders(403, -1);
            exchange.close();
            return;
        }

        String resourcePath = "web" + path;
        InputStream inputStream = getClass().getClassLoader().getResourceAsStream(resourcePath);

        if (inputStream == null) {
            resourcePath = "web/index.html";
            inputStream = getClass().getClassLoader().getResourceAsStream(resourcePath);
        }

        if (inputStream == null) {
            exchange.sendResponseHeaders(404, -1);
            exchange.close();
            return;
        }

        String extension = getExtension(path);
        String contentType = CONTENT_TYPES.getOrDefault(extension, "application/octet-stream");
        exchange.getResponseHeaders().add("Content-Type", contentType);
        exchange.getResponseHeaders().add("Cache-Control", "max-age=3600");

        exchange.sendResponseHeaders(200, 0);

        try (OutputStream outputStream = exchange.getResponseBody()) {
            byte[] buffer = new byte[8192];
            int length;
            while ((length = inputStream.read(buffer)) != -1) {
                outputStream.write(buffer, 0, length);
            }
        }

        inputStream.close();
        exchange.close();
    }

    private String getExtension(String path) {
        int lastDot = path.lastIndexOf('.');
        if (lastDot > 0) {
            return path.substring(lastDot + 1).toLowerCase();
        }
        return "";
    }
}
