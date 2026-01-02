import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ActiveConnectionDto } from 'src/app/_dto/ActiveConnectionDto';
import { WebSocketCommandEnum } from 'src/app/_dto/command/WebSocketCommandEnum';
import { ConnectionStatusEnum } from 'src/app/_dto/ConnectionStatusEnum';
import { ServerDto } from 'src/app/_dto/ServerDto';
import { WebSocketResponse } from 'src/app/_dto/response/WebSocketResponse';
import { StorageService } from 'src/app/_services/storage.service';
import { WebconsoleService } from 'src/app/_services/webconsole.service';
import { FileInfo, FileListResponse, FileContent, FileDownloadContent, FileErrorResponse } from 'src/app/_dto/response/FileManagementResponses';

@Component({
    selector: 'app-files',
    templateUrl: './files.component.html',
    styleUrls: ['./files.component.scss']
})
export class FilesComponent implements OnInit, OnDestroy {
    @ViewChild('fileInput') fileInput!: ElementRef;
    @ViewChild('editorTextarea') editorTextarea!: ElementRef;

    server!: ServerDto;
    activeConnection!: ActiveConnectionDto;
    subscription!: Subscription;

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
        private modalService: NgbModal
    ) { }

    ngOnInit(): void {
        const routeParams: ParamMap = this.route.snapshot.paramMap;
        const serverName = routeParams.get('serverName');

        if (!serverName) {
            this.router.navigate(['']);
            return;
        }

        const serverObject = this.storageService.getServer(serverName);
        if (!serverObject) {
            this.router.navigate(['']);
            return;
        }

        this.server = serverObject;
        this.activeConnection = this.webConsoleService.connect(this.server.serverName);
        this.serverDirectory = '';

        this.subscription = this.activeConnection.subject$.subscribe({
            next: (msg: WebSocketResponse) => {
                this.processMessage(msg);
            }
        });

        this.loadFiles(this.serverDirectory);
    }

    ngOnDestroy(): void {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }

    processMessage(msg: WebSocketResponse): void {
        switch (msg.status) {
            case 2000:
                const listResponse = msg as unknown as FileListResponse;
                try {
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
                break;
            case 2001:
                this.loading = false;
                const fileReadResponse = msg as any;
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
                this.loading = false;
                this.loadFiles(this.currentPath);
                break;
            case 2003:
                this.loading = false;
                const downloadResponse = msg as any;
                try {
                    const content = JSON.parse(downloadResponse.content) as FileDownloadContent;
                    this.downloadFileContent(content);
                } catch (e) {
                    console.error('Error processing download:', e);
                }
                break;
            case 400:
            case 403:
            case 404:
            case 500:
                const errorResponse = msg as FileErrorResponse;
                this.loading = false;
                alert(errorResponse.message);
                break;
        }
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

    loadFiles(path: string): void {
        this.loading = true;
        this.webConsoleService.sendMessage(this.server.serverName, WebSocketCommandEnum.FileList, path);
    }

    refreshFiles(): void {
        this.loadFiles(this.currentPath);
    }

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

    getFileIcon(file: FileInfo): string {
        if (file.is_folder) return 'fa-folder text-warning';
        
        switch (file.icon) {
            case 'file-code': return 'fa-file-code text-primary';
            case 'file-json': return 'fa-file-code text-info';
            case 'file-text': return 'fa-file-alt text-secondary';
            case 'file-image': return 'fa-file-image text-success';
            case 'file-archive': return 'fa-file-archive text-warning';
            case 'file-audio': return 'fa-file-audio text-danger';
            case 'file-video': return 'fa-file-video text-primary';
            case 'file-database': return 'fa-database text-info';
            case 'folder': return 'fa-folder text-warning';
            default: return 'fa-file text-muted';
        }
    }

    formatFileSize(bytes: number): string {
        if (bytes === 0) return '-';
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

    downloadFileContent(content: FileDownloadContent): void {
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

    copyPath(): void {
        if (this.selectedContextFile) {
            const filePath = this.currentPath === this.serverDirectory 
                ? this.currentPath + this.selectedContextFile.name 
                : this.currentPath + '/' + this.selectedContextFile.name;
            navigator.clipboard.writeText(filePath);
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
