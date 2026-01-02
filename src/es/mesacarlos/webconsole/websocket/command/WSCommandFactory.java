package es.mesacarlos.webconsole.websocket.command;

import java.util.HashMap;

import es.mesacarlos.webconsole.websocket.command.FileManagement.FileCreateFolderCommand;
import es.mesacarlos.webconsole.websocket.command.FileManagement.FileDeleteCommand;
import es.mesacarlos.webconsole.websocket.command.FileManagement.FileDownloadCommand;
import es.mesacarlos.webconsole.websocket.command.FileManagement.FileListCommand;
import es.mesacarlos.webconsole.websocket.command.FileManagement.FileReadCommand;
import es.mesacarlos.webconsole.websocket.command.FileManagement.FileRenameCommand;
import es.mesacarlos.webconsole.websocket.command.FileManagement.FileWriteCommand;

public class WSCommandFactory {

	public static HashMap<String, WSCommand> getCommandsHashMap() {
		HashMap<String, WSCommand> commands = new HashMap<String, WSCommand>();
		commands.put("LOGIN", new LogInCommand());
		commands.put("EXEC", new ExecCommand());
		commands.put("PLAYERS", new PlayersCommand());
		commands.put("CPUUSAGE", new CpuUsageCommand());
		commands.put("RAMUSAGE", new RamUsageCommand());
		commands.put("TPS", new TpsCommand());
		commands.put("READLOGFILE", new ReadLogFileCommand());
		
		// File Management Commands
		commands.put("FILE_LIST", new FileListCommand());
		commands.put("FILE_READ", new FileReadCommand());
		commands.put("FILE_WRITE", new FileWriteCommand());
		commands.put("FILE_CREATE_FOLDER", new FileCreateFolderCommand());
		commands.put("FILE_DELETE", new FileDeleteCommand());
		commands.put("FILE_RENAME", new FileRenameCommand());
		commands.put("FILE_DOWNLOAD", new FileDownloadCommand());
		
		return commands;
	}
}