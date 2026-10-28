import { BlobServiceClient } from '@azure/storage-blob';
import path from 'path';

// Get current timestamp in YYYYMMDD_HHmmss format
const getFormattedTimestamp = () => {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const YYYY = now.getFullYear();
    const MM = pad(now.getMonth() + 1);
    const DD = pad(now.getDate());
    const HH = pad(now.getHours());
    const mm = pad(now.getMinutes());
    const ss = pad(now.getSeconds());
    return `${YYYY}${MM}${DD}_${HH}${mm}${ss}`;
};

/**
 * Uploads a document to Azure Blob Storage
 * 
 * @param {Buffer} fileBuffer - The file buffer to upload
 * @param {string} originalName - The original file name
 * @param {string} mimeType - The mime type of the file
 * @param {string} tloId - The reference number of the user (e.g. TLO-0408)
 * @param {string} docType - The document type (e.g. photo, resume)
 * @returns {Promise<Object>} The blob metadata
 */
export const uploadToAzure = async (fileBuffer, originalName, mimeType, tloId, docType) => {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.AZURE_FOLDER_NAME || 'tlo-main';

    if (!connectionString) {
        throw new Error("AZURE_STORAGE_CONNECTION_STRING is not configured");
    }

    // Connect to Azure
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // Ensure container exists (create if not)
    // Note: If you don't have permissions to create containers, this might fail. 
    // In many setups, the container is pre-created and we just upload blobs.
    try {
        await containerClient.createIfNotExists();
    } catch (err) {
        console.warn(`[AzureUpload] Could not verify/create container (might exist already): ${err.message}`);
    }

    // Determine the extension
    const ext = path.extname(originalName) || '';

    // Generate unique filename: <docType>_<ReferenceNo>_<Timestamp>.<extension>
    const timestamp = getFormattedTimestamp();
    const docPrefix = docType ? `${docType}_` : '';
    const filename = `${docPrefix}${tloId}_${timestamp}${ext}`;

    // Generate virtual folder path: <TLOid>/<docType>/ or <TLOid>/
    // Blob path example: TLO-0408/photo/photo_TLO-0408_20260725_143015.jpg
    const blobPath = docType ? `${tloId}/${docType}/${filename}` : `${tloId}/${filename}`;

    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);

    console.log(`[AzureUpload] Uploading to Azure Blob Storage: ${containerName}/${blobPath}`);

    // Upload the buffer
    await blockBlobClient.uploadData(fileBuffer, {
        blobHTTPHeaders: {
            blobContentType: mimeType
        }
    });

    return {
        blobName: blobPath,
        blobUrl: blockBlobClient.url,
        url: blockBlobClient.url,
        folder: `${containerName}/${tloId}${docType ? `/${docType}` : ''}`,
        filename: filename
    };
};

/**
 * Downloads/streams a document from Azure Blob Storage using authenticated SDK
 * 
 * @param {string} blobUrlOrPath - The blob URL or relative blob path
 * @returns {Promise<{ readableStream: NodeJS.ReadableStream, contentType: string, contentLength: number }|null>}
 */
export const downloadFromAzure = async (blobUrlOrPath) => {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const defaultContainerName = process.env.AZURE_FOLDER_NAME || 'tlo-main';

    if (!connectionString || !blobUrlOrPath) {
        return null;
    }

    try {
        let targetContainer = defaultContainerName;
        let blobPath = blobUrlOrPath;

        if (blobUrlOrPath.startsWith('http://') || blobUrlOrPath.startsWith('https://')) {
            const urlObj = new URL(blobUrlOrPath);
            const pathParts = urlObj.pathname.split('/').filter(Boolean);
            if (pathParts.length > 1) {
                targetContainer = pathParts[0];
                blobPath = pathParts.slice(1).join('/');
            } else if (pathParts.length === 1) {
                blobPath = pathParts[0];
            }
        }

        if (!targetContainer) {
            targetContainer = process.env.AZURE_FOLDER_NAME || 'tlo-main';
        }

        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient(targetContainer);
        const blockBlobClient = containerClient.getBlockBlobClient(blobPath);

        const downloadBlockBlobResponse = await blockBlobClient.download(0);
        return {
            readableStream: downloadBlockBlobResponse.readableStreamBody,
            contentType: downloadBlockBlobResponse.contentType,
            contentLength: downloadBlockBlobResponse.contentLength
        };
    } catch (err) {
        console.error(`[AzureDownload] Failed to download blob (${blobUrlOrPath}):`, err.message);
        return null;
    }
};

