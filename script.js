// ---------------------------
// Supabase Integration
// ---------------------------
const SUPABASE_URL = "https://ucqoiltqcblrwkltglos.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcW9pbHRxY2JscndrbHRnbG9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3Nzc1NTUsImV4cCI6MjA3MTM1MzU1NX0.d9nusguupaLupLRa1Yn7pBAgzJ9d2eU4Sx-SrgRAFcI";

// Create a Supabase client using the global `supabase` from the CDN
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const IMAGES_BUCKET = "flashcards-images";

// ---------------------------
// Supabase Storage Helper
// ---------------------------
async function uploadToSupabase(file) {
  if (!file) return null;

  const fileExt = file.name.split(".").pop();
  const fileName = `flashcard-${Date.now()}.${fileExt}`;
  
  const { data, error } = await supabaseClient.storage
    .from(IMAGES_BUCKET)
    .upload(fileName, file, { cacheControl: '3600', upsert: true });

  if (error) {
    console.error("Supabase upload error:", error);
    return null;
  }

  // Return public URL
  return supabaseClient.storage.from(IMAGES_BUCKET).getPublicUrl(fileName).data.publicUrl;
}

// ---------------------------
// Supabase Database Helpers
// ---------------------------

// Fetch all cases from Supabase
async function getCasesFromSupabase() {
  const { data, error } = await supabaseClient
    .from("cases")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching cases:", error);
    return [];
  }

  return data || [];
}

// Add a new case to Supabase
async function saveCaseToSupabase(caseObj) {
  const { data, error } = await supabaseClient
    .from("cases")
    .insert([{ 
      title: caseObj.title,
      stems: caseObj.stems,
      flashcards: caseObj.flashcards 
    }])
    .select(); 

  if (error) {
    console.error("Error saving case:", error);
    return null;
  }

  return data[0];
}

// Update an existing case in Supabase
async function updateCaseInSupabase(caseId, caseObj) {
  const { data, error } = await supabaseClient
    .from("cases")
    .update({
      title: caseObj.title,
      stems: caseObj.stems,
      flashcards: caseObj.flashcards
    })
    .eq("id", caseId)
    .select();

  if (error) {
    console.error("Error updating case:", error);
    return null;
  }

  return data[0];
}

// Delete a case from Supabase (optional)
async function deleteCaseFromSupabase(caseId) {
  const { error } = await supabaseClient
    .from("cases")
    .delete()
    .eq("id", caseId);

  if (error) {
    console.error("Error deleting case:", error);
  }
}

// ---------------------------
// Utilities & State
// ---------------------------
const casesContainer = document.getElementById("casesContainer");
const noResults = document.getElementById("noResults");

let addEditors = new Map();
let editEditors = new Map();
let currentEditIndex = null;

const uid = () => "id-" + Math.random().toString(36).slice(2) + Date.now();

function openModal(id) {
  document.getElementById(id).hidden = false;
}
function closeModal(id) {
  document.getElementById(id).hidden = true;
}

// ---------------------------
// Home grid
// ---------------------------
let homeCases = []; // store fetched cases for DOM rendering & search

async function rebuildHomeGrid() {
  // Fetch cases from Supabase
  homeCases = await getCasesFromSupabase();

  // Clear existing DOM
  casesContainer.querySelectorAll(".case-item").forEach((n) => n.remove());

  // Add cards to DOM
  homeCases.forEach((c, i) => addCaseCardToDOM(c.title, c.id));
  noResults.hidden = homeCases.length !== 0;
}

function addCaseCardToDOM(title, caseId) {
  const div = document.createElement("div");
  div.className = "case-item";
  div.textContent = title;
  div.style.cursor = "pointer";

  div.onclick = () => openCaseStudy(caseId); // use Supabase case ID

  casesContainer.insertBefore(div, noResults);
}

