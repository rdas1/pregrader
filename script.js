function authenticateUser() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) {
        console.error("Authentication error:", chrome.runtime.lastError);
        reject(new Error(`Authentication failed: ${chrome.runtime.lastError.message}`));
        return;
      }
      console.log("Successfully retrieved token:", token);
      resolve(token);
    });
  });
}

async function fetchDocsList(accessToken) {
  const url = "https://www.googleapis.com/drive/v3/files";
  const params = new URLSearchParams({
    corpora: "user",
    orderBy: "modifiedTime desc",
    fields: "files(id, name, mimeType)", // Only fetch necessary fields
    q: "mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document'",
  });

  const response = await fetch(`${url}?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Google Docs. Error code: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.files; // Return the list of files
}

function populateDropdown(docs) {
  const docsDropdown = document.getElementById("docs-dropdown");

  // Clear existing options
  docsDropdown.innerHTML = "";

  if (docs.length === 0) {
    const noDocsOption = document.createElement("option");
    noDocsOption.value = "";
    noDocsOption.text = "No Google Docs available";
    docsDropdown.appendChild(noDocsOption);
    docsDropdown.disabled = true;
    return;
  }

  // Add default option
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.text = "Select a document";
  defaultOption.disabled = true;
  defaultOption.selected = true;
  docsDropdown.appendChild(defaultOption);

  // Populate the dropdown with docs
  docs.forEach((doc) => {
    const option = document.createElement("option");
    option.value = doc.id; // Use the document ID as the value
    option.text = doc.name; // Use the document name as the display text
    docsDropdown.appendChild(option);
  });

  docsDropdown.disabled = false;
}

// Fetch the document content when the user selects an option
function setupDropdownChangeListener(accessToken) {
  const docsDropdown = document.getElementById("docs-dropdown");

  docsDropdown.addEventListener("change", async () => {
    const selectedDocId = docsDropdown.value;
    const selectedDocName = docsDropdown.options[docsDropdown.selectedIndex].text;
  
    if (selectedDocId) {
      console.log(`Selected Doc: ${selectedDocName} (ID: ${selectedDocId})`);
  
      // Save selected doc info to storage
      chrome.storage.local.set({ selectedDoc: { id: selectedDocId, name: selectedDocName } }, () => {
        console.log("Selected doc info saved to storage.");
      });
  
      try {
        const content = await fetchDocContent(selectedDocId, accessToken);
        console.log("Selected Doc Content:", content);
      } catch (error) {
        console.error("Failed to fetch document content:", error.message);
      }
    }
  });
  
}

async function fetchDocContent(docId, accessToken) {
  const response = await fetch(`https://docs.googleapis.com/v1/documents/${docId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch document content. Error code: ${response.status}`);
  }

  const doc = await response.json();
  return doc.body.content; // Returns the document content
}

