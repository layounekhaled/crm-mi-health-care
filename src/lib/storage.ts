// Server-only storage module — uses MinIO (S3-compatible) for file storage
// Re-exports pure utilities from storage-utils.ts for convenience in API routes
// IMPORTANT: this module must only be imported from server-side code (API routes, server components)

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Upload } from '@aws-sdk/lib-storage'

// Re-export everything from storage-utils so API routes can still import from '@/lib/storage'
export {
  BRAND_FOLDERS,
  getPublicUrl,
  formatFileSize,
} from './storage-utils'

import { BRAND_FOLDERS, getPublicUrl } from './storage-utils'

// ─── S3 / MinIO Configuration ────────────────────────────────────────────────

function getS3Config() {
  const endpoint = process.env.S3_ENDPOINT || 'http://156.67.26.104:9000'
  const accessKey = process.env.S3_ACCESS_KEY || ''
  const secretKey = process.env.S3_SECRET_KEY || ''
  const region = process.env.S3_REGION || 'us-east-1'
  return { endpoint, accessKey, secretKey, region }
}

function getS3Client(): S3Client {
  const { endpoint, accessKey, secretKey, region } = getS3Config()
  return new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
    forcePathStyle: true, // Required for MinIO
  })
}

function getDocumentsBucket(): string {
  return process.env.S3_BUCKET_DOCUMENTS || process.env.S3_BUCKET_DOCS || 'dalia-documents'
}

function getMediaBucket(): string {
  return process.env.S3_BUCKET_MEDIA || 'dalia-media'
}

function getBackupsBucket(): string {
  return process.env.S3_BUCKET_BACKUPS || 'dalia-backups'
}

// ─── Public URL helpers ──────────────────────────────────────────────────────

/**
 * Build the public URL for an object.
 * Always uses /api/files/ proxy route so files are served over HTTPS
 * and don't expose the internal MinIO endpoint.
 * Format: /api/files/{key}?bucket={bucketType}
 */
function buildPublicUrl(bucket: string, key: string): string {
  // Use /api/files/ proxy — works over HTTPS and doesn't need MinIO to be publicly accessible
  const bucketType = bucket === 'dalia-media' ? 'media'
    : bucket === 'dalia-backups' ? 'backups'
    : 'documents'
  return `/api/files/${key}?bucket=${bucketType}`
}

// ─── Upload ──────────────────────────────────────────────────────────────────

/**
 * Upload a file to MinIO S3 Storage
 * @param filePath - relative path like "mir/1234567_file.pdf"
 * @param file - File, Blob, or Buffer to upload
 * @param contentType - MIME type (default: application/pdf)
 * @param bucketType - 'documents' | 'media' | 'backups' (default: 'documents')
 * @returns { url: public URL to access the file, pathname: relative path stored in DB }
 */
export async function uploadFile(
  filePath: string,
  file: File | Blob | Buffer,
  contentType?: string,
  bucketType: 'documents' | 'media' | 'backups' = 'documents'
): Promise<{ url: string; pathname: string }> {
  const client = getS3Client()
  const bucket = bucketType === 'media' ? getMediaBucket()
    : bucketType === 'backups' ? getBackupsBucket()
    : getDocumentsBucket()

  // Convert to Buffer/Uint8Array
  let body: Buffer | Uint8Array | ReadableStream
  if (Buffer.isBuffer(file)) {
    body = file
  } else {
    // File or Blob → ArrayBuffer → Buffer
    const arrayBuffer = await file.arrayBuffer()
    body = Buffer.from(arrayBuffer)
  }

  // Use multipart upload for large files (>5MB), simple put otherwise
  const size = body.length
  if (size > 5 * 1024 * 1024) {
    const upload = new Upload({
      client,
      params: {
        Bucket: bucket,
        Key: filePath,
        Body: body,
        ContentType: contentType || 'application/pdf',
      },
    })
    await upload.done()
  } else {
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: filePath,
      Body: body,
      ContentType: contentType || 'application/pdf',
    }))
  }

  const publicUrl = buildPublicUrl(bucket, filePath)

  return {
    url: publicUrl,
    pathname: filePath,
  }
}

// ─── Delete ──────────────────────────────────────────────────────────────────

/**
 * Delete a file from MinIO S3 Storage.
 * Accepts either a full URL or a pathname (key).
 */