// Search input
document.getElementById("searchInput").addEventListener("input", function () {
  const q = this.value.trim().toLowerCase();
  const items = Array.from(casesContainer.querySelectorAll(".case-item"));
  let visible = 0;

  items.forEach((it) => {
    const match = it.textContent.toLowerCase().includes(q);
    it.hidden = !match;
    if (match) visible++;
  });

  noResults.hidden = visible !== 0;
});

// ---------------------------
// Stems add/remove
// ---------------------------
function addStem(containerId) {
  const container = document.getElementById(containerId);
  const idx = container.querySelectorAll(".stem-row").length + 1;
  const row = document.createElement("div");
  row.className = "stem-row";
  row.innerHTML = `
    <input type="text" class="stem-input" placeholder="Stem ${idx}">
    <button type="button" class="icon-btn" title="Remove stem">✕</button>
  `;
  row.querySelector("button").onclick = () => {
    row.remove();
    renumberStems(container);
  };
  container.appendChild(row);
}

function renumberStems(container) {
  Array.from(container.querySelectorAll(".stem-row .stem-input")).forEach(
    (inp, i) => {
      inp.placeholder = `Stem ${i + 1}`;
    }
  );
}

// ---------------------------
// Flashcards add/remove
// ---------------------------
function addFlashcard(containerId, mapRef) {
  const container = document.getElementById(containerId);
  const visibleIndex = container.querySelectorAll(".flashcard").length + 1;
  const id = uid();

  const card = document.createElement("div");
  card.className = "flashcard";
  card.dataset.cardId = id;

  card.innerHTML = `
    <div class="flashcard-header">
      <div class="flashcard-header-title">
        <span class="chev">▾</span><span class="fc-title">Flashcard ${visibleIndex}</span>
      </div>
      <button type="button" class="icon-btn" title="Remove flashcard">✕</button>
    </div>
    <div class="flashcard-body">
      <div class="flash-side">
        <div class="label-inline">Front:</div>
        <div id="${id}-front" class="quill-editor"></div>
        <input type="file" accept="image/*" class="image-upload" onchange="previewImage(this)"/>
      </div>
      <div class="flash-side">
        <div class="label-inline">Back:</div>
        <div id="${id}-back" class="quill-editor"></div>
        <input type="file" accept="image/*" class="image-upload" onchange="previewImage(this)"/>
      </div>
    </div>
  `;

  const removeBtn = card.querySelector(".flashcard-header .icon-btn");
  const header = card.querySelector(".flashcard-header");
  removeBtn.onclick = (e) => {
    e.stopPropagation();
    removeFlashcard(card, container, mapRef);
  };
  header.onclick = (e) => {
    if (e.target === removeBtn) return;
    card.classList.toggle("collapsed");
    card.querySelector(".chev").textContent = card.classList.contains(
      "collapsed"
    )
      ? "▸"
      : "▾";
  };

  container.appendChild(card);

  const front = new Quill(`#${id}-front`, { theme: "snow" });
  const back = new Quill(`#${id}-back`, { theme: "snow" });
  mapRef.set(id, { front, back });
}

function removeFlashcard(card, container, mapRef) {
  const id = card.dataset.cardId;
  mapRef.delete(id);
  card.remove();
  Array.from(container.querySelectorAll(".flashcard .fc-title")).forEach(
    (el, i) => (el.textContent = `Flashcard ${i + 1}`)
  );
}

async function previewImage(input) {
  if (input.files && input.files[0]) {
    const file = input.files[0];

    // Show a temporary "Uploading..." placeholder
    let img = input.parentNode.querySelector("img");
    if (!img) {
      img = document.createElement("img");
      img.style.width = "1500px"; // adjust as needed
      img.style.height = "auto";
      input.parentNode.appendChild(img);
    }
    img.src = ""; 
    img.alt = "Uploading...";

    try {
      const publicUrl = await uploadToSupabase(file);
      if (publicUrl) {
        img.src = publicUrl;
        img.alt = file.name;
      } else {
        img.alt = "Upload failed";
      }
    } catch (err) {
      console.error("Image upload failed:", err);
      img.alt = "Upload failed";
    }
  }
}

