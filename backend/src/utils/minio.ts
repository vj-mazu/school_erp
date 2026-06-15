import fs from 'fs';
import path from 'path';

// For production reliability, we will support both a local static storage folder 
// (which behaves like a mock MinIO bucket) and direct file writes.
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export async function uploadFile(
  bucketName: string,
  fileName: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<string> {
  const targetPath = path.join(UPLOADS_DIR, fileName);
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(targetPath, fileBuffer);
  console.log(`[STORAGE UPLOAD] Uploaded ${fileName} to bucket ${bucketName} with type ${contentType}`);
  
  // Return the path route which we serve as a public static asset
  return `/uploads/${fileName}`;
}

export function getSignedUrl(filePath: string): string {
  // Mock MinIO 15-minute signed URL - just return the resource path since it's locally served
  return filePath;
}