export async function deleteFile(urlOrPath: string, bucketType: 'documents' | 'media' | 'backups' = 'documents'): Promise<void> {
  const client = getS3Client()
  const bucket = bucketType === 'media' ? getMediaBucket()
    : bucketType === 'backups' ? getBackupsBucket()
    : getDocumentsBucket()

  let key = urlOrPath

  // If it's a full URL, extract the key after the bucket name
  if (urlOrPath.startsWith('http')) {
    try {
      const url = new URL(urlOrPath)
      // Path format: /bucket/key
      const pathParts = url.pathname.split('/')
      // Remove empty first element and bucket name
      const bucketIndex = pathParts.findIndex(p => p === bucket)
      if (bucketIndex >= 0) {
        key = pathParts.slice(bucketIndex + 1).join('/')
      } else {
        key = pathParts.filter(p => p).join('/')
      }
    } catch {
      key = urlOrPath
    }
  }

  // Also handle old Vercel Blob URLs — skip deletion for those
  if (urlOrPath.includes('vercel-storage.com') || urlOrPath.includes('blob.vercel-storage.com')) {
    console.log(`[STORAGE] Skipping deletion of old Vercel Blob URL: ${urlOrPath.substring(0, 80)}...`)
    return
  }

  try {
    await client.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }))
  } catch (err) {
    console.error('[STORAGE_DELETE_ERROR]', err)
  }
}

// ─── List ────────────────────────────────────────────────────────────────────

/**
 * List files in a bucket with an optional prefix
 */
export async function listFiles(prefix?: string, bucketType: 'documents' | 'media' | 'backups' = 'documents') {
  const client = getS3Client()
  const bucket = bucketType === 'media' ? getMediaBucket()
    : bucketType === 'backups' ? getBackupsBucket()
    : getDocumentsBucket()

  try {
    const result = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix || undefined,
      MaxKeys: 100,
    }))

    return {
      blobs: (result.Contents || []).map((obj) => ({
        pathname: obj.Key || '',
        url: buildPublicUrl(bucket, obj.Key || ''),
        size: obj.Size || 0,
        lastModified: obj.LastModified,
      })),
    }
  } catch (err) {
    console.error('[STORAGE_LIST_ERROR]', err)
    return { blobs: [] }
  }
}

// ─── Head (metadata) ────────────────────────────────────────────────────────

/**
 * Get file metadata from MinIO
 */
export async function getFileHead(key: string, bucketType: 'documents' | 'media' | 'backups' = 'documents') {
  const client = getS3Client()
  const bucket = bucketType === 'media' ? getMediaBucket()
    : bucketType === 'backups' ? getBackupsBucket()
    : getDocumentsBucket()

  try {
    const result = await client.send(new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    }))

    return {
      size: result.ContentLength || 0,
      lastModified: result.LastModified,
      contentType: result.ContentType,
      pathname: key,
      url: buildPublicUrl(bucket, key),
    }
  } catch {
    return null
  }
}

// ─── Read file content ──────────────────────────────────────────────────────

/**
 * Read file content as a Buffer from MinIO
 */
export async function readFileContent(filePath: string, bucketType: 'documents' | 'media' | 'backups' = 'documents'): Promise<Buffer | null> {
  const client = getS3Client()
  const bucket = bucketType === 'media' ? getMediaBucket()
    : bucketType === 'backups' ? getBackupsBucket()
    : getDocumentsBucket()

  try {
    const result = await client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: filePath,
    }))

    if (!result.Body) return null

    const bytes = await result.Body.transformToByteArray()
    return Buffer.from(bytes)
  } catch (err) {
    console.error('[STORAGE_READ_ERROR]', err)
    return null
  }
}

// ─── Pre-signed URLs ────────────────────────────────────────────────────────

/**
 * Generate a pre-signed URL for temporary access to a private file.
 * Default expiry: 1 hour (3600 seconds).
 */
export async function getPresignedUrl(
  key: string,
  bucketType: 'documents' | 'media' | 'backups' = 'documents',
  expiresIn: number = 3600
): Promise<string> {
  const client = getS3Client()
  const bucket = bucketType === 'media' ? getMediaBucket()
    : bucketType === 'backups' ? getBackupsBucket()
    : getDocumentsBucket()

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  })

  return getSignedUrl(client, command, { expiresIn })
}

// ─── Copy (for migration) ──────────────────────────────────────────────────

/**
 * Copy an object within MinIO (useful for reorganizing files)
 */
export async function copyFile(
  sourceKey: string,
  destKey: string,
  bucketType: 'documents' | 'media' | 'backups' = 'documents'
): Promise<void> {
  const client = getS3Client()
  const bucket = bucketType === 'media' ? getMediaBucket()
    : bucketType === 'backups' ? getBackupsBucket()
    : getDocumentsBucket()

  await client.send(new CopyObjectCommand({
    Bucket: bucket,
    CopySource: `${bucket}/${sourceKey}`,
    Key: destKey,
  }))
}

// ─── Bucket helpers ─────────────────────────────────────────────────────────

export { getDocumentsBucket, getMediaBucket, getBackupsBucket, buildPublicUrl }