// Populate dropdown when it is clicked/opened
document.getElementById("docs-dropdown").addEventListener("focus", async () => {
  try {
    const accessToken = await authenticateUser();
    const docs = await fetchDocsList(accessToken);
    populateDropdown(docs);
    setupDropdownChangeListener(accessToken);
  } catch (error) {
    console.error("Error during authentication or fetching docs:", error.message);
  }
});

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
  
    const dropZone = document.getElementById("drop-zone");
    const docsDropdown = document.getElementById("docs-dropdown");
  
    // Retrieve stored data
    chrome.storage.local.get(["uploadedFile", "selectedDoc", "activeTab"], (result) => {
      let hasUploadedFile = false;
      let hasSelectedDoc = false;
  
      // Restore uploaded file
      if (result.uploadedFile) {
        const { name } = result.uploadedFile;
        console.log(`Restored uploaded file: ${name}`);
        hasUploadedFile = true;
  
        dropZone.innerHTML = `
          <p><strong>Uploaded:</strong> ${name}</p>
          <span>To replace this file, drop another file here or click anywhere to browse files</span>
          <input type="file" id="file-input" hidden accept=".pdf,.docx,.txt" />
        `;
        reinitializeFileInput();
        enableTabs(tabs);
      }
  
      // Restore selected document
      if (result.selectedDoc) {
        const { id, name } = result.selectedDoc;
        console.log(`Restored selected doc: ${name} (ID: ${id})`);
        hasSelectedDoc = true;
  
        const option = document.createElement("option");
        option.value = id;
        option.text = name;
        option.selected = true;
        docsDropdown.appendChild(option);
      }
  
      // Enable tabs if both file and document are present
    //   if (hasUploadedFile && hasSelectedDoc) {
    //     enableTabs(tabs);
    //   }
  
      // Restore the active tab
      const activeTab = result.activeTab || "requirements"; // Default to requirements tab
      Object.keys(tabs).forEach((key) => {
        if (key === activeTab) {
          tabs[key].classList.add("active");
          views[key].classList.add("active");
        } else {
          tabs[key].classList.remove("active");
          views[key].classList.remove("active");
        }
      });
    });
  
    // Tab switching logic
    Object.keys(tabs).forEach((key) => {
      tabs[key].addEventListener("click", () => {
        if (!tabs[key].disabled) {
          // Deactivate all tabs and views
          Object.keys(tabs).forEach((otherKey) => {
            tabs[otherKey].classList.remove("active");
            views[otherKey].classList.remove("active");
          });
  
          // Activate the clicked tab and view
          tabs[key].classList.add("active");
          views[key].classList.add("active");
  
          // Persist the active tab
          chrome.storage.local.set({ activeTab: key }, () => {
            console.log(`Active tab saved: ${key}`);
          });
        }
      });
    });
  });

    // Function to enable tabs
    function enableTabs(tabs) {
        tabs.checklist.disabled = false;
        tabs.finalChecklist.disabled = false;
    }

  function reinitializeFileInput() {
    const fileInput = document.getElementById("file-input");
  
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (validateFile(file)) {
        handleFileUpload(file);
      } else {
        console.log("Invalid file type. Please upload a PDF, DOCX, or TXT file.");
      }
    });
  }

  function setupDragAndDrop() {
    const dropZone = document.getElementById("drop-zone");
    const uploadButton = document.getElementById("upload-button");
  
    dropZone.addEventListener("click", () => {
      const fileInput = document.getElementById("file-input");
      fileInput.click(); // Trigger the hidden file input
    });
  
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
      if (files.length > 0 && validateFile(files[0])) {
        handleFileUpload(files[0]);
      } else {
        console.log("Invalid file type. Please upload a PDF, DOCX, or TXT file.");
      }
    });
  }

  function handleFileUpload(file) {
    console.log(`File uploaded: ${file.name}`);
  
    // Save file info to storage
    chrome.storage.local.set({ uploadedFile: { name: file.name } }, () => {
      console.log("Uploaded file info saved to storage.");
    });
  
    const dropZone = document.getElementById("drop-zone");
    dropZone.innerHTML = `
      <p><strong>Uploaded:</strong> ${file.name}</p>
      <span>To replace this file, drop another file here or click anywhere to browse files</span>
      <input type="file" id="file-input" hidden accept=".pdf,.docx,.txt" />
    `;
  
    // Re-attach event listeners to the new file input
    reinitializeFileInput();
  
    // Enable the upload button
    const uploadButton = document.getElementById("upload-button");
    uploadButton.disabled = false;
  }

  function validateFile(file) {
    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    return file && validTypes.includes(file.type);
  }

  document.getElementById("upload-button").addEventListener("click", () => {
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
  
    // Enable checklist and final checklist tabs
    tabs.checklist.disabled = false;
    tabs.finalChecklist.disabled = false;
  
    // Switch to checklist tab
    Object.keys(tabs).forEach((key) => {
      if (key === "checklist") {
        tabs[key].classList.add("active");
        views[key].classList.add("active");
      } else {
        tabs[key].classList.remove("active");
        views[key].classList.remove("active");
      }
    });
  
    // Persist the active tab
    chrome.storage.local.set({ activeTab: "checklist" }, () => {
      console.log("Active tab set to: checklist");
    });
  });


  document.getElementById("clear-storage-button").addEventListener("click", () => {
    chrome.storage.local.clear(() => {
      if (chrome.runtime.lastError) {
        console.error("Error clearing storage:", chrome.runtime.lastError);
      } else {
        console.log("Storage cleared successfully.");
        // Optionally reset the interface
        resetInterface();
      }
    });
  });
  
  // Function to reset the interface after clearing storage (for testing)
  function resetInterface() {
    const dropZone = document.getElementById("drop-zone");
    const docsDropdown = document.getElementById("docs-dropdown");
    const uploadButton = document.getElementById("upload-button");
  
    // Reset drop-zone content
    dropZone.innerHTML = `
      <span>Drop your files here or click anywhere to browse files</span>
      <input type="file" id="file-input" hidden accept=".pdf,.docx,.txt" />
    `;
    reinitializeFileInput();
  
    // Reset dropdown
    docsDropdown.innerHTML = `<option value="" disabled selected>Loading Google Docs...</option>`;
    docsDropdown.disabled = true;
  
    // Disable upload button
    uploadButton.disabled = true;
  
    // Reset tabs
    const tabs = {
      requirements: document.getElementById("requirements-tab"),
      checklist: document.getElementById("checklist-tab"),
      finalChecklist: document.getElementById("final-checklist-tab"),
    };
    Object.keys(tabs).forEach((key) => {
      tabs[key].classList.remove("active");
      tabs[key].disabled = key !== "requirements"; // Only enable the requirements tab
    });
  
    // Reset active tab view
    const views = {
      requirements: document.getElementById("requirements-view"),
      checklist: document.getElementById("checklist-view"),
      finalChecklist: document.getElementById("final-checklist-view"),
    };
    Object.keys(views).forEach((key) => {
      views[key].classList.remove("active");
    });
    views.requirements.classList.add("active");
  
    console.log("Interface reset.");
  }
  