// ---------------------------
// Add Case
// ---------------------------

// Clear & open modal
document.getElementById("addCaseBtn").addEventListener("click", () => {
  addEditors = new Map();
  document.getElementById("caseTitle").value = "";
  document.getElementById("stemsContainer").innerHTML = "<h3>Stems</h3>";
  document.getElementById("flashcardsContainer").innerHTML = "<h3>Flashcards</h3>";
  openModal("addCaseModal");
});

// Attach Save Case listener once
const saveCaseBtn = document.getElementById("saveCaseBtn");
saveCaseBtn.replaceWith(saveCaseBtn.cloneNode(true)); // remove any previous listeners
document.getElementById("saveCaseBtn").addEventListener("click", saveCase);

async function saveCase() {
  const title = document.getElementById("caseTitle").value.trim();
  if (!title) return alert("Please enter a case title.");

  try {
    // Collect stems
    const stems = Array.from(
      document.querySelectorAll("#stemsContainer .stem-input")
    )
      .map((i) => i.value.trim())
      .filter(Boolean);

    // Collect flashcards
    const flashcards = [];
    for (const fc of document.querySelectorAll("#flashcardsContainer .flashcard")) {
      const id = fc.dataset.cardId;
      const ed = addEditors.get(id);
      const [frontFileInput, backFileInput] = fc.querySelectorAll(".image-upload");

      let frontImage = null;
      let backImage = null;

      if (frontFileInput && frontFileInput.files[0]) {
        frontImage = await uploadToSupabase(frontFileInput.files[0]);
      }
      if (backFileInput && backFileInput.files[0]) {
        backImage = await uploadToSupabase(backFileInput.files[0]);
      }

      flashcards.push({
        front: ed ? ed.front.root.innerHTML : "",
        back: ed ? ed.back.root.innerHTML : "",
        frontImage,
        backImage
      });
    }

    const caseObj = { title, stems, flashcards };
    console.debug("DEBUG: Case object to save:", caseObj);

    // Save to Supabase
    const savedCase = await saveCaseToSupabase(caseObj);
    console.debug("DEBUG: Saved case returned from Supabase:", savedCase);

    if (!savedCase) throw new Error("Supabase save returned null");

    // Update local DOM
    homeCases.push(savedCase);
    addCaseCardToDOM(savedCase.title, savedCase.id);
    noResults.hidden = true;
    closeModal("addCaseModal");

  } catch (err) {
    console.error("DEBUG: Error in saveCase:", err);
  }
}

// ---------------------------
// Edit Case Flow
// ---------------------------

// Show Edit Case Pre-screen
document.getElementById("editCaseBtn").addEventListener("click", async () => {
  await renderEditCaseList();
  document.getElementById("editSearchInput").value = "";
  openModal("editCasePreModal");
});

// Cancel button for pre-modal
document.getElementById("cancelEditPreBtn").addEventListener("click", () => {
  closeModal("editCasePreModal");
});

// Cancel button for edit modal
document.getElementById("cancelEditCaseBtn").addEventListener("click", () => {
  closeModal("editCaseModal");
});

// Render all cases in Edit Case Pre-screen
async function renderEditCaseList() {
  // Fetch cases if not already in memory
  if (!homeCases.length) {
    homeCases = await getCasesFromSupabase();
  }

  const container = document.getElementById("editCaseList");
  container.innerHTML = "";

  if (!homeCases.length) {
    document.getElementById("editNoCases").hidden = false;
    return;
  } else {
    document.getElementById("editNoCases").hidden = true;
  }

  homeCases.forEach((c) => {
    const card = document.createElement("div");
    card.className = "select-card";
    card.textContent = c.title;
    card.addEventListener("click", () => loadCaseForEditing(c));
    container.appendChild(card);
  });
}

