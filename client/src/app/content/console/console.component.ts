import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Subscription } from 'rxjs';
import { Icons } from 'src/app/shared/icons';
import { ActiveConnectionDto } from 'src/app/_dto/ActiveConnectionDto';
import { WebSocketCommand } from 'src/app/_dto/command/WebSocketCommand';
import { WebSocketCommandEnum } from 'src/app/_dto/command/WebSocketCommandEnum';
import { ConnectionStatusEnum } from 'src/app/_dto/ConnectionStatusEnum';
import { ConsoleOutputResponse } from 'src/app/_dto/response/ConsoleOutputResponse';
import { CpuResponse } from 'src/app/_dto/response/CpuResponse';
import { LoggedInResponse } from 'src/app/_dto/response/LoggedInResponse';
import { LoginRequiredResponse } from 'src/app/_dto/response/LoginRequiredResponse';
import { PlayersResponse } from 'src/app/_dto/response/PlayersResponse';
import { RamResponse } from 'src/app/_dto/response/RamResponse';
import { TpsResponse } from 'src/app/_dto/response/TpsResponse';
import { UnknownCommandResponse } from 'src/app/_dto/response/UnknownCommandResponse';
import { WebSocketResponse } from 'src/app/_dto/response/WebSocketResponse';
import { ServerDto } from 'src/app/_dto/ServerDto';
import { SettingsEnum, StorageService } from 'src/app/_services/storage.service';
import { WebconsoleService } from 'src/app/_services/webconsole.service';
import { AnsiUp } from "ansi_up"

interface FileInfo {
    name: string;
    is_folder: boolean;
    last_modified: number;
    size: number;
    icon: string;
}

@Component({
	selector: 'app-console',
	templateUrl: './console.component.html',
	styleUrls: ['./console.component.scss']
})
export class ConsoleComponent implements OnInit, AfterViewInit, OnDestroy {
	//General stuff
	icons = Icons;
	server!: ServerDto; //Server info
	activeConnection!: ActiveConnectionDto; //Active connection object (which stores messages received, messages sent, subject, etc.)
	subscription!: Subscription; //Current subscription by this component
	//Content of the console
	@ViewChild("consoleDiv", { static: false }) consoleDiv!: ElementRef;
	consoleHtml: string = "";
	//Password modal
	@ViewChild("setPasswordModal", { static: false }) passwordModal!: ElementRef;
	//Command input
	@ViewChild("commandInput", { static: false }) commandInput!: ElementRef;
	//File input
	@ViewChild("fileInput", { static: false }) fileInput!: ElementRef;
	//Server Insights
	connectedPlayers: number = 0;
	maxPlayers: number = 0;
	cpuUsage: number = 0;
	ramFree: number = 0;
	ramUsed: number = 0;
	ramMax: number = 0;
	tps: number = 0;

	//Helper properties
	keepScrollDown: boolean = true;
	showServerInfo: boolean = true;
	showConsole: boolean = false;
	showFileManager: boolean = false;
	loggedInUsername: string = "";
	loggedInAs: string = "";
	savedPasswordSent: boolean = false;
	browsingCommandHistoryIndex: number = -1;
	insightsInverval!: any;

