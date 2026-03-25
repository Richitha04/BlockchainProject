const form = document.getElementById('verificationForm');
const submitBtn = document.getElementById('submitBtn');
const loading = document.getElementById('loading');
const errorBox = document.getElementById('error');
const resultSection = document.getElementById('result');
const extractedTextEl = document.getElementById('extractedText');
const statusBadge = document.getElementById('statusBadge');
const faceScore = document.getElementById('faceScore');
const faceReason = document.getElementById('faceReason');
const hashValue = document.getElementById('hashValue');

const API_BASE_URL = 'http://localhost:3000';

function resetUI() {
  errorBox.classList.add('hidden');
  errorBox.textContent = '';
  resultSection.classList.add('hidden');
}

function showLoading(isLoading) {
  loading.classList.toggle('hidden', !isLoading);
  submitBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? 'Verifying...' : 'Verify Identity';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  resetUI();

  const idFile = document.getElementById('idImage').files[0];
  const selfieFile = document.getElementById('selfieImage').files[0];

  if (!idFile || !selfieFile) {
    errorBox.classList.remove('hidden');
    errorBox.textContent = 'Please upload both ID image and selfie.';
    return;
  }

  const formData = new FormData();
  formData.append('idImage', idFile);
  formData.append('selfieImage', selfieFile);

  try {
    showLoading(true);

    const response = await fetch(`${API_BASE_URL}/verify`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Verification failed due to server error.');
    }

    extractedTextEl.textContent = data.extractedText || 'No readable text found.';
    hashValue.textContent = data.hash;
    faceScore.textContent =
      typeof data.faceMatchScore === 'number'
        ? `${(data.faceMatchScore * 100).toFixed(1)}% similarity`
        : 'No score available';
    faceReason.textContent = data.faceVerificationReason || 'No details available.';

    statusBadge.className = `badge ${data.verified ? 'verified' : 'not-verified'}`;
    statusBadge.textContent = data.verified ? 'Verified' : 'Not Verified';

    resultSection.classList.remove('hidden');
  } catch (error) {
    errorBox.classList.remove('hidden');
    errorBox.textContent = error.message;
  } finally {
    showLoading(false);
  }
});
