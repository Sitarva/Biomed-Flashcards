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
function getCases() {
  return JSON.parse(localStorage.getItem("cases") || "[]");
}
function setCases(arr) {
  localStorage.setItem("cases", JSON.stringify(arr));
}

function rebuildHomeGrid() {
  casesContainer.querySelectorAll(".case-item").forEach((n) => n.remove());
  const cases = getCases();
  cases.forEach((c, i) => addCaseCardToDOM(c.title, i));
  noResults.hidden = cases.length !== 0;
}

function addCaseCardToDOM(title, index) {
  const div = document.createElement("div");
  div.className = "case-item";
  div.textContent = title;
  div.style.cursor = "pointer";
  div.onclick = () => openCaseStudy(index);
  casesContainer.insertBefore(div, noResults);
}

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

function previewImage(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = document.createElement("img");
      img.src = e.target.result;
      img.style.maxWidth = "100%";
      img.style.display = "block";
      img.style.marginTop = "6px";
      input.parentNode.appendChild(img);
    };
    reader.readAsDataURL(input.files[0]);
  }
}

// ---------------------------
// Add case
// ---------------------------
document.getElementById("addCaseBtn").addEventListener("click", () => {
  addEditors = new Map();
  document.getElementById("caseTitle").value = "";
  document.getElementById("stemsContainer").innerHTML = "<h3>Stems</h3>";
  document.getElementById("flashcardsContainer").innerHTML =
    "<h3>Flashcards</h3>";
  openModal("addCaseModal");
});

function saveCase() {
  const title = document.getElementById("caseTitle").value.trim();
  if (!title) return alert("Please enter a case title.");

  const stems = Array.from(
    document.querySelectorAll("#stemsContainer .stem-input")
  )
    .map((i) => i.value.trim())
    .filter(Boolean);

  const flashcards = Array.from(
    document.querySelectorAll("#flashcardsContainer .flashcard")
  ).map((fc) => {
    const id = fc.dataset.cardId;
    const ed = addEditors.get(id);
    const [frontFile, backFile] = fc.querySelectorAll(".image-upload");
    return {
      front: ed ? ed.front.root.innerHTML : "",
      back: ed ? ed.back.root.innerHTML : "",
      frontImage:
        frontFile && frontFile.files[0]
          ? URL.createObjectURL(frontFile.files[0])
          : null,
      backImage:
        backFile && backFile.files[0]
          ? URL.createObjectURL(backFile.files[0])
          : null,
    };
  });

  const cases = getCases();
  cases.push({ title, stems, flashcards });
  setCases(cases);
  addCaseCardToDOM(title, cases.length - 1);
  noResults.hidden = true;
  closeModal("addCaseModal");
}

// ---------------------------
// Edit case
// ---------------------------
document.getElementById("editCaseBtn").addEventListener("click", () => {
  document.getElementById("editSearchInput").value = "";
  renderEditCaseList("");
  openModal("editCasePreModal");
});

document
  .getElementById("editSearchInput")
  .addEventListener("input", function () {
    renderEditCaseList(this.value.trim());
  });

function renderEditCaseList(query) {
  const list = document.getElementById("editCaseList");
  const noCasesMsg = document.getElementById("editNoCases");
  list.innerHTML = "";
  const cases = getCases();
  const filtered = cases
    .map((c, i) => ({ title: c.title, index: i }))
    .filter((x) => x.title.toLowerCase().includes(query.toLowerCase()));
  if (filtered.length === 0) {
    noCasesMsg.hidden = false;
    return;
  }
  noCasesMsg.hidden = true;
  filtered.forEach((item) => {
    const card = document.createElement("div");
    card.className = "select-card";
    card.textContent = item.title;
    card.onclick = () => openCaseForEdit(item.index);
    list.appendChild(card);
  });
}

function openCaseForEdit(index) {
  closeModal("editCasePreModal");
  editEditors = new Map();
  currentEditIndex = index;
  const cases = getCases();
  const c = cases[index];
  document.getElementById("editCaseTitle").value = c.title;

  const stemsWrap = document.getElementById("editStemsContainer");
  const fcsWrap = document.getElementById("editFlashcardsContainer");
  stemsWrap.innerHTML = "<h3>Stems</h3>";
  fcsWrap.innerHTML = "<h3>Flashcards</h3>";

  c.stems.forEach((s, i) => {
    addStem("editStemsContainer");
    stemsWrap.querySelectorAll(".stem-input")[i].value = s;
  });
  c.flashcards.forEach((fc, i) => {
    addFlashcard("editFlashcardsContainer", editEditors);
    const card = fcsWrap.querySelectorAll(".flashcard")[i];
    const id = card.dataset.cardId;
    const ed = editEditors.get(id);
    ed.front.root.innerHTML = fc.front || "";
    ed.back.root.innerHTML = fc.back || "";
  });

  openModal("editCaseModal");
}

