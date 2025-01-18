// Construct the API endpoint
const API_ENDPOINT = window.location.origin + '/api/analyze';

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileName = document.getElementById('fileName');
const analyzeBtn = document.getElementById('analyzeBtn');
const loadingSpinner = document.getElementById('loadingSpinner');
const resultSection = document.getElementById('resultSection');
const analysisResult = document.getElementById('analysisResult');
const errorToast = document.getElementById('errorToast');
const errorMessage = document.getElementById('errorMessage');
const toggleInstructions = document.getElementById('toggleInstructions');
const instructionsEditor = document.getElementById('instructionsEditor');
const systemInstructions = document.getElementById('systemInstructions');
const userPrompt = document.getElementById('userPrompt'); // New Element

// Event Listeners
dropZone.addEventListener('dragover', handleDragOver);
dropZone.addEventListener('dragleave', handleDragLeave);
dropZone.addEventListener('drop', handleDrop);
fileInput.addEventListener('change', handleFileSelect);
analyzeBtn.addEventListener('click', analyzeFile);
toggleInstructions.addEventListener('click', toggleInstructionsEditor);

function handleDragOver(e) {
  e.preventDefault();
  dropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFile(files[0]);
  }
}

function handleFileSelect(e) {
  const files = e.target.files;
  if (files.length > 0) {
    handleFile(files[0]);
  }
}

function handleFile(file) {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    showError('Please upload a valid CSV file');
    return;
  }
  fileName.textContent = file.name;
  analyzeBtn.disabled = false;
}

async function analyzeFile() {
  const file = fileInput.files[0];
  if (!file) {
    showError('Please select a file first');
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  const instructions = systemInstructions.value.trim();
  if (instructions) {
    formData.append('instructions', instructions);
  }

  const prompt = userPrompt.value.trim(); // Get the prompt
  if (prompt) {
    formData.append('prompt', prompt);
  } else {
    showError('Please enter a prompt for the analysis.');
    return;
  }

  try {
    setLoading(true);
    console.log("Sending file to:", API_ENDPOINT);

    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }

    displayResults(data.analysis || 'No analysis returned.');
  } catch (err) {
    console.error("Error:", err.message);
    showError('Error analyzing file: ' + err.message);
  } finally {
    setLoading(false);
  }
}

function displayResults(markdown) {
  resultSection.classList.remove('hidden');
  analysisResult.innerHTML = marked.parse(markdown);
  resultSection.scrollIntoView({ behavior: 'smooth' });
}

function setLoading(isLoading) {
  loadingSpinner.classList.toggle('hidden', !isLoading);
  analyzeBtn.disabled = isLoading;
}

function showError(msg) {
  errorMessage.textContent = msg;
  errorToast.classList.remove('hidden');
  setTimeout(() => {
    errorToast.classList.add('hidden');
  }, 5000);
}

function toggleInstructionsEditor() {
  instructionsEditor.classList.toggle('hidden');
  toggleInstructions.innerHTML = instructionsEditor.classList.contains('hidden')
    ? '<i class="fas fa-cog"></i> Customize AI Instructions'
    : '<i class="fas fa-times"></i> Hide Instructions';
}

function shareResults() {
  if (navigator.share) {
    navigator.share({
      title: 'CSV Analysis Results',
      text: analysisResult.textContent
    }).catch(console.error);
  } else {
    navigator.clipboard.writeText(analysisResult.textContent)
      .then(() => showError('Results copied to clipboard!'))
      .catch(err => showError('Could not copy results'));
  }
}

function printResults() {
  const resultSection = document.getElementById('resultSection');
  const originalContents = document.body.innerHTML;
  const printContents = resultSection.innerHTML;

  // Create a new window for printing
  const printWindow = window.open('', '', 'height=600,width=800');
  printWindow.document.write('<html><head><title>Print Analysis Result</title>');
  printWindow.document.write('<link rel="stylesheet" href="styles.css" type="text/css" />'); // Link to your CSS file
  printWindow.document.write('</head><body >');
  printWindow.document.write(printContents);
  printWindow.document.write('</body></html>');
  printWindow.document.close();
  printWindow.print();
}

function restart() {
  fileInput.value = '';
  fileName.textContent = '';
  analyzeBtn.disabled = true;
  resultSection.classList.add('hidden');
  systemInstructions.value = '';
  userPrompt.value = ''; // Clear the prompt
  instructionsEditor.classList.add('hidden');
  toggleInstructions.innerHTML = '<i class="fas fa-cog"></i> Customize AI Instructions';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
