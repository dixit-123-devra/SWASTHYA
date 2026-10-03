const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
require('dotenv').config();

// MOCK: If no credentials exist, we use a mock client
let s3Client;
const isMock = !process.env.AWS_ACCESS_KEY_ID;

if (!isMock) {
  s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
  });
  console.log('AWS S3 Client initialized securely.');
} else {
  console.log('⚠️ Running S3 in MOCK mode (No credentials provided)');
}

/**
 * Generate a pre-signed URL for a specific patient's isolated folder.
 * Ensures strict role-based routing (e.g. patients/${uniqueId}/lab_reports/)
 */
const generatePresignedUrl = async (uniqueId, folderType, fileName) => {
  const bucket = process.env.AWS_S3_BUCKET || 'mediaccess-secure-vault';
  const objectKey = `patients/${uniqueId}/${folderType}/${fileName}`;
  
  if (isMock) {
    return {
      url: `https://mock-s3-bucket.amazonaws.com/${objectKey}?signature=mock123`,
      key: objectKey
    };
  }

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: objectKey,
  });

  // URL expires in 15 minutes (900 seconds)
  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
  return { url: signedUrl, key: objectKey };
};

/**
 * Upload a FHIR JSON document to the patient's isolated S3 folder
 */
const uploadFhirDocument = async (uniqueId, folderType, fileName, jsonData) => {
  const bucket = process.env.AWS_S3_BUCKET || 'mediaccess-secure-vault';
  const objectKey = `patients/${uniqueId}/${folderType}/${fileName}`;
  
  if (isMock) {
    console.log(`[MOCK S3] Uploaded FHIR doc to ${bucket}/${objectKey}`);
    return { success: true, key: objectKey };
  }

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    Body: JSON.stringify(jsonData),
    ContentType: 'application/json'
  });

  await s3Client.send(command);
  return { success: true, key: objectKey };
};

const uploadRawDocument = async (uniqueId, folderType, fileName, buffer, mimeType) => {
  const bucket = process.env.AWS_S3_BUCKET || 'mediaccess-secure-vault';
  const objectKey = `patients/${uniqueId}/${folderType}/${fileName}`;
  
  if (isMock) {
    console.log(`[MOCK S3] Uploaded raw file to ${bucket}/${objectKey}`);
    return { success: true, key: objectKey };
  }

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    Body: buffer,
    ContentType: mimeType
  });

  await s3Client.send(command);
  return { success: true, key: objectKey };
};

module.exports = { generatePresignedUrl, uploadFhirDocument, uploadRawDocument };