function saveEditedCase() {
  if (currentEditIndex === null) return;
  const cases = getCases();
  const title = document.getElementById("editCaseTitle").value.trim();
  if (!title) return alert("Please enter a title.");

  const stems = Array.from(
    document.querySelectorAll("#editStemsContainer .stem-input")
  )
    .map((i) => i.value.trim())
    .filter(Boolean);
  const flashcards = Array.from(
    document.querySelectorAll("#editFlashcardsContainer .flashcard")
  ).map((fc) => {
    const id = fc.dataset.cardId;
    const ed = editEditors.get(id);
    const [frontFile, backFile] = fc.querySelectorAll(".image-upload");
    return {
      front: ed ? ed.front.root.innerHTML : "",
      back: ed ? ed.back.root.innerHTML : "",
      frontImage:
        frontFile && frontFile.files[0]
          ? URL.createObjectURL(frontFile.files[0])
          : null,
      backImage:
        backFile && backFile.files[0]
          ? URL.createObjectURL(backFile.files[0])
          : null,
    };
  });

  cases[currentEditIndex] = { title, stems, flashcards };
  setCases(cases);
  rebuildHomeGrid();
  closeModal("editCaseModal");
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

if (document.getElementById("flashcardsContainer")) {
  new Sortable(document.getElementById("flashcardsContainer"), {
    handle: ".flashcard-header", // can only drag by header
    animation: 150,
    draggable: ".flashcard", // only these elements are draggable
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
// Study Mode / Flip Cards
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

  let studyDeck = [];
  let studyPos = 0;

  function plainTextFromHtml(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html || "";
    return (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
  }

  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  function buildDeckAllCases() {
    const cases = getCases() || [];
    shuffleArray(cases); // only shuffle cases
    const deck = [];
    cases.forEach((c) => {
      if (!c.flashcards?.length) return;
      const stem = c.stems?.length ? c.stems[Math.floor(Math.random() * c.stems.length)] : "";
      c.flashcards.forEach((fc) => {
        deck.push({
          stem,
          frontHtml: fc.front || "",
          backHtml: fc.back || "",
          frontImage: fc.frontImage || null,
          backImage: fc.backImage || null,
        });
      });
    });
    return deck;
  }

  function renderCard() {
    if (!studyDeck.length) {
      titleEl.textContent = "Study";
      frontContainer.innerHTML = '<div class="content-body muted">No cards to study.</div>';
      backContainer.innerHTML = "";
      progressEl.textContent = "Card 0 of 0";
      prevBtn.disabled = nextBtn.disabled = true;
      return;
    }
    const card = studyDeck[studyPos];
    titleEl.textContent = card.stem || "Study";
    frontContainer.innerHTML = `<div class="content-body">${
      card.frontHtml || '<span class="muted">[No front]</span>'
    }${card.frontImage ? `<img src="${card.frontImage}" class="flash-image">` : ""}</div>`;
    const questionText = plainTextFromHtml(card.frontHtml) || "[No question]";
    backContainer.innerHTML = `<div class="content-title">${escapeHtml(questionText)}</div><div class="content-body">${
      card.backHtml || '<span class="muted">[No answer]</span>'
    }${card.backImage ? `<img src="${card.backImage}" class="flash-image">` : ""}</div>`;
    flipCard.classList.remove("is-flipped", "flipped");
    prevBtn.disabled = studyPos === 0;
    nextBtn.disabled = studyPos === studyDeck.length - 1;
    progressEl.textContent = `Card ${studyPos + 1} of ${studyDeck.length}`;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/[&<>"']/g, (s) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s])
    );
  }

  function openStudyModal() {
    modal.hidden = false;
    renderCard();
  }

  startBtn?.addEventListener("click", (e) => {
    e?.preventDefault();
    studyDeck = buildDeckAllCases();
    if (!studyDeck.length) {
      alert("No cases with flashcards found to study.");
      return;
    }
    studyPos = 0;
    openStudyModal();
  });

  flipCard.addEventListener("click", () => flipCard.classList.toggle("is-flipped"));
  prevBtn.addEventListener("click", () => {
    if (studyPos > 0) {
      studyPos--;
      renderCard();
    }
  });
  nextBtn.addEventListener("click", () => {
    if (studyPos < studyDeck.length - 1) {
      studyPos++;
      renderCard();
    }
  });
  closeBtn.addEventListener("click", () => (modal.hidden = true));

  // Open a specific case from home
  window.openCaseStudy = function (index) {
    const c = getCases()[index];
    if (!c?.flashcards?.length) {
      alert("No flashcards for this case.");
      return;
    }
    const stem = c.stems?.length ? c.stems[Math.floor(Math.random() * c.stems.length)] : "";
    studyDeck = c.flashcards.map((fc) => ({
      stem,
      frontHtml: fc.front || "",
      backHtml: fc.back || "",
      frontImage: fc.frontImage || null,
      backImage: fc.backImage || null,
    }));
    studyPos = 0;
    openStudyModal();
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