// Load case into Edit Case modal
async function loadCaseForEditing(caseObj) {
  currentEditingCaseId = caseObj.id;

  // Clear previous editors
  editEditors.clear();

  // Set title
  document.getElementById("editCaseTitle").value = caseObj.title;

  // Clear stems and flashcards
  const stemsContainer = document.getElementById("editStemsContainer");
  stemsContainer.innerHTML = "<h3>Stems</h3>";
  const flashcardsContainer = document.getElementById("editFlashcardsContainer");
  flashcardsContainer.innerHTML = "<h3>Flashcards</h3>";

  // Populate stems
  caseObj.stems.forEach((s) => {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "stem-input";
    input.value = s;
    stemsContainer.appendChild(input);
  });

  // Populate flashcards
  for (const fc of caseObj.flashcards) {
    const flashDiv = document.createElement("div");
    flashDiv.className = "flashcard";
    // Front editor
    const front = document.createElement("div");
    front.className = "flash-side";
    front.innerHTML = fc.front || "";
    // Back editor
    const back = document.createElement("div");
    back.className = "flash-side";
    back.innerHTML = fc.back || "";

    flashDiv.appendChild(front);
    flashDiv.appendChild(back);

    flashcardsContainer.appendChild(flashDiv);

    // Save Quill editors in map
    editEditors.set(flashDiv, {
      front: new Quill(front, { theme: "snow" }),
      back: new Quill(back, { theme: "snow" }),
    });
  }

  closeModal("editCasePreModal");
  openModal("editCaseModal");
}

// Save edited case
document.getElementById("saveEditedCaseBtn").addEventListener("click", saveEditedCase);

async function saveEditedCase() {
  const title = document.getElementById("editCaseTitle").value.trim();
  if (!title) return alert("Please enter a case title.");

  // Build stems array
  const stems = Array.from(document.querySelectorAll("#editStemsContainer .stem-input"))
    .map((i) => i.value.trim())
    .filter(Boolean);

  // Build flashcards array
  const flashcards = [];
  for (const [fcDiv, ed] of editEditors.entries()) {
    flashcards.push({
      front: ed.front.root.innerHTML,
      back: ed.back.root.innerHTML,
    });
  }

  const caseObj = { title, stems, flashcards };
  console.log("DEBUG: Edited case object:", caseObj);

  try {
    const updatedCase = await updateCaseInSupabase(currentEditingCaseId, caseObj);
    console.log("DEBUG: Updated case:", updatedCase);

    if (updatedCase) {
      // Update in-memory array
      const index = homeCases.findIndex((c) => c.id === currentEditingCaseId);
      if (index > -1) homeCases[index] = updatedCase;

      // Optionally, refresh your home DOM here
      closeModal("editCaseModal");
      alert("Case updated successfully!");
    }
  } catch (err) {
    console.error("DEBUG: Error saving edited case:", err);
    alert("Failed to update case. Check console for details.");
  }
}

// ---------------------------
// Remove case
// ---------------------------
document.getElementById("removeCaseBtn").addEventListener("click", () => {
  document.getElementById("removeSearchInput").value = "";
  renderRemoveGrid("");
  openModal("removeCaseModal");
});

document
  .getElementById("removeSearchInput")
  .addEventListener("input", function () {
    renderRemoveGrid(this.value.trim());
  });

function renderRemoveGrid(query) {
  const grid = document.getElementById("removeCaseGrid");
  const empty = document.getElementById("removeNoCases");
  const removeBtn = document.getElementById("removeSelectedBtn");
  removeBtn.disabled = true;
  grid.innerHTML = "";
  const cases = getCases();
  const items = cases
    .map((c, i) => ({ title: c.title, index: i }))
    .filter((x) => x.title.toLowerCase().includes(query.toLowerCase()));
  if (items.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "select-card";
    card.textContent = item.title;
    card.dataset.index = item.index;
    card.onclick = () => {
      card.classList.toggle("selected");
      removeBtn.disabled =
        grid.querySelectorAll(".select-card.selected").length === 0;
    };
    grid.appendChild(card);
  });
}

