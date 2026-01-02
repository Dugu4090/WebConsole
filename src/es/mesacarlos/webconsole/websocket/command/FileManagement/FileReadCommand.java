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
import es.mesacarlos.webconsole.websocket.response.FileManagement.FileReadResponse;

public class FileReadCommand implements WSCommand {

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

        String path;
        try {
            JsonObject jsonParams = gson.fromJson(params, JsonObject.class);
            path = jsonParams.get("path").getAsString();
        } catch (Exception e) {
            wsServer.sendToClient(conn, new FileErrorResponse(400, Internationalization.getPhrase("invalid-parameters")));
            return;
        }

        if (!FileManager.isValidExistingFile(path)) {
            wsServer.sendToClient(conn, new FileErrorResponse(404, Internationalization.getPhrase("file-not-found")));
            return;
        }

        try {
            FileManager.FileContent fileContent = FileManager.readFile(path);
            wsServer.sendToClient(conn, new FileReadResponse(
                fileContent.path,
                fileContent.name,
                fileContent.content,
                fileContent.encoding,
                fileContent.size,
                fileContent.isBinary
            ));
        } catch (Exception e) {
            wsServer.sendToClient(conn, new FileErrorResponse(500, e.getMessage()));
        }
    }
}
