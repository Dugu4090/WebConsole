package es.mesacarlos.webconsole.websocket.command.FileManagement;

import org.java_websocket.WebSocket;

import es.mesacarlos.webconsole.websocket.command.WSCommand;

import es.mesacarlos.webconsole.auth.ConnectedUser;
import es.mesacarlos.webconsole.config.UserType;
import es.mesacarlos.webconsole.util.FileManager;
import es.mesacarlos.webconsole.util.Internationalization;
import es.mesacarlos.webconsole.websocket.WSServer;
import es.mesacarlos.webconsole.websocket.response.FileManagement.FileListResponse;
import es.mesacarlos.webconsole.websocket.response.FileManagement.FileErrorResponse;
import es.mesacarlos.webconsole.websocket.response.FileManagement.FileReadResponse;

public class FileListCommand implements WSCommand {

    @Override
    public void execute(WSServer wsServer, WebSocket conn, String params) {
        ConnectedUser user = es.mesacarlos.webconsole.auth.LoginManager.getInstance().getUser(conn.getRemoteSocketAddress());
        if (user == null || user.getUserType() != UserType.ADMIN) {
            wsServer.sendToClient(conn, new FileErrorResponse(403, Internationalization.getPhrase("no-send-permission")));
            return;
        }

        String path = params != null && !params.isEmpty() ? params : FileManager.getServerDirectory();

        if (!FileManager.isValidExistingFolder(path)) {
            wsServer.sendToClient(conn, new FileErrorResponse(404, Internationalization.getPhrase("folder-not-found")));
            return;
        }

        try {
            String fileList = FileManager.listFilesAsJson(path);
            wsServer.sendToClient(conn, new FileListResponse(fileList, path));
        } catch (Exception e) {
            wsServer.sendToClient(conn, new FileErrorResponse(500, e.getMessage()));
        }
    }
}