	//File Manager
	files: FileInfo[] = [];
	currentPath: string = '';
	serverDirectory: string = '';
	pathParts: string[] = [];
	editingFile: FileInfo | null = null;
	fileContent: string = '';
	originalFileContent: string = '';
	fileContentChanged: boolean = false;
	loading: boolean = false;
	contextMenuVisible: boolean = false;
	contextMenuTop: number = 0;
	contextMenuLeft: number = 0;
	selectedContextFile: FileInfo | null = null;
	showCreateFolderModal: boolean = false;
	newFolderName: string = '';
	showCreateFileModal: boolean = false;
	newFileName: string = '';
	showRenameModal: boolean = false;
	renameNewName: string = '';
	showDeleteConfirmModal: boolean = false;

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		private storageService: StorageService,
		private webConsoleService: WebconsoleService,
		private modalService: NgbModal,
	) { }

	/**
	 * On component initialization, connect to WebSocket server and subscribe to subjects (where WebSocket messages are received)
	 */
	ngOnInit(): void {
		console.log("Init console component");
		//Get server name from params
		const routeParams: ParamMap = this.route.snapshot.paramMap;
		const serverName = routeParams.get('serverName');

		//If server name not provided, throw error and redirect to homepage
		if (!serverName) {
			this.router.navigate(['']);
			throw Error("Server name not provided");
		}

		//Get server from its name. If not found, redirect to homepage
		const serverObject = this.storageService.getServer(serverName);

		if (!serverObject) {
			this.router.navigate(['']);
			throw Error("Server name invalid");
		}

		//Save server object and connect
		this.server = serverObject;

		//Connect to server
		this.activeConnection = this.webConsoleService.connect(this.server.serverName);
		this.showConsole = this.activeConnection.connectionStatus == ConnectionStatusEnum.Connected;

		//Process old messages (In case we are resuming a session)
		this.activeConnection.receivedMessages.forEach(e => this.processMessage(e));

		//If not created, create the Players, CPU, RAM and TPS interval
		if (!this.insightsInverval) {
			this.insightsInverval = setInterval(() => {
				this.requestServerInsights();
			}, 2500);
		}

		//Subscribe to Subject to process received messages
		this.subscription = this.activeConnection.subject$.subscribe({
			next: (msg: WebSocketResponse) => {
				this.showConsole = true;
				this.processMessage(msg);
			},
			complete: () => {
				//Disconnected from server
				this.showServerInfo = false;
			}
		});
	}

	ngAfterViewInit(): void {
		//Scroll down console
		setTimeout(() => this.consoleDiv.nativeElement.scrollTop = this.consoleDiv?.nativeElement.scrollHeight)
	}

	/**
	 * On component destruction, unsubscribe to subject
	 */
	ngOnDestroy(): void {
		//Stop insights
		clearInterval(this.insightsInverval);
		//Remove subscription as this component is going mayday
		this.subscription.unsubscribe();
	}

		/**
		 * Process a new message from WebSockets
		 * @param response WebSocket message
		 */
		processMessage(response: WebSocketResponse): void {
		// console.log(`Received message from WebSocket (${this.server.serverName}): `, msg);
		let r;
		switch (response.status) {
			case 10:
				//Console output
				r = response as ConsoleOutputResponse;
				this.writeToWebConsole(r.message, r.time);
				break;
			case 200:
				//LoggedIn
				r = response as LoggedInResponse;
				this.loggedInUsername = r.username;
				this.loggedInAs = r.as;
				break;
			case 400:
				//Unknown
				r = response as UnknownCommandResponse;
				console.log("400 Unknown Comamnd", r);
				break;
			case 401:
				//Login Required
				r = response as LoginRequiredResponse;
				if (!this.activeConnection.isLoggedIn) {
					if (this.server.serverPassword && !this.savedPasswordSent) {
						this.savedPasswordSent = true;
						this.webConsoleService.sendMessage(this.server.serverName, WebSocketCommandEnum.Login, this.server.serverPassword);
					} else {
						this.requestPassword();
					}
				}
				break;
			case 1000:
				//Players
				r = response as PlayersResponse;
				this.connectedPlayers = r.connectedPlayers;
				this.maxPlayers = r.maxPlayers;
				break;
			case 1001:
				//CPU Usage
				r = response as CpuResponse;
				this.cpuUsage = r.usage;
				break;
			case 1002:
				//RAM usage
				r = response as RamResponse;
				this.ramFree = r.free;
				this.ramUsed = r.used;
				this.ramMax = r.max;
				break;
			case 1003:
				//TPS
				r = response as TpsResponse;
				this.tps = r.tps;
				break;
			// File Manager responses
			case 2000:
				//File List
				try {
					const listResponse = response as any;
					this.files = JSON.parse(listResponse.files) as FileInfo[];
					this.files.sort((a, b) => {
						if (a.is_folder && !b.is_folder) return -1;
						if (!a.is_folder && b.is_folder) return 1;
						return a.name.localeCompare(b.name);
					});
					this.updatePathParts(listResponse.currentPath);
				} catch (e) {
					console.error('Error parsing file list:', e);
				}
				this.loading = false;
				break;
			case 2001:
				//File Read
				this.loading = false;
				const fileReadResponse = response as any;
				try {
					const fileContent = JSON.parse(fileReadResponse.content);
					this.fileContent = fileContent.is_binary ? atob(fileContent.content) : fileContent.content;
					this.originalFileContent = this.fileContent;
					this.fileContentChanged = false;
				} catch (e) {
					console.error('Error parsing file content:', e);
					this.fileContent = '';
				}
				break;
			case 2002:
			case 200:
				//File Write / Operation success
				this.loading = false;
				this.loadFiles(this.currentPath);
				break;
			case 2003:
				//File Download
				this.loading = false;
				const downloadResponse = response as any;
				try {
					const content = JSON.parse(downloadResponse.content);
					this.downloadFileContent(content);
				} catch (e) {
					console.error('Error processing download:', e);
				}
				break;
			case 400:
			case 403:
			case 404:
			case 500:
				//Error
				const errorResponse = response as any;
				this.loading = false;
				alert(errorResponse.message);
				break;
			default:
				//Not recognised response
				console.error("Unrecognised response:", response);
				break;
		}
	}

	/**
	 * Sanitize and print message to console
	 * @param msg Message to print
	 * @param time Time, if applicable
	 */
	private writeToWebConsole(msg: string, time: string) {
		this.keepScrollDown = this.consoleDiv?.nativeElement.scrollHeight - this.consoleDiv?.nativeElement.scrollTop === this.consoleDiv?.nativeElement.clientHeight;

		//Write to div, replacing < to &lt; (to avoid XSS) and replacing new line to br.
		msg = msg.replace(/</g, "&lt;");
		msg = msg.replace(/(?:\r\n|\r|\n)/g, "<br>");

		//Color filter for MC codes.
		msg = msg.replace(/§0/g, "<span style='color: #000000;'>"); //&0
		msg = msg.replace(/§1/g, "<span style='color: #0000AA;'>"); //&1
		msg = msg.replace(/§2/g, "<span style='color: #00AA00;'>"); //&2
		msg = msg.replace(/§3/g, "<span style='color: #00AAAA;'>"); //&3
		msg = msg.replace(/§4/g, "<span style='color: #AA0000;'>"); //&4
		msg = msg.replace(/§5/g, "<span style='color: #AA00AA;'>"); //&5
		msg = msg.replace(/§6/g, "<span style='color: #FFAA00;'>"); //&6
		msg = msg.replace(/§7/g, "<span style='color: #AAAAAA;'>"); //&7
		msg = msg.replace(/§8/g, "<span style='color: #555555;'>"); //&8
		msg = msg.replace(/§9/g, "<span style='color: #5555FF;'>"); //&9
		msg = msg.replace(/§a/g, "<span style='color: #55FF55;'>"); //&a
		msg = msg.replace(/§b/g, "<span style='color: #55FFFF;'>"); //&b
		msg = msg.replace(/§c/g, "<span style='color: #FF5555;'>"); //&c
		msg = msg.replace(/§d/g, "<span style='color: #FF55FF;'>"); //&d
		msg = msg.replace(/§e/g, "<span style='color: #FFFF55;'>"); //&e
		msg = msg.replace(/§f/g, "<span style='color: #FFFFFF;'>"); //&f

		msg = msg.replace(/§l/g, "<span style='font-weight:bold;'>"); //&l
		msg = msg.replace(/§m/g, "<span style='text-decoration: line-through;'>"); //&m
		msg = msg.replace(/§n/g, "<span style='text-decoration: underline;'>"); //&n
		msg = msg.replace(/§o/g, "<span style='font-style: italic;'>"); //&o

		msg = msg.replace(/§r/g, "</span>");  //&r

		//Color filter for MC 1.18 (Also easy :D)
		msg = msg.replace(/0/g, "<span style='color: #000000;'>"); //&0
		msg = msg.replace(/1/g, "<span style='color: #0000AA;'>"); //&1
		msg = msg.replace(/2/g, "<span style='color: #00AA00;'>"); //&2
		msg = msg.replace(/3/g, "<span style='color: #00AAAA;'>"); //&3
		msg = msg.replace(/4/g, "<span style='color: #AA0000;'>"); //&4
		msg = msg.replace(/5/g, "<span style='color: #AA00AA;'>"); //&5
		msg = msg.replace(/6/g, "<span style='color: #FFAA00;'>"); //&6
		msg = msg.replace(/7/g, "<span style='color: #AAAAAA;'>"); //&7
		msg = msg.replace(/8/g, "<span style='color: #555555;'>"); //&8
		msg = msg.replace(/9/g, "<span style='color: #5555FF;'>"); //&9
		msg = msg.replace(/a/g, "<span style='color: #55FF55;'>"); //&a
		msg = msg.replace(/b/g, "<span style='color: #55FFFF;'>"); //&b
		msg = msg.replace(/c/g, "<span style='color: #FF5555;'>"); //&c
		msg = msg.replace(/d/g, "<span style='color: #FF55FF;'>"); //&d
		msg = msg.replace(/e/g, "<span style='color: #FFFF55;'>"); //&e
		msg = msg.replace(/f/g, "<span style='color: #FFFFFF;'>"); //&f

		msg = msg.replace(/l/g, "<span style='font-weight:bold;'>"); //&l
		msg = msg.replace(/m/g, "<span style='text-decoration: line-through;'>"); //&m
		msg = msg.replace(/n/g, "<span style='text-decoration: underline;'>"); //&n
		msg = msg.replace(/o/g, "<span style='font-style: italic;'>"); //&o

		msg = msg.replace(/r/g, "</span>");  //&r

		// ANSI Processing
		var ansi_up = new AnsiUp();
    	msg = ansi_up.ansi_to_html(msg);
		
		//Append datetime if enabled
		if (this.storageService.getSetting(SettingsEnum.DateTimePrefix)) {
			if (typeof time !== 'undefined' && time !== null) //if time is present and not null
				msg = "[" + time + "] " + msg;
			else if (typeof time !== 'undefined' && time === null) //if time is present and null
				null; //no time (is already printed)
			else
				msg = "[" + new Date().toLocaleTimeString() + "] " + msg;
		}

		//Append HTML
		const spanCount = (msg.match(/<span /g) || []).length; //Number of times a color is applied
		const spanCloseCount = (msg.match(/<\/span> /g) || []).length; //Number of already existing </span>
		const numberOfUnclosedSpans: number = spanCount - spanCloseCount; //Number of </span> pending to be closed
		this.consoleHtml += msg + ("</span>".repeat(numberOfUnclosedSpans)) + "<br>"; //Append to console the message, plus the required </span>'s, plus a line break
	}

	/**
	 * Open password request modal
	 */
	requestPassword(): void {
		this.modalService.open(this.passwordModal, { size: 'md' });
	}

	/**
	 * Try to login against server
	 * @param password Password to send
	 * @param rememberPassword If true, save password in localStorage
	 */
	setPassword(password: string, rememberPassword: boolean): void {
		//Edit server if remember password checkbox is checked
		if (rememberPassword)
			this.storageService.saveServer(this.server.serverName, this.server.serverURI, password);

		setTimeout(() => this.savedPasswordSent = true, 200)

		//Send login message
		this.webConsoleService.sendMessage(this.server.serverName, WebSocketCommandEnum.Login, password);
	}

	/**
	 * Send command typed in the command input
	 */
	sendCommand(): void {
		const cmd: string = this.commandInput.nativeElement.value;
		if (!cmd)
			return;

		//Clear input
		this.commandInput.nativeElement.value = "";
		this.browsingCommandHistoryIndex = -1;
		this.webConsoleService.sendMessage(this.server.serverName, WebSocketCommandEnum.Exec, cmd);
	}

	/**
	 * Called when a key is pressed in the command input
	 * @param e KeyboardEvent
	 */
	onKeyUpCommandInput(e: KeyboardEvent): void {
		if (e.code === 'Enter') { //Detect enter key
			this.sendCommand();
		} else if (e.code === "ArrowUp") { //Replace with older command
			//Get list of sent commands
			const sentCommands: WebSocketCommand[] = this.activeConnection.sentCommands.filter(e => e.command === WebSocketCommandEnum.Exec);

			//If no command was sent yet, return
			if (sentCommands.length == 0)
				return;

			//If this is the first time arrow up is pressed, start browsing history
			if (this.browsingCommandHistoryIndex <= 0)
				this.browsingCommandHistoryIndex = sentCommands.length;

			//Set command in our input component
			this.commandInput.nativeElement.value = sentCommands[this.browsingCommandHistoryIndex - 1]?.params;
			this.browsingCommandHistoryIndex = this.browsingCommandHistoryIndex - 1;
		} else if (e.code === "ArrowDown") { //Replace with newer command
			//Get list of sent commands
			const sentCommands: WebSocketCommand[] = this.activeConnection.sentCommands.filter(e => e.command === WebSocketCommandEnum.Exec);

			//If not browsing history, do nothing
			if (this.browsingCommandHistoryIndex !== -1) {
				//Go back to index 0 if overflow
				if (this.browsingCommandHistoryIndex >= sentCommands.length - 1)
					this.browsingCommandHistoryIndex = -1;

				//Set command in our input component
				this.commandInput.nativeElement.value = sentCommands[this.browsingCommandHistoryIndex + 1]?.params;
				this.browsingCommandHistoryIndex = this.browsingCommandHistoryIndex + 1;
			}
		} else if (e.code == "tab") { //Detect tab key
			//Suggest user from connected Players
			//TODO tab not being detected :(
		}
	}

	/**
	 * Request server insights
	 */
	requestServerInsights(): void {
		if (this.showServerInfo && this.showConsole && this.activeConnection.connectionStatus == ConnectionStatusEnum.Connected && this.activeConnection.isLoggedIn) {
			this.webConsoleService.sendMessage(this.server.serverName, WebSocketCommandEnum.Players);
			this.webConsoleService.sendMessage(this.server.serverName, WebSocketCommandEnum.CpuUsage);
			this.webConsoleService.sendMessage(this.server.serverName, WebSocketCommandEnum.RamUsage);
			this.webConsoleService.sendMessage(this.server.serverName, WebSocketCommandEnum.Tps);
		}

	}

	// ==================== File Manager Methods ====================

	navigateToRoot(): void {
		this.loadFiles(this.serverDirectory);
	}

	navigateToPath(index: number): void {
		const newPath = this.serverDirectory + '/' + this.pathParts.slice(0, index + 1).join('/');
		this.loadFiles(newPath);
	}

	navigateToFolder(file: FileInfo): void {
		const newPath = this.currentPath === this.serverDirectory 
			? this.currentPath + file.name 
			: this.currentPath + '/' + file.name;
		this.loadFiles(newPath);
	}

	goUp(): void {
		if (this.currentPath === this.serverDirectory) return;
		
		const lastSlashIndex = this.currentPath.lastIndexOf('/');
		if (lastSlashIndex <= this.serverDirectory.length) {
			this.loadFiles(this.serverDirectory);
		} else {
			this.loadFiles(this.currentPath.substring(0, lastSlashIndex));
		}
	}

	refreshFiles(): void {
		this.loadFiles(this.currentPath);
	}

	loadFiles(path: string): void {
		this.loading = true;
		this.webConsoleService.sendMessage(this.server.serverName, WebSocketCommandEnum.FileList, path);
	}

	updatePathParts(path: string): void {
		this.currentPath = path;
		if (this.serverDirectory === '') {
			this.serverDirectory = path;
		}
		if (path === this.serverDirectory || path === '') {
			this.pathParts = [];
		} else {
			const relativePath = path.replace(this.serverDirectory, '').replace(/^\//, '');
			this.pathParts = relativePath.split('/');
		}
	}

	selectFile(file: FileInfo): void {
		this.loading = true;
		const filePath = this.currentPath === this.serverDirectory 
			? this.currentPath + file.name 
			: this.currentPath + '/' + file.name;
		
		this.webConsoleService.sendMessage(this.server.serverName, WebSocketCommandEnum.FileRead, JSON.stringify({ path: filePath }));
		this.editingFile = file;
	}

	onContentChange(): void {
		this.fileContentChanged = this.fileContent !== this.originalFileContent;
	}

	saveFile(): void {
		if (!this.editingFile) return;
		
		this.loading = true;
		const filePath = this.currentPath === this.serverDirectory 
			? this.currentPath + this.editingFile.name 
			: this.currentPath + '/' + this.editingFile.name;
		
		this.webConsoleService.sendMessage(
			this.server.serverName, 
			WebSocketCommandEnum.FileWrite, 
			JSON.stringify({ path: filePath, content: this.fileContent })
		);
		this.fileContentChanged = false;
	}

	cancelEdit(): void {
		this.editingFile = null;
		this.fileContent = '';
		this.originalFileContent = '';
		this.fileContentChanged = false;
	}

	formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	triggerFileInput(): void {
		this.fileInput.nativeElement.click();
	}

	onFilesSelected(event: any): void {
		const files = event.target.files;
		if (files.length === 0) return;

		this.loading = true;
		let uploadedCount = 0;
		const totalFiles = files.length;

		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			const reader = new FileReader();
			reader.onload = (e: any) => {
				const base64Content = e.target.result.split(',')[1];
				
				const filePath = this.currentPath === this.serverDirectory 
					? this.currentPath + file.name 
					: this.currentPath + '/' + file.name;
				
				this.webConsoleService.sendMessage(
					this.server.serverName,
					WebSocketCommandEnum.FileWrite,
					JSON.stringify({ path: filePath, content: base64Content })
				);
				
				uploadedCount++;
				if (uploadedCount === totalFiles) {
					this.loading = false;
					this.loadFiles(this.currentPath);
				}
			};
			reader.readAsDataURL(file);
		}
	}

	downloadFile(file: FileInfo, event: Event): void {
		event.stopPropagation();
		
		this.loading = true;
		const filePath = this.currentPath === this.serverDirectory 
			? this.currentPath + file.name 
			: this.currentPath + '/' + file.name;
		
		this.webConsoleService.sendMessage(
			this.server.serverName,
			WebSocketCommandEnum.FileDownload,
			JSON.stringify({ path: filePath })
		);
	}

	downloadFileContent(content: any): void {
		const blob = this.base64ToBlob(content.content);
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = content.filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		window.URL.revokeObjectURL(url);
	}

	base64ToBlob(base64: string): Blob {
		const byteCharacters = atob(base64);
		const byteNumbers = new Array(byteCharacters.length);
		for (let i = 0; i < byteCharacters.length; i++) {
			byteNumbers[i] = byteCharacters.charCodeAt(i);
		}
		const byteArray = new Uint8Array(byteNumbers);
		return new Blob([byteArray]);
	}

	deleteFile(file: FileInfo, event: Event): void {
		event.stopPropagation();
		this.selectedContextFile = file;
		this.showDeleteConfirmModal = true;
	}

	confirmDelete(): void {
		if (!this.selectedContextFile) return;
		
		this.loading = true;
		const filePath = this.currentPath === this.serverDirectory 
			? this.currentPath + this.selectedContextFile.name 
			: this.currentPath + '/' + this.selectedContextFile.name;
		
		this.webConsoleService.sendMessage(
			this.server.serverName,
			WebSocketCommandEnum.FileDelete,
			JSON.stringify({ path: filePath })
		);
		
		this.showDeleteConfirmModal = false;
		this.selectedContextFile = null;
	}

	renameFile(): void {
		if (!this.selectedContextFile || !this.renameNewName) return;
		
		this.loading = true;
		const oldPath = this.currentPath === this.serverDirectory 
			? this.currentPath + this.selectedContextFile.name 
			: this.currentPath + '/' + this.selectedContextFile.name;
		
		const newPath = this.currentPath === this.serverDirectory 
			? this.currentPath + this.renameNewName 
			: this.currentPath + '/' + this.renameNewName;
		
		this.webConsoleService.sendMessage(
			this.server.serverName,
			WebSocketCommandEnum.FileRename,
			JSON.stringify({ oldPath, newPath })
		);
		
		this.showRenameModal = false;
		this.renameNewName = '';
		this.selectedContextFile = null;
	}

	createFolder(): void {
		if (!this.newFolderName) return;
		
		this.loading = true;
		const folderPath = this.currentPath === this.serverDirectory 
			? this.currentPath + this.newFolderName 
			: this.currentPath + '/' + this.newFolderName;
		
		this.webConsoleService.sendMessage(
			this.server.serverName,
			WebSocketCommandEnum.FileCreateFolder,
			JSON.stringify({ path: folderPath })
		);
		
		this.showCreateFolderModal = false;
		this.newFolderName = '';
	}

	createFile(): void {
		if (!this.newFileName) return;
		
		this.loading = true;
		const filePath = this.currentPath === this.serverDirectory 
			? this.currentPath + this.newFileName 
			: this.currentPath + '/' + this.newFileName;
		
		this.webConsoleService.sendMessage(
			this.server.serverName,
			WebSocketCommandEnum.FileWrite,
			JSON.stringify({ path: filePath, content: '' })
		);
		
		this.showCreateFileModal = false;
		this.newFileName = '';
	}

	onContextMenu(event: MouseEvent, file: FileInfo): void {
		event.preventDefault();
		this.selectedContextFile = file;
		this.contextMenuTop = event.clientY;
		this.contextMenuLeft = event.clientX;
		this.contextMenuVisible = true;
	}

	openFile(): void {
		if (this.selectedContextFile && !this.selectedContextFile.is_folder) {
			this.selectFile(this.selectedContextFile);
		}
		this.closeContextMenu();
	}

	downloadSelectedFile(): void {
		if (this.selectedContextFile) {
			this.downloadFile(this.selectedContextFile, new Event('click'));
		}
		this.closeContextMenu();
	}

	renameSelectedFile(): void {
		if (this.selectedContextFile) {
			this.renameNewName = this.selectedContextFile.name;
			this.showRenameModal = true;
		}
		this.closeContextMenu();
	}

	deleteSelectedFile(): void {
		if (this.selectedContextFile) {
			this.showDeleteConfirmModal = true;
		}
		this.closeContextMenu();
	}

	closeContextMenu(): void {
		this.contextMenuVisible = false;
		this.selectedContextFile = null;
	}

	closeAllModals(): void {
		this.showCreateFolderModal = false;
		this.showCreateFileModal = false;
		this.showRenameModal = false;
		this.showDeleteConfirmModal = false;
		this.newFolderName = '';
		this.newFileName = '';
		this.renameNewName = '';
	}

}
