package es.mesacarlos.webconsole.websocket.command.FileManagement;

import org.java_websocket.WebSocket;

import com.google.gson.Gson;
import com.google.gson.JsonObject;

import es.mesacarlos.webconsole.websocket.command.WSCommand;

import es.mesacarlos.webconsole.auth.ConnectedUser;
import es.mesacarlos.webconsole.config.UserType;
import es.mesacarlos.webconsole.util.FileManager;
import es.mesacarlos.webconsole.util.Internationalization;
import es.mesacarlos.webconsole.websocket.WSServer;
import es.mesacarlos.webconsole.websocket.response.FileManagement.FileErrorResponse;
import es.mesacarlos.webconsole.websocket.response.FileManagement.FileOperationResponse;

public class FileRenameCommand implements WSCommand {

    private static final Gson gson = new Gson();

    @Override
    public void execute(WSServer wsServer, WebSocket conn, String params) {
        ConnectedUser user = es.mesacarlos.webconsole.auth.LoginManager.getInstance().getUser(conn.getRemoteSocketAddress());
        if (user == null || user.getUserType() != UserType.ADMIN) {
            wsServer.sendToClient(conn, new FileErrorResponse(403, Internationalization.getPhrase("no-send-permission")));
            return;
        }

        if (params == null || params.isEmpty()) {
            wsServer.sendToClient(conn, new FileErrorResponse(400, Internationalization.getPhrase("missing-parameters")));
            return;
        }

        String oldPath;
        String newPath;
        try {
            JsonObject jsonParams = gson.fromJson(params, JsonObject.class);
            oldPath = jsonParams.get("oldPath").getAsString();
            newPath = jsonParams.get("newPath").getAsString();
        } catch (Exception e) {
            wsServer.sendToClient(conn, new FileErrorResponse(400, Internationalization.getPhrase("invalid-parameters")));
            return;
        }

        if (!FileManager.isValidExistingFile(oldPath) && !FileManager.isValidExistingFolder(oldPath)) {
            wsServer.sendToClient(conn, new FileErrorResponse(404, Internationalization.getPhrase("file-not-found")));
            return;
        }

        if (!FileManager.isValidFilePath(newPath)) {
            wsServer.sendToClient(conn, new FileErrorResponse(403, Internationalization.getPhrase("access-denied")));
            return;
        }

        try {
            boolean success = FileManager.renameFile(oldPath, newPath);
            if (success) {
                wsServer.sendToClient(conn, new FileOperationResponse(200, Internationalization.getPhrase("file-renamed"), newPath));
            } else {
                wsServer.sendToClient(conn, new FileErrorResponse(500, Internationalization.getPhrase("file-rename-failed")));
            }
        } catch (Exception e) {
            wsServer.sendToClient(conn, new FileErrorResponse(500, e.getMessage()));
        }
    }
}
