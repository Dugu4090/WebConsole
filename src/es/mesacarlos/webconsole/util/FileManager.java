package es.mesacarlos.webconsole.util;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

import org.bukkit.Bukkit;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

public class FileManager {

    private static final String SERVER_DIRECTORY = System.getProperty("user.dir");
    private static final Gson gson = new Gson();

    public static class FileInfo {
        public String name;
        public boolean isFolder;
        public long lastModified;
        public long size;
        public String icon;

        public FileInfo(String name, boolean isFolder, long lastModified, long size) {
            this.name = name;
            this.isFolder = isFolder;
            this.lastModified = lastModified;
            this.size = size;
            this.icon = getFileIcon(name, isFolder);
        }
    }

    public static class FileContent {
        public String path;
        public String name;
        public String content;
        public String encoding;
        public long size;
        public boolean isBinary;

        public FileContent(String path, String name, String content, long size, boolean isBinary) {
            this.path = path;
            this.name = name;
            this.content = content;
            this.encoding = "base64";
            this.size = size;
            this.isBinary = isBinary;
        }
    }

    public static class UploadResult {
        public String message;
        public int filesUploaded;
        public List<String> filenames;

        public UploadResult(String message, int filesUploaded, List<String> filenames) {
            this.message = message;
            this.filesUploaded = filesUploaded;
            this.filenames = filenames;
        }
    }

    public static String getFileIcon(String filename, boolean isFolder) {
        if (isFolder) return "folder";
        
        String ext = getFileExtension(filename).toLowerCase();
        switch (ext) {
            case "yml": case "yaml": return "file-code";
            case "json": return "file-json";
            case "txt": case "log": return "file-text";
            case "png": case "jpg": case "jpeg": case "gif": case "ico": return "file-image";
            case "mp3": case "wav": case "ogg": case "m4a": return "file-audio";
            case "mp4": case "avi": case "mkv": case "mov": return "file-video";
            case "zip": case "jar": case "rar": case "7z": case "tar": case "gz": return "file-archive";
            case "sql": return "file-database";
            case "html": case "htm": case "css": case "js": case "ts": return "file-code";
            case "sh": return "file-terminal";
            case "xml": return "file-xml";
            default: return "file";
        }
    }

    public static String getFileExtension(String filename) {
        if (filename == null || !filename.contains(".")) return "";
        return filename.substring(filename.lastIndexOf(".") + 1);
    }

    public static boolean isTextFile(String filename) {
        String ext = getFileExtension(filename).toLowerCase();
        String[] textExtensions = {
            "txt", "log", "yml", "yaml", "json", "xml", "html", "htm", "css", "js", "ts",
            "sh", "bat", "cmd", "py", "java", "c", "cpp", "h", "hpp", "cs", "go", "rb",
            "php", "pl", "sql", "ini", "cfg", "conf", "properties", "md", "txt", "csv"
        };
        for (String extItem : textExtensions) {
            if (ext.equals(extItem)) return true;
        }
        return false;
    }

    public static boolean isValidFilePath(String path) {
        try {
            File file = new File(path);
            String canonicalPath = file.getCanonicalPath();
            return canonicalPath.startsWith(SERVER_DIRECTORY) || canonicalPath.equals(SERVER_DIRECTORY);
        } catch (IOException e) {
            return false;
        }
    }

    public static boolean isValidExistingFile(String path) {
        File file = new File(path);
        return isValidFilePath(path) && file.exists() && file.isFile();
    }

    public static boolean isValidExistingFolder(String path) {
        File file = new File(path);
        return isValidFilePath(path) && file.exists() && file.isDirectory();
    }

    public static boolean isRootFolder(String path) {
        try {
            return new File(path).getCanonicalPath().equals(new File(SERVER_DIRECTORY).getCanonicalPath());
        } catch (IOException e) {
            return false;
        }
    }

    public static List<FileInfo> listFiles(String path) {
        List<FileInfo> files = new ArrayList<>();
        File folder = new File(path);
        
        if (!folder.exists() || !folder.isDirectory()) {
            return files;
        }

        File[] fileList = folder.listFiles();
        if (fileList == null) {
            return files;
        }

        for (File file : fileList) {
            try {
                files.add(new FileInfo(
                    file.getName(),
                    file.isDirectory(),
                    file.lastModified(),
                    file.isDirectory() ? 0 : Files.size(file.toPath())
                ));
            } catch (IOException e) {
                Bukkit.getLogger().warning("Error getting file info: " + file.getName());
            }
        }

        return files;
    }

    public static String listFilesAsJson(String path) {
        List<FileInfo> files = listFiles(path);
        JsonArray jsonArray = new JsonArray();
        
        for (FileInfo file : files) {
            JsonObject fileObj = new JsonObject();
            fileObj.addProperty("name", file.name);
            fileObj.addProperty("is_folder", file.isFolder);
            fileObj.addProperty("last_modified", file.lastModified);
            fileObj.addProperty("size", file.size);
            fileObj.addProperty("icon", file.icon);
            jsonArray.add(fileObj);
        }
        
        return gson.toJson(jsonArray);
    }