function confirmRemoveCases() {
  const grid = document.getElementById("removeCaseGrid");
  const selected = Array.from(grid.querySelectorAll(".select-card.selected"));
  if (selected.length === 0) return;
  if (!confirm(`Remove ${selected.length} case(s)?`)) return;
  const toRemove = new Set(selected.map((c) => parseInt(c.dataset.index, 10)));
  const cases = getCases().filter((_, i) => !toRemove.has(i));
  setCases(cases);
  rebuildHomeGrid();
  closeModal("removeCaseModal");
}

// ---------------------------
// Init
// ---------------------------
window.addEventListener("DOMContentLoaded", rebuildHomeGrid);

// Sortable init for flashcards
if (document.getElementById("flashcardsContainer")) {
  new Sortable(document.getElementById("flashcardsContainer"), {
    handle: ".flashcard-header",
    animation: 150,
    draggable: ".flashcard",
    onEnd: function () {
      const cards = document
        .getElementById("flashcardsContainer")
        .querySelectorAll(".flashcard");
      cards.forEach((c, i) => {
        const titleEl = c.querySelector(".fc-title");
        if (titleEl) titleEl.textContent = `Flashcard ${i + 1}`;
      });
    },
  });
}
if (document.getElementById("editFlashcardsContainer")) {
  new Sortable(document.getElementById("editFlashcardsContainer"), {
    handle: ".flashcard-header",
    animation: 150,
    draggable: ".flashcard",
    onEnd: function () {
      const cards = document
        .getElementById("editFlashcardsContainer")
        .querySelectorAll(".flashcard");
      cards.forEach((c, i) => {
        const titleEl = c.querySelector(".fc-title");
        if (titleEl) titleEl.textContent = `Flashcard ${i + 1}`;
      });
    },
  });
}

// ---------------------------
// Study Mode
// ---------------------------
(() => {
  const startBtn = document.getElementById("startStudyBtn");
  const modal = document.getElementById("studyModal");
  const flipCard = document.getElementById("studyFlipCard");
  const frontContainer = document.getElementById("studyFrontContainer");
  const backContainer = document.getElementById("studyBackContainer");
  const prevBtn = document.getElementById("prevCardBtn");
  const nextBtn = document.getElementById("nextCardBtn");
  const closeBtn = document.getElementById("closeStudyBtn");
  const progressEl = document.getElementById("studyProgress");
  const titleEl = document.getElementById("studyTitle");

  let deck = [];
  let pos = 0;

  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  function plainTextFromHtml(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html || "";
    return (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
  }

  function renderCard() {
    if (!deck.length) {
      titleEl.textContent = "Study";
      frontContainer.innerHTML = '<div class="content-body muted">No cards</div>';
      backContainer.innerHTML = "";
      progressEl.textContent = "Card 0 of 0";
      prevBtn.disabled = nextBtn.disabled = true;
      return;
    }

    const card = deck[pos];
    titleEl.textContent = card.stem || "Study";

    frontContainer.innerHTML = `<div class="content-body">${
      card.frontHtml || '<span class="muted">[No front]</span>'
    }${card.frontImage ? `<img src="${card.frontImage}" class="flash-image">` : ""}</div>`;

    const questionText = plainTextFromHtml(card.frontHtml) || "[No question]";
    backContainer.innerHTML = `<div class="content-title">${questionText}</div><div class="content-body">${
      card.backHtml || '<span class="muted">[No answer]</span>'
    }${card.backImage ? `<img src="${card.backImage}" class="flash-image">` : ""}</div>`;

    flipCard.classList.remove("flipped"); // always show front
    prevBtn.disabled = pos === 0;
    nextBtn.disabled = pos === deck.length - 1;
    progressEl.textContent = `Card ${pos + 1} of ${deck.length}`;
  }

  function studyDeck(newDeck) {
    deck = newDeck || [];
    pos = 0;
    modal.hidden = false;
    renderCard();
  }

  flipCard.onclick = () => flipCard.classList.toggle("flipped");
  prevBtn.onclick = () => { if (pos > 0) { pos--; renderCard(); } };
  nextBtn.onclick = () => { if (pos < deck.length - 1) { pos++; renderCard(); } };
  closeBtn.onclick = () => modal.hidden = true;

  startBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    const cases = getCases();
    if (!cases.length) return alert("No flashcards found.");

    shuffleArray(cases);
    const combinedDeck = [];
    cases.forEach(c => {
      if (!c.flashcards?.length) return;
      const stem = c.stems?.length ? c.stems[Math.floor(Math.random() * c.stems.length)] : "";
      c.flashcards.forEach(fc => combinedDeck.push({
        stem,
        frontHtml: fc.front || "",
        backHtml: fc.back || "",
        frontImage: fc.frontImage || null,
        backImage: fc.backImage || null
      }));
    });

    studyDeck(combinedDeck);
  });

  window.openCaseStudy = (index) => {
    const cases = getCases();
    const c = cases[index];
    if (!c?.flashcards?.length) return alert("No flashcards for this case.");

    const stem = c.stems?.length ? c.stems[Math.floor(Math.random() * c.stems.length)] : "";
    const caseDeck = c.flashcards.map(fc => ({
      stem,
      frontHtml: fc.front || "",
      backHtml: fc.back || "",
      frontImage: fc.frontImage || null,
      backImage: fc.backImage || null
    }));
    studyDeck(caseDeck);
  };
})();

