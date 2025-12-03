export interface FileTransferState {
    transferId: string;
    fileId: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    chunksTotal: number;
    chunksReceived: number;
    progress: number; // 0-100
    status: 'pending' | 'transferring' | 'paused' | 'completed' | 'error';
    isUpload: boolean;
    peerSocketId: string;
    data?: ArrayBuffer; // For receiver
    chunks?: Map<number, ArrayBuffer>; // For receiver
    startTime: number;
    isDirect?: boolean;
    peerUsername?: string;
}

export class FileTransferManager {
    private static CHUNK_SIZE = 64 * 1024; // 64KB chunks

    static calculateChunks(size: number): number {
        return Math.ceil(size / this.CHUNK_SIZE);
    }

    static async sliceFile(file: File): Promise<ArrayBuffer[]> {
        const chunks: ArrayBuffer[] = [];
        let offset = 0;
        while (offset < file.size) {
            const chunk = file.slice(offset, offset + this.CHUNK_SIZE);
            chunks.push(await chunk.arrayBuffer());
            offset += this.CHUNK_SIZE;
        }
        return chunks;
    }

    static reassembleFile(chunks: Map<number, ArrayBuffer>, totalChunks: number, type: string): Blob {
        const sortedChunks: ArrayBuffer[] = [];
        for (let i = 0; i < totalChunks; i++) {
            const chunk = chunks.get(i);
            if (chunk) sortedChunks.push(chunk);
        }
        return new Blob(sortedChunks, { type });
    }
}