    public static FileContent readFile(String path) {
        File file = new File(path);
        String name = file.getName();
        boolean isBinary = !isTextFile(name);
        String content = "";
        
        if (isBinary) {
            try {
                byte[] fileContent = Files.readAllBytes(file.toPath());
                content = Base64.getEncoder().encodeToString(fileContent);
            } catch (IOException e) {
                throw new RuntimeException("Error reading binary file: " + e.getMessage());
            }
        } else {
            try {
                content = new String(Files.readAllBytes(file.toPath()), "UTF-8");
            } catch (IOException e) {
                throw new RuntimeException("Error reading file: " + e.getMessage());
            }
        }
        
        return new FileContent(path, name, content, file.length(), isBinary);
    }

    public static String readFileAsJson(String path) {
        FileContent fileContent = readFile(path);
        JsonObject jsonObj = new JsonObject();
        jsonObj.addProperty("path", fileContent.path);
        jsonObj.addProperty("name", fileContent.name);
        jsonObj.addProperty("content", fileContent.content);
        jsonObj.addProperty("encoding", fileContent.encoding);
        jsonObj.addProperty("size", fileContent.size);
        jsonObj.addProperty("is_binary", fileContent.isBinary);
        return gson.toJson(jsonObj);
    }

    public static boolean writeFile(String path, String content) {
        if (!isValidFilePath(path)) {
            throw new SecurityException("Invalid file path: " + path);
        }
        
        File file = new File(path);
        try {
            if (isTextFile(file.getName())) {
                Files.write(file.toPath(), content.getBytes("UTF-8"));
            } else {
                byte[] decodedContent = Base64.getDecoder().decode(content);
                Files.write(file.toPath(), decodedContent);
            }
            return true;
        } catch (IOException e) {
            throw new RuntimeException("Error writing file: " + e.getMessage());
        }
    }

    public static boolean createFolder(String path) {
        if (!isValidFilePath(path)) {
            throw new SecurityException("Invalid folder path: " + path);
        }
        
        File folder = new File(path);
        if (folder.exists()) {
            throw new RuntimeException("Folder already exists: " + path);
        }
        return folder.mkdirs();
    }

    public static boolean deleteFile(String path) {
        if (!isValidExistingFile(path) && !isValidExistingFolder(path)) {
            throw new RuntimeException("File/folder not found: " + path);
        }
        
        if (isRootFolder(path)) {
            throw new SecurityException("Cannot delete root folder");
        }
        
        File file = new File(path);
        if (file.isDirectory()) {
            try {
                org.apache.commons.io.FileUtils.deleteDirectory(file);
                return true;
            } catch (IOException e) {
                throw new RuntimeException("Error deleting folder: " + e.getMessage());
            }
        }
        return file.delete();
    }

    public static boolean renameFile(String oldPath, String newPath) {
        if (!isValidExistingFile(oldPath) && !isValidExistingFolder(oldPath)) {
            throw new RuntimeException("File/folder not found: " + oldPath);
        }
        
        if (!isValidFilePath(newPath)) {
            throw new SecurityException("Invalid new path: " + newPath);
        }
        
        File oldFile = new File(oldPath);
        File newFile = new File(newPath);
        return oldFile.renameTo(newFile);
    }

    public static String getParentPath(String path) {
        File file = new File(path);
        String parent = file.getParent();
        return parent != null ? parent : SERVER_DIRECTORY;
    }

    public static String getServerDirectory() {
        return SERVER_DIRECTORY;
    }

    public static String formatFileSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        int exp = (int) (Math.log(bytes) / Math.log(1024));
        String pre = "KMGTPE".charAt(exp - 1) + "";
        return String.format("%.1f %sB", bytes / Math.pow(1024, exp), pre);
    }

    public static String readFileAsBase64(String path) {
        File file = new File(path);
        if (!file.exists() || !file.isFile()) {
            throw new RuntimeException("File not found: " + path);
        }
        
        long maxSizeMB = 50;
        try {
            maxSizeMB = es.mesacarlos.webconsole.config.ConfigManager.getInstance().getMaxDownloadSizeMB();
        } catch (Exception e) {
            // Use default if config not available
        }
        long maxSizeBytes = maxSizeMB * 1024 * 1024;
        
        if (file.length() > maxSizeBytes) {
            throw new RuntimeException("File too large for download (max " + maxSizeMB + "MB)");
        }
        
        try {
            byte[] fileContent = Files.readAllBytes(file.toPath());
            return Base64.getEncoder().encodeToString(fileContent);
        } catch (IOException e) {
            throw new RuntimeException("Error reading file: " + e.getMessage());
        }
    }

    public static String getDownloadResponse(String path) {
        File file = new File(path);
        if (!file.exists() || !file.isFile()) {
            throw new RuntimeException("File not found: " + path);
        }
        
        String base64Content = readFileAsBase64(path);
        
        JsonObject response = new JsonObject();
        response.addProperty("filename", file.getName());
        response.addProperty("path", path);
        response.addProperty("size", file.length());
        response.addProperty("content", base64Content);
        
        return gson.toJson(response);
    }
}
