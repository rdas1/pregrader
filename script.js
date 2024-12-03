document.addEventListener("DOMContentLoaded", () => {
    const tabs = {
      requirements: document.getElementById("requirements-tab"),
      checklist: document.getElementById("checklist-tab"),
      finalChecklist: document.getElementById("final-checklist-tab"),
    };
  
    const views = {
      requirements: document.getElementById("requirements-view"),
      checklist: document.getElementById("checklist-view"),
      finalChecklist: document.getElementById("final-checklist-view"),
    };
  
    const uploadButton = document.getElementById("upload-button");
    const dropZone = document.getElementById("drop-zone");
    let fileInput = document.getElementById("file-input");
    
    let fileUploaded = false;
  
    // Switch Tab Functionality
    Object.keys(tabs).forEach((key) => {
      tabs[key].addEventListener("click", () => {
        if (!tabs[key].disabled) {
          Object.keys(tabs).forEach((otherKey) => {
            tabs[otherKey].classList.remove("active");
            views[otherKey].classList.remove("active");
          });
          tabs[key].classList.add("active");
          views[key].classList.add("active");
        }
      });
    });
  
    // Make the drop-zone clickable
    dropZone.addEventListener("click", () => {
      fileInput.click(); // Trigger the hidden file input
    });
  
    // Drag-and-drop events
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });
  
    dropZone.addEventListener("dragleave", () => {
      dropZone.classList.remove("dragover");
    });
  
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
  
      const files = e.dataTransfer.files;
      if (validateFile(files[0])) {
        handleFileUpload(files[0]);
      } else {
        console.log("Invalid file type. Please upload a PDF, DOCX, or TXT file.");
      }
    });
  
    // File input change event
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (validateFile(file)) {
        handleFileUpload(file);
      } else {
        console.log("Invalid file type. Please upload a PDF, DOCX, or TXT file.");
      }
    });
  
    // Validate file type
    function validateFile(file) {
      const validTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
      ];
      return file && validTypes.includes(file.type);
    }
  
    // Handle file upload
    function handleFileUpload(file) {
      fileUploaded = true;
      console.log(`File uploaded: ${file.name}`);
      uploadButton.disabled = false; // Enable upload button
  
      // Update drop-zone content but keep it interactive
      dropZone.innerHTML = `
        <p><strong>Uploaded:</strong> ${file.name}</p>
        <span>To replace this file, drop another file here or click anywehere to browse files</span>
        <input type="file" id="file-input" hidden accept=".pdf,.docx,.txt" />
      `;
  
      // Re-attach event listeners to the new file input
      fileInput = dropZone.querySelector("#file-input");
      fileInput.addEventListener("change", (e) => {
        const newFile = e.target.files[0];
        if (validateFile(newFile)) {
          handleFileUpload(newFile);
        } else {
          console.log("Invalid file type. Please upload a PDF, DOCX, or TXT file.");
        }
      });
    }
  
    // Simulate upload on button click
    uploadButton.addEventListener("click", () => {
      if (fileUploaded) {
        console.log("Requirements uploaded successfully!");
        tabs.checklist.disabled = false;
        tabs.finalChecklist.disabled = false;
        tabs.checklist.classList.add("active");
        views.requirements.classList.remove("active");
        views.checklist.classList.add("active");
      } else {
        console.log("No file uploaded.");
      }
    });
  });
  