// ---------------------------
// Modal Button Listeners
// ---------------------------
// Add Case Modal
document.getElementById("addCaseBtn").addEventListener("click", () => {
  addEditors = new Map();
  document.getElementById("caseTitle").value = "";
  document.getElementById("stemsContainer").innerHTML = "<h3>Stems</h3>";
  document.getElementById("flashcardsContainer").innerHTML =
    "<h3>Flashcards</h3>";
  openModal("addCaseModal");
});
document
  .getElementById("cancelAddCaseBtn")
  .addEventListener("click", () => closeModal("addCaseModal"));
document
  .getElementById("addStemBtn")
  .addEventListener("click", () => addStem("stemsContainer"));
document
  .getElementById("addFlashcardBtn")
  .addEventListener("click", () =>
    addFlashcard("flashcardsContainer", addEditors)
  );
document.getElementById("saveCaseBtn").addEventListener("click", saveCase);

// Edit Case Pre-screen
document.getElementById("editCaseBtn").addEventListener("click", () => {
  document.getElementById("editSearchInput").value = "";
  renderEditCaseList("");
  openModal("editCasePreModal");
});
document
  .getElementById("cancelEditPreBtn")
  .addEventListener("click", () => closeModal("editCasePreModal"));

// Edit Case Modal
document
  .getElementById("editAddStemBtn")
  .addEventListener("click", () => addStem("editStemsContainer"));
document
  .getElementById("editAddFlashcardBtn")
  .addEventListener("click", () =>
    addFlashcard("editFlashcardsContainer", editEditors)
  );
document
  .getElementById("saveEditedCaseBtn")
  .addEventListener("click", saveEditedCase);
document
  .getElementById("cancelEditCaseBtn")
  .addEventListener("click", () => closeModal("editCaseModal"));

// Remove Case Modal
document.getElementById("removeCaseBtn").addEventListener("click", () => {
  document.getElementById("removeSearchInput").value = "";
  renderRemoveGrid("");
  openModal("removeCaseModal");
});
document
  .getElementById("cancelRemoveCaseBtn")
  .addEventListener("click", () => closeModal("removeCaseModal"));
document
  .getElementById("removeSelectedBtn")
  .addEventListener("click", confirmRemoveCases);