/**
 * Copies an existing blob (e.g. from APP-<id>/<docType>/...) to the canonical TLO prefix:
 * <targetTloId>/<docType>/<docType>_<targetTloId>_<timestamp>.<ext>
 * and returns the new blob metadata.
 * 
 * @param {string} sourceBlobUrlOrPath 
 * @param {string} targetTloId e.g. 'TLO-0790'
 * @param {string} docType e.g. 'pds', 'wes', 'cv'
 * @returns {Promise<{ blobUrl: string, blobName: string, container: string, filename: string }|null>}
 */
export const copyBlobToTloid = async (sourceBlobUrlOrPath, targetTloId, docType) => {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const defaultContainerName = process.env.AZURE_FOLDER_NAME || 'tlo-main';

    if (!connectionString || !sourceBlobUrlOrPath || !targetTloId) {
        return null;
    }

    try {
        let sourceContainer = defaultContainerName;
        let sourceBlobPath = sourceBlobUrlOrPath;

        if (sourceBlobUrlOrPath.startsWith('http://') || sourceBlobUrlOrPath.startsWith('https://')) {
            const urlObj = new URL(sourceBlobUrlOrPath);
            const pathParts = urlObj.pathname.split('/').filter(Boolean);
            if (pathParts.length > 1) {
                sourceContainer = pathParts[0];
                sourceBlobPath = pathParts.slice(1).join('/');
            } else if (pathParts.length === 1) {
                sourceBlobPath = pathParts[0];
            }
        }

        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const sourceContainerClient = blobServiceClient.getContainerClient(sourceContainer);
        const sourceBlockBlobClient = sourceContainerClient.getBlockBlobClient(sourceBlobPath);

        // Verify source blob exists
        const exists = await sourceBlockBlobClient.exists();
        if (!exists) {
            console.warn(`[AzureCopy] Source blob does not exist: ${sourceContainer}/${sourceBlobPath}`);
            return null;
        }

        // Determine target path: <targetTloId>/<docType>/<docType>_<targetTloId>_<timestamp>.<ext>
        const ext = path.extname(sourceBlobPath) || '.pdf';
        const timestamp = getFormattedTimestamp();
        const docPrefix = docType ? `${docType}_` : '';
        const targetFilename = `${docPrefix}${targetTloId}_${timestamp}${ext}`;
        const targetBlobPath = docType ? `${targetTloId}/${docType}/${targetFilename}` : `${targetTloId}/${targetFilename}`;

        const targetContainer = defaultContainerName;
        const targetContainerClient = blobServiceClient.getContainerClient(targetContainer);
        const targetBlockBlobClient = targetContainerClient.getBlockBlobClient(targetBlobPath);

        // Copy source blob to target
        const copyPoller = await targetBlockBlobClient.beginCopyFromURL(sourceBlockBlobClient.url);
        await copyPoller.pollUntilDone();

        console.log(`[AzureCopy] Successfully copied ${sourceBlobPath} -> ${targetContainer}/${targetBlobPath}`);

        return {
            blobUrl: targetBlockBlobClient.url,
            blobName: targetBlobPath,
            container: targetContainer,
            filename: targetFilename
        };
    } catch (err) {
        console.error(`[AzureCopy] Error copying blob (${sourceBlobUrlOrPath} -> ${targetTloId}):`, err.message);
        return null;
    }
};


