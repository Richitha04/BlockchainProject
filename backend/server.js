const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Tesseract = require('tesseract.js');
const { ethers } = require('ethers');
require('@tensorflow/tfjs-node');
const faceapi = require('@vladmandic/face-api');
const canvas = require('canvas');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL_DIR = path.join(__dirname, 'models');
const FACE_DISTANCE_THRESHOLD = Number(process.env.FACE_DISTANCE_THRESHOLD || 0.5);

const { Canvas, Image, ImageData, loadImage } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

app.use(cors());
app.use(express.json());

// Multer storage config for uploaded files.
const upload = multer({
  dest: path.join(__dirname, 'uploads'),
  limits: {
    fileSize: 6 * 1024 * 1024, // 6MB limit per image
  },
});

// Initialize Ethereum objects from environment variables.
const provider = new ethers.JsonRpcProvider(
  process.env.GANACHE_RPC_URL || 'http://127.0.0.1:7545'
);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

// Keep ABI minimal by only declaring used functions.
const contractAbi = [
  'function storeVerification(string memory hash, bool status) public',
  'function getVerification(address user) public view returns (string memory, bool)',
];

const contract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS || ethers.ZeroAddress,
  contractAbi,
  wallet
);

async function loadFaceModels() {
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromDisk(MODEL_DIR),
    faceapi.nets.faceLandmark68TinyNet.loadFromDisk(MODEL_DIR),
    faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_DIR),
  ]);
}

async function detectFaceDescriptor(imagePath) {
  const image = await loadImage(imagePath);

  return faceapi
    .detectSingleFace(
      image,
      new faceapi.TinyFaceDetectorOptions({
        inputSize: 416,
        scoreThreshold: 0.5,
      })
    )
    .withFaceLandmarks(true)
    .withFaceDescriptor();
}

async function verifyFaceAI(idImagePath, selfieImagePath) {
  const [idDetection, selfieDetection] = await Promise.all([
    detectFaceDescriptor(idImagePath),
    detectFaceDescriptor(selfieImagePath),
  ]);

  if (!idDetection) {
    return {
      verified: false,
      faceMatchDistance: null,
      faceMatchScore: null,
      reason: 'No clear face was detected in the uploaded ID image.',
    };
  }

  if (!selfieDetection) {
    return {
      verified: false,
      faceMatchDistance: null,
      faceMatchScore: null,
      reason: 'No clear face was detected in the uploaded selfie.',
    };
  }

  const distance = faceapi.euclideanDistance(idDetection.descriptor, selfieDetection.descriptor);
  const faceMatchDistance = Number(distance.toFixed(4));
  const faceMatchScore = Number(Math.max(0, Math.min(1, 1 - distance)).toFixed(4));

  return {
    verified: distance <= FACE_DISTANCE_THRESHOLD,
    faceMatchDistance,
    faceMatchScore,
    reason:
      distance <= FACE_DISTANCE_THRESHOLD
        ? 'Face embeddings matched within the configured threshold.'
        : 'Face embeddings were too far apart to consider this a match.',
  };
}

// Cleanup helper so uploaded files do not accumulate on disk.
function safeUnlink(filePath) {
  if (!filePath) return;

  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    console.warn(`Failed to delete file ${filePath}:`, error.message);
  }
}

app.post(
  '/verify',
  upload.fields([
    { name: 'idImage', maxCount: 1 },
    { name: 'selfieImage', maxCount: 1 },
  ]),
  async (req, res) => {
    const idPath = req.files?.idImage?.[0]?.path;
    const selfiePath = req.files?.selfieImage?.[0]?.path;

    if (!idPath || !selfiePath) {
      return res.status(400).json({ error: 'Both ID image and selfie are required.' });
    }

    let extractedText = '';

    try {
      // OCR on uploaded ID card image.
      const ocrResult = await Tesseract.recognize(idPath, 'eng');
      extractedText = ocrResult.data.text.trim();

      const faceVerification = await verifyFaceAI(idPath, selfiePath);
      const verified = faceVerification.verified;

      // Generate proof hash from OCR text.
      const hash = crypto.createHash('sha256').update(extractedText).digest('hex');

      // Write verification data to Ethereum smart contract.
      const tx = await contract.storeVerification(hash, verified);
      await tx.wait();

      return res.json({
        extractedText,
        verified,
        hash,
        faceMatchScore: faceVerification.faceMatchScore,
        faceMatchDistance: faceVerification.faceMatchDistance,
        faceMatchThreshold: FACE_DISTANCE_THRESHOLD,
        faceVerificationReason: faceVerification.reason,
      });
    } catch (error) {
      console.error('Verification flow error:', error);
      return res.status(500).json({
        error:
          'Verification failed. Please confirm Ganache, contract address, and private key configuration.',
      });
    } finally {
      safeUnlink(idPath);
      safeUnlink(selfiePath);
    }
  }
);

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload error: ${error.message}` });
  }

  if (error) {
    return res.status(500).json({ error: 'Unexpected server error.' });
  }

  return next();
});

loadFaceModels()
  .then(() => {
    console.log(`Face verification models loaded from ${MODEL_DIR}`);
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to load face verification models:', error);
    process.exit(1);
  });
