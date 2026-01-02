export interface FileInfo {
    name: string;
    is_folder: boolean;
    last_modified: number;
    size: number;
    icon: string;
}

export interface FileListResponse {
    status: number;
    message: string;
    files: string;
    currentPath: string;
}

export interface FileReadResponse {
    status: number;
    message: string;
    path: string;
    name: string;
    content: string;
    encoding: string;
    size: number;
    is_binary: boolean;
}

export interface FileContent {
    path: string;
    name: string;
    content: string;
    encoding: string;
    size: number;
    is_binary: boolean;
}

export interface FileOperationResponse {
    status: number;
    message: string;
    path: string;
}

export interface FileDownloadResponse {
    status: number;
    message: string;
    content: string;
}

export interface FileDownloadContent {
    filename: string;
    path: string;
    size: number;
    content: string;
}

export interface FileErrorResponse {
    status: number;
    message: string;
}
