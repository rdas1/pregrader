// Set the workerSrc to the web-accessible resource
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("libs/pdf.worker.min.js");

// Function to load and extract text from a PDF
async function loadAndExtractPDF(pdfPath) {
  try {
    // Fetch the PDF file (replace with your own PDF path if testing locally)
    const pdf = await pdfjsLib.getDocument(pdfPath).promise;
    console.log(`PDF loaded: ${pdf.numPages} pages`);

    let pdfText = "";

    // Loop through each page and extract text
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Combine the text from the page
      const pageText = textContent.items.map((item) => item.str).join(" ");
      pdfText += `Page ${pageNum}:\n${pageText}\n\n`;
    }

    console.log("Extracted Text:\n", pdfText);
    return pdfText;
  } catch (error) {
    console.error("Error loading or extracting PDF:", error);
  }
}


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
    const pasteZone = document.getElementById("paste-zone");
    const uploadButton = document.getElementById("upload-button");

    const docsDropdown = document.getElementById("docs-dropdown");

    // Add event listener to the "clear file" button
    document.getElementById("clear-file-button").addEventListener("click", clearFileUpload);

    // Retrieve stored data
    chrome.storage.local.get(["uploadedFile", "pastedInstructions", "selectedDoc", "activeTab"], (result) => {
      let hasUploadedFile = false;
      let hasSelectedDoc = false;
  
      // Restore uploaded file
      if (result.uploadedFile) {
        const { name } = result.uploadedFile;
        console.log(`Restored uploaded file: ${name}`);
        hasUploadedFile = true;
  
        dropZone.innerHTML = `
            <span><h3><strong>Uploaded:</strong> ${name}</h3></span>
            <span>To replace this file, drop another file here or click anywhere to browse files</span>
            <input type="file" id="file-input" hidden accept=".pdf,.docx,.txt" />
        `;
        // Re-attach event listeners to the new file input
        reinitializeFileInput();
        const clearButton = document.getElementById("clear-file-button");    
        clearButton.style.display = "inline-block";
        enableTabs();
        uploadButton.disabled = false;
      }

      else {}

      if (result.pastedInstructions) {
        const instructions = result.pastedInstructions;
        pasteZone.value = instructions;
        console.log("Restored pasted instructions:", instructions);
        hasUploadedFile = true;
        enableTabs();
        uploadButton.disabled = false;
      }

      if (!result.uploadedFile && !result.pastedInstructions) {
        dropZone.innerHTML = `
          <span><b>Drop your file</b> here.<br><br>Or, click anywhere to <b>browse files.</b></span>
          <input type="file" id="file-input" hidden accept=".pdf,.docx,.txt" />
        `;
        reinitializeFileInput();
        disableTabs();
        uploadButton.disabled = true;
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
    //     enableTabs();
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

    setupDragAndDrop(); // important!
    setupTextInput(); // important!

  });

// Function to enable tabs
function enableTabs() {
    const tabs = {
        requirements: document.getElementById("requirements-tab"),
        checklist: document.getElementById("checklist-tab"),
        finalChecklist: document.getElementById("final-checklist-tab"),
      };
    tabs.checklist.disabled = false;
    tabs.finalChecklist.disabled = false;
}

// Function to disable tabs
function disableTabs() {
    const tabs = {
        requirements: document.getElementById("requirements-tab"),
        checklist: document.getElementById("checklist-tab"),
        finalChecklist: document.getElementById("final-checklist-tab"),
      };
    tabs.checklist.disabled = true;
    tabs.finalChecklist.disabled = true;
}

function setupTextInput() {
    const pasteZone = document.getElementById("paste-zone");
    const uploadButton = document.getElementById("upload-button");
  
    // Monitor textarea for input
    pasteZone.addEventListener("input", () => {
        console.log("inside event listener");
      const instructions = pasteZone.value.trim();
      chrome.storage.local.set({ pastedInstructions: instructions }, () => {
        console.log("Pasted instructions saved to storage: ", instructions);
      });
      if (instructions.length > 0) {
        // Save instructions to storage
        
        const uploadButton = document.getElementById("upload-button");
        uploadButton.disabled = false;

      } else {
        console.log("Textarea emptied.");
        chrome.storage.local.remove("pastedInstructions", () => {
          console.log("Pasted instructions removed from storage.");
        });
        chrome.storage.local.get("uploadedFile", (result) => {
            if (!result.uploadedFile) {
              uploadButton.disabled = true;
              disableTabs();
            }
        });
      }
    });
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
      dro
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

    if (file.type === "application/pdf") {
        // Handle PDF files
        const reader = new FileReader();
        reader.onload = async (e) => {
        const arrayBuffer = e.target.result;

        try {
            // Use PDF.js to extract text
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            console.log(`PDF loaded: ${pdf.numPages} pages`);

            let pdfText = "";

            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item) => item.str).join(" ");
            pdfText += `${pageText}\n`;
            }

            console.log("Extracted Text:", pdfText);

            // Save the extracted text to storage
            chrome.storage.local.set(
            {
                uploadedFile: {
                name: file.name,
                type: file.type,
                content: pdfText.trim(),
                },
            },
            () => {
                console.log("Extracted text from PDF saved to storage.");
            }
            );
        } catch (error) {
            console.error("Failed to extract text from PDF:", error);
        }
        };

        reader.readAsArrayBuffer(file); // Read the file as ArrayBuffer
    } else if (file.type === "text/plain") {
        // Handle plain text files
        const reader = new FileReader();
        reader.onload = (e) => {
        const fileContent = e.target.result;

        chrome.storage.local.set(
            {
            uploadedFile: {
                name: file.name,
                type: file.type,
                content: fileContent.trim(),
            },
            },
            () => {
            console.log("Uploaded file and content saved to storage.");
            }
        );
        };

        reader.readAsText(file);
    } else {
        console.error("Unsupported file type. Please upload a PDF or plain text file.");
        return;
    }
    const dropZone = document.getElementById("drop-zone");
    // Update the drop zone content with the uploaded file and "x" button
    dropZone.innerHTML = `
    <div class="uploaded-file">
        <h3><strong>Uploaded:</strong> ${file.name}</h3>
    </div>
    <span>To replace this file, drop another file here or click anywhere to browse files</span>
    <input type="file" id="file-input" hidden accept=".pdf,.docx,.txt" />
    `;

    const clearButton = document.getElementById("clear-file-button");    
    clearButton.style.display = "inline-block";

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

  function clearFileUpload() {
    console.log("Clearing uploaded file...");
  
    // Remove the uploaded file from storage
    chrome.storage.local.remove("uploadedFile", () => {
      console.log("Uploaded file info removed from storage.");
    });
  
    // Reset the drop zone content
    const dropZone = document.getElementById("drop-zone");
    dropZone.innerHTML = `
      <span><b>Drop your file</b> here.<br><br>Or, click anywhere to <b>browse files.</b></span>
      <input type="file" id="file-input" hidden accept=".pdf,.docx,.txt" />
    `;

    const clearButton = document.getElementById("clear-file-button");
    clearButton.style.display = "none";
  
    // Re-attach event listeners to the new file input
    reinitializeFileInput();
  
    // Disable the upload button if no pasted instructions exist
    chrome.storage.local.get("pastedInstructions", (result) => {
      const uploadButton = document.getElementById("upload-button");
      if (!result.pastedInstructions) {
        uploadButton.disabled = true;
        disableTabs();
      }
    });
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
    enableTabs();
  
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

    // Generate checklist of requirements
    generateChecklist();
  
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
      <span><b>Drop your file</b> here.<br><br>Or, click anywhere to <b>browse files.</b></span>
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


// Generate checklist by merging both requirements inputs
function generateChecklist() {
    chrome.storage.local.get(["pastedInstructions", "uploadedFile"], async (result) => {
        const pastedInstructions = result.pastedInstructions || "";
        const fileContent = result.uploadedFile?.content || ""; // Retrieve the stored file content
    
        const combinedInput = `${pastedInstructions}\n\n${fileContent}`;
        console.log("Generating checklist from combined input:", combinedInput);
  
    //   // OpenAI API Configuration
    //   const openaiApiKey = "YOUR_KEY"; // Replace with your OpenAI API key
    //   const apiUrl = "https://api.openai.com/v1/completions";
    //   const prompt = `Extract a detailed checklist of requirements from the following assignment instructions:\n\n${combinedInput}`;
  
    //   // API Request Body
    //   const requestBody = {
    //     model: "text-davinci-003", // Ensure the model fits your needs
    //     prompt: prompt,
    //     max_tokens: 500, // Adjust as needed
    //     temperature: 0.7, // Adjust based on required creativity
    //   };
  
    //   try {
    //     // Send Request to OpenAI API
    //     const response = await fetch(apiUrl, {
    //       method: "POST",
    //       headers: {
    //         "Content-Type": "application/json",
    //         Authorization: `Bearer ${openaiApiKey}`,
    //       },
    //       body: JSON.stringify(requestBody),
    //     });
  
    //     // Handle Response
    //     if (!response.ok) {
    //       throw new Error(`OpenAI API error: ${response.statusText}`);
    //     }
  
    //     const data = await response.json();
    //     const checklist = data.choices[0]?.text?.trim() || "No checklist generated.";
  
    //     // Print Checklist
    //     console.log("Generated Checklist:", checklist);
    //   } catch (error) {
    //     console.error("Error generating checklist:", error);
    //   }
    });
  }
  

