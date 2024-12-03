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
  
    // Switch Tab Functionality
    Object.keys(tabs).forEach((key) => {
      tabs[key].addEventListener("click", () => {
        if (!tabs[key].disabled) {
          // Switch active tab
          Object.keys(tabs).forEach((otherKey) => {
            tabs[otherKey].classList.remove("active");
            views[otherKey].classList.remove("active");
          });
          tabs[key].classList.add("active");
          views[key].classList.add("active");
        }
      });
    });
  
    // Enable Tabs After Upload
    uploadButton.addEventListener("click", () => {
      // Simulate file upload
      alert("Requirements uploaded!");
      tabs.checklist.disabled = false;
      tabs.finalChecklist.disabled = false;
      tabs.checklist.classList.add("active");
      views.requirements.classList.remove("active");
      views.checklist.classList.add("active");
    });
  });
  