document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const uploadForm = document.getElementById('uploadForm');
    const resultDiv = document.getElementById('result');
    const previewPanel = document.getElementById('previewPanel');
    const previewCanvas = document.getElementById('previewCanvas');
    const imagePreview = document.getElementById('imagePreview');
    const ctx = previewCanvas.getContext('2d');
    const cancelButton = document.getElementById('cancelButton');
    const progressIndicator = document.getElementById('progressIndicator');
    const progressBar = document.getElementById('progressBar');
    const fileInfo = document.getElementById('fileInfo');
    const dropZoneText = document.getElementById('dropZoneText');
    const selectedFileText = document.getElementById('selectedFileText');

    let selectedFile = null;

    dropZone.addEventListener('click', (event) => {
        fileInput.click();
    });

    dropZone.addEventListener('dragover', (event) => {
        event.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (event) => {
        event.preventDefault();
        dropZone.classList.remove('dragover');

        if (event.dataTransfer.files.length) {
            handleFileSelect(event.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (event) => {
        if (fileInput.files.length) {
            handleFileSelect(fileInput.files[0]);
        }
    });

    cancelButton.addEventListener('click', () => {
        resetFileInput();
    });

    function handleFileSelect(file) {
        selectedFile = file;
        const fileName = file.name;
        const fileSize = (file.size / 1024).toFixed(2);
        selectedFileText.textContent = `Selected File: ${fileName} (${fileSize} KB)`;
        fileInfo.style.display = 'block';
        dropZone.style.display = 'none';
        cancelButton.style.display = 'block';

        if (file.name.endsWith('.ant')) {
            previewAntFile(file);
        } else if (file.type.startsWith('image/')) {
            previewImageFile(file);
        } else {
            alert('Unsupported file type. Please select a valid image or .ant file.');
            resetFileInput();
        }
    }

    function resetFileInput() {
        selectedFile = null;
        fileInput.value = '';
        dropZoneText.textContent = 'Drag & drop your file here or click to select';
        dropZone.style.display = 'block';
        fileInfo.style.display = 'none';
        previewPanel.style.display = 'none';
        cancelButton.style.display = 'none';
        imagePreview.style.display = 'none';
        previewCanvas.style.display = 'none';
    }

    async function previewAntFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/preview', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const blob = await response.blob();
                const imageUrl = URL.createObjectURL(blob);

                const image = new Image();
                image.src = imageUrl;
                image.onload = () => {
                    previewCanvas.width = image.width;
                    previewCanvas.height = image.height;
                    ctx.drawImage(image, 0, 0);
                    previewCanvas.style.display = 'initial';
                    imagePreview.style.display = 'none';
                    URL.revokeObjectURL(imageUrl);
                    previewPanel.style.display = 'initial';
                };
            } else {
                console.error('Error generating preview.');
                resultDiv.innerHTML = '<p>Error generating preview.</p>';
            }
        } catch (error) {
            console.error('Error:', error);
            resultDiv.innerHTML = '<p>Error generating preview.</p>';
        }
    }

    function previewImageFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageUrl = e.target.result;
            imagePreview.src = imageUrl;
            imagePreview.onload = () => {
                previewCanvas.width = 0;
                previewCanvas.height = 0;
                previewCanvas.style.display = 'none';
                imagePreview.style.display = 'initial';
                previewPanel.style.display = 'initial';
            };
        };
        reader.readAsDataURL(file);
    }

    uploadForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!selectedFile) {
            resultDiv.innerHTML = '<p>No file selected.</p>';
            return;
        }

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('format', document.getElementById('formatSelect').value);

        const fileExtension = selectedFile.name.split('.').pop().toLowerCase();
        const outputFormat = document.getElementById('formatSelect').value;

        if (fileExtension === outputFormat || (fileExtension === 'png' && outputFormat === 'jpg') || (fileExtension === 'jpg' && outputFormat === 'png')) {
            alert(`Converting from ${fileExtension.toUpperCase()} to ${outputFormat.toUpperCase()} is not allowed.`);
            return;
        }

        try {
            progressIndicator.style.display = 'block';
            progressBar.style.width = '0%';

            const response = await fetch('/upload', {
                method: 'POST',
                body: formData,
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.lengthComputable) {
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        progressBar.style.width = `${percentCompleted}%`;
                    }
                }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                const contentDisposition = response.headers.get('Content-Disposition');
                const match = contentDisposition && contentDisposition.match(/filename="(.+)"/);
                const filename = match ? match[1] : 'converted_file';
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                resultDiv.innerHTML = '<p>Conversion complete. Your file is downloading...</p>';
                resetFileInput();
            } else {
                resultDiv.innerHTML = '<p>Error during file conversion.</p>';
            }
        } catch (error) {
            console.error('Error:', error);
            resultDiv.innerHTML = '<p>Error during file conversion.</p>';
        } finally {
            progressIndicator.style.display = 'none';
        }
    });
});
