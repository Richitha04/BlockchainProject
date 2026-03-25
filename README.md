# AI-Based Digital Identity Verification System with Blockchain

This mini project verifies a user identity by:
1. Running OCR on an uploaded ID image via **Tesseract.js**.
2. Running AI face verification on the ID photo vs selfie using **face-api.js** face embeddings.
3. Hashing OCR output with **SHA-256**.
4. Writing verification proof (`hash`, `status`) to an Ethereum smart contract on **Ganache** using **Ethers.js**.

## Project Structure

```text
/project
  /frontend
    index.html
    style.css
    script.js
  /backend
    server.js
    package.json
  /contracts
    IdentityVerification.sol
```

## Prerequisites

- Node.js 18+
- Ganache (local Ethereum node)
- Remix IDE (for contract deployment)

## 1) Deploy Smart Contract (Remix + Ganache)

1. Open [https://remix.ethereum.org](https://remix.ethereum.org).
2. Create file `IdentityVerification.sol` and paste `contracts/IdentityVerification.sol`.
3. Compile with Solidity `0.8.20` (or compatible 0.8.x).
4. In Ganache, copy:
   - RPC URL (usually `http://127.0.0.1:7545`)
   - One account private key
5. In Remix:
   - Open **Deploy & Run Transactions**
   - Select **Injected Provider - MetaMask** or **Web3 Provider**
   - Point to Ganache RPC URL
   - Deploy contract
6. Copy deployed contract address.

## 2) Configure Backend

Create `.env` inside `/backend`:

```env
PORT=3000
GANACHE_RPC_URL=http://127.0.0.1:7545
PRIVATE_KEY=0xYOUR_GANACHE_ACCOUNT_PRIVATE_KEY
CONTRACT_ADDRESS=0xYOUR_DEPLOYED_CONTRACT_ADDRESS
FACE_DISTANCE_THRESHOLD=0.5
```

## 3) Install + Run Backend

```bash
cd backend
npm install
npm start
```

Server runs at `http://localhost:3000`.

## 4) Run Frontend

Use any static file server from project root:

```bash
# Option A: VSCode Live Server
# Open frontend/index.html with Live Server

# Option B: npx serve
npx serve frontend -l 5500
```

Open browser at `http://localhost:5500`.

## API Endpoint

### `POST /verify`

Form-data fields:
- `idImage` (file)
- `selfieImage` (file)

Success response:

```json
{
  "extractedText": "...",
  "verified": true,
  "hash": "...",
  "faceMatchScore": 0.83,
  "faceMatchDistance": 0.31,
  "faceMatchThreshold": 0.5,
  "faceVerificationReason": "Face embeddings matched within the configured threshold."
}
```

## Notes on Face Verification

The backend now uses face embeddings to compare the uploaded ID image and selfie:
- `tinyFaceDetector` finds a face in each image
- `faceLandmark68TinyNet` aligns the detected face
- `faceRecognitionNet` produces descriptors for comparison
- Verification passes when descriptor distance is less than `FACE_DISTANCE_THRESHOLD`

If no face is detected in either image, the verification returns `verified: false` with a reason.

## Error Handling Included

- Missing image files
- Multer upload errors
- OCR/Blockchain runtime errors
- Frontend loading + error state handling

## Commands Summary

```bash
# Backend
cd backend
npm install
npm start

# Frontend (from repo root)
npx serve frontend -l 5500
```
