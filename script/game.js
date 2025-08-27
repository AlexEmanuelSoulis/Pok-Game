/* This code does: username gate → pick 3 (via 6 starters or Pokédex modal) → enemy gets 3 different → real move names+power from PokéAPI → battle with 1s cooldown, switch prev/next, bag, win/lose.
   Prefix meanings:
   el  = DOM Element
   btn = Button Element
   arr = Array
   obj = Object
   num = Number
   bool = Boolean
   str = String
   fn  = Function
*/

/* =============== STEP 0 — USERNAME GATE =============== */

/* This block selects username inputs */
const elInputUsername      = document.querySelector("#inputName");
const btnContinueFromName  = document.querySelector("#btnShowName");
const elDisplayName        = document.querySelector("#displayName");
const elUsernameError      = document.querySelector("#errorUsernameMessage");

/* This block selects big sections to show/hide */
const elSectionName        = document.querySelector(".section-name");
const elSectionStart       = document.querySelector(".section-start");
const elSectionSelection   = document.querySelector(".section-selection");
const elSectionBattle      = document.querySelector(".section-battle");
const elSectionWin         = document.querySelector(".section-win");
const elSectionLose        = document.querySelector(".section-lose");

/* This function shows only the Name step */
function fnLockToNameGate(){
  elSectionName.classList.remove("hidden");
  elSectionStart.classList.add("hidden");
  elSectionSelection.classList.add("hidden");
  elSectionBattle.classList.add("hidden");
  elSectionWin.classList.add("hidden");
  elSectionLose.classList.add("hidden");
}

/* This function goes to the Start step */
function fnUnlockAfterName(){
  elSectionName.classList.add("hidden");
  elSectionStart.classList.remove("hidden");
}

/* This button checks the name is not empty */
btnContinueFromName.addEventListener("click", () => {
  const strName = elInputUsername.value.trim();
  if(strName === ""){
    elUsernameError.textContent = "Please enter a username";
    elDisplayName.textContent = "";
    return;
  }
  elUsernameError.textContent = "";
  elDisplayName.textContent = "Hello, " + strName + "!";
  window.strCurrentUsername = strName; /* store if you want to show later */
  fnUnlockAfterName();
});

/* Start locked on the name step */
fnLockToNameGate();

/* =============== STEP 1 — START + PICK PATH =============== */

const btnGetStarters       = document.querySelector("#btnPokeGet");
const btnOpenDex           = document.querySelector("#btnOpenDex");

/* 6 simple starters to keep it small (still can use full Dex) */
const arrStarterIds        = [1, 4, 7, 25, 39, 133];

const arrOptionSpans       = [
  document.querySelector("#pokemonOption1"),
  document.querySelector("#pokemonOption2"),
  document.querySelector("#pokemonOption3"),
  document.querySelector("#pokemonOption4"),
  document.querySelector("#pokemonOption5"),
  document.querySelector("#pokemonOption6"),
];
const arrSelectButtons     = document.querySelectorAll(".btn-select-pokemon");

/* Previews (small cards) */
const elPreviewPlayer      = document.querySelector("#playerPokemons");
const elPreviewOpponent    = document.querySelector("#opponentPokemons");

/* Helper: clone hidden small-card template */
function fnCloneCardTemplate(){
  const elTemplate = document.querySelector("#pokemonCardTemplate");
  const elClone = elTemplate.cloneNode(true);
  elClone.classList.remove("d-none");
  elClone.id = "";
  return elClone;
}
function fnAddPreviewCard(elContainer, strName, strImgUrl){
  const elCard = fnCloneCardTemplate();
  const elImg = elCard.querySelector("img");
  elImg.src = strImgUrl;
  elImg.alt = strName;
  elCard.querySelector(".pokemon-name").textContent = strName;
  elContainer.appendChild(elCard);
}

/* Small helper */
function fnCap(str){ return str ? str.charAt(0).toUpperCase() + str.slice(1) : str; }

/* =============== API HELPERS (easy version) =============== */

/* This function fetches a Pokémon by id */
async function fnFetchPokemon(numId){
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${numId}`);
  return res.json();
}

/* This function picks up to 4 real moves with power.
   It loops simple and stops when it finds 4 damaging moves. */
async function fnBuildMovesFromPokemon(objData){
  const arrAll = objData.moves || [];
  const arrTry = arrAll.slice(0, 30); /* small number so it stays fast */
  const arrChosen = [];

  for(let i=0;i<arrTry.length;i++){
    const strUrl = arrTry[i]?.move?.url;
    if(!strUrl) continue;
    try{
      const res = await fetch(strUrl);
      const objMove = await res.json();
      const numPower = objMove.power; /* can be null */
      if(typeof numPower === "number" && numPower > 0){
        const strName = fnCap((objMove.name || "").replace(/-/g," "));
        arrChosen.push({ name: strName, power: numPower });
      }
      if(arrChosen.length >= 4) break;
    }catch(e){}
  }

  /* If not enough, fill with simple Tackle */
  while(arrChosen.length < 4){
    arrChosen.push({ name: "Tackle", power: 20 });
  }
  return arrChosen.slice(0,4);
}

/* This function creates our simple Pokémon object */
async function fnBuildPokemon(numId){
  const objData = await fnFetchPokemon(numId);
  const strName = fnCap(objData.name);
  const strImg  = objData.sprites?.other?.["official-artwork"]?.front_default
               || objData.sprites?.front_default
               || "";
  const arrMoves = await fnBuildMovesFromPokemon(objData);
  const numMaxHp = 100; /* for students: all 100 HP */

  return {
    id: numId,
    name: strName,
    img: strImg,
    hp: numMaxHp,
    maxHp: numMaxHp,
    alive: true,
    moves: arrMoves
  };
}

/* This fills the 6 starter buttons with names and data */
async function fnLoadStarterButtons(){
  for(let i=0;i<arrStarterIds.length;i++){
    const numId   = arrStarterIds[i];
    const objData = await fnFetchPokemon(numId);
    const strName = fnCap(objData.name);
    const strImg  = objData.sprites?.other?.["official-artwork"]?.front_default
                 || objData.sprites?.front_default
                 || "";
    arrOptionSpans[i].textContent = strName;
    arrSelectButtons[i].dataset.pokemonId   = String(numId);
    arrSelectButtons[i].dataset.pokemonName = strName;
    arrSelectButtons[i].dataset.pokemonImg  = strImg;
    arrSelectButtons[i].disabled = false;
  }
}

/* Starters path: go to selection and load 6 buttons */
btnGetStarters.addEventListener("click", async () => {
  elSectionStart.classList.add("hidden");
  elSectionSelection.classList.remove("hidden");
  await fnLoadStarterButtons();
});

/* =============== SELECTION (from 6 buttons) =============== */

let numChosenCount        = 0;
const numMaxChoices       = 3;

let arrPlayerTeam         = [];
let arrOpponentTeam       = [];
let arrPlayerChosenIds    = [];
const elSelectedList      = document.querySelector("#selectedPokemonsID");

/* Choose 3 from the 6 starters */
for(let i=0;i<arrSelectButtons.length;i++){
  arrSelectButtons[i].addEventListener("click", async () => {
    if(numChosenCount >= numMaxChoices || arrSelectButtons[i].disabled) return;

    arrSelectButtons[i].disabled = true;
    numChosenCount++;

    const numId = Number(arrSelectButtons[i].dataset.pokemonId || 0);
    const objMon = await fnBuildPokemon(numId);

    arrPlayerChosenIds.push(numId);
    arrPlayerTeam.push(objMon);

    /* update UI */
    elSelectedList.textContent = arrPlayerTeam.map(p => p.name).join(", ");
    fnAddPreviewCard(elPreviewPlayer, objMon.name, objMon.img);

    /* after 3 chosen → enemy = other 3 starters */
    if(numChosenCount === numMaxChoices){
      arrSelectButtons.forEach(b => b.disabled = true);
      arrOpponentTeam = [];
      const arrRemaining = arrStarterIds.filter(id => !arrPlayerChosenIds.includes(id));
      for(let j=0;j<arrRemaining.length;j++){
        const objOpp = await fnBuildPokemon(arrRemaining[j]);
        arrOpponentTeam.push(objOpp);
        fnAddPreviewCard(elPreviewOpponent, objOpp.name, objOpp.img);
      }
      fnStartBattlePrompt();
    }
  });
}

/* =============== POKÉDEX MODAL (search + pick 3) =============== */

const elDexModal         = document.querySelector("#dexModal");
const elInputDexSearch   = document.querySelector("#inputDexSearch");
const elDexGrid          = document.querySelector("#dexGrid");
const elDexSelectedCount = document.querySelector("#dexSelectedCount");
const btnDexConfirm      = document.querySelector("#btnDexConfirm");
const btnDexClear        = document.querySelector("#btnDexClear");

let arrDexEntries = [];        /* { id, name, img } 1..151 */
let setDexSelected = new Set();

/* Open modal from Start step */
btnOpenDex.addEventListener("click", async () => {
  await fnInitDexIndex();
  setDexSelected.clear();
  elInputDexSearch.value = "";
  fnRenderDexGrid("");
  fnUpdateDexFooter();
  const objModal = new bootstrap.Modal(elDexModal);
  objModal.show();
});

/* Build entries 1..151 once */
async function fnInitDexIndex(){
  if(arrDexEntries.length) return;
  const res = await fetch("https://pokeapi.co/api/v2/pokemon?limit=151&offset=0");
  const obj = await res.json();
  arrDexEntries = obj.results.map(r => {
    const match = r.url.match(/\/pokemon\/(\d+)\//);
    const numId = match ? Number(match[1]) : 0;
    const strImg = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${numId}.png`;
    return { id: numId, name: r.name, img: strImg };
  });
}

/* Render grid with search filter */
function fnRenderDexGrid(strFilter){
  const strQ = (strFilter || "").toLowerCase().trim();
  const arrFiltered = arrDexEntries.filter(e => e.name.includes(strQ));

  elDexGrid.innerHTML = arrFiltered.map(e => `
    <div class="col-6 col-sm-4 col-md-3 col-lg-2">
      <div class="card text-center">
        <div class="ratio ratio-1x1 bg-light">
          <img src="${e.img}" alt="${e.name}" class="card-img-top p-2">
        </div>
        <div class="card-body p-2">
          <div class="card-title text-capitalize small mb-2">${e.name}</div>
          <button class="btn btn-sm ${setDexSelected.has(e.id) ? 'btn-success' : 'btn-outline-primary'} btnDexSelect"
                  data-id="${e.id}"
                  ${setDexSelected.size>=3 && !setDexSelected.has(e.id) ? 'disabled' : ''}>
            ${setDexSelected.has(e.id) ? 'Selected' : 'Select'}
          </button>
        </div>
      </div>
    </div>
  `).join("");
}

/* Footer (count + enable/disable confirm) */
function fnUpdateDexFooter(){
  elDexSelectedCount.textContent = `${setDexSelected.size} / 3`;
  btnDexConfirm.disabled = (setDexSelected.size !== 3);
}

/* Search typing */
elInputDexSearch.addEventListener("input", () => {
  fnRenderDexGrid(elInputDexSearch.value);
  fnUpdateDexFooter();
});

/* Click select/deselect inside grid */
elDexGrid.addEventListener("click", (ev) => {
  const elBtn = ev.target.closest(".btnDexSelect");
  if(!elBtn) return;
  const numId = Number(elBtn.dataset.id);
  if(setDexSelected.has(numId)) setDexSelected.delete(numId);
  else if(setDexSelected.size < 3) setDexSelected.add(numId);
  fnRenderDexGrid(elInputDexSearch.value);
  fnUpdateDexFooter();
});

/* Clear selected */
btnDexClear.addEventListener("click", () => {
  setDexSelected.clear();
  fnRenderDexGrid(elInputDexSearch.value);
  fnUpdateDexFooter();
});

/* Confirm → build teams and go to battle */
btnDexConfirm.addEventListener("click", async () => {
  if(setDexSelected.size !== 3) return;

  /* Player team from selected */
  arrPlayerChosenIds = Array.from(setDexSelected);
  arrPlayerTeam = [];
  elPreviewPlayer.innerHTML = "";
  for(let i=0;i<arrPlayerChosenIds.length;i++){
    const objP = await fnBuildPokemon(arrPlayerChosenIds[i]);
    arrPlayerTeam.push(objP);
    fnAddPreviewCard(elPreviewPlayer, objP.name, objP.img);
  }
  document.querySelector("#selectedPokemonsID").textContent = arrPlayerTeam.map(x=>x.name).join(", ");

  /* Opponent = 3 random different from remaining 1..151 */
  const arrAll = Array.from({length:151}, (_,i)=> i+1);
  const arrRemain = arrAll.filter(id => !arrPlayerChosenIds.includes(id));
  const arrOppIds = [];
  while(arrOppIds.length < 3 && arrRemain.length){
    const numIndex = Math.floor(Math.random() * arrRemain.length);
    arrOppIds.push(arrRemain.splice(numIndex,1)[0]);
  }
  arrOpponentTeam = [];
  elPreviewOpponent.innerHTML = "";
  for(let j=0;j<arrOppIds.length;j++){
    const objO = await fnBuildPokemon(arrOppIds[j]);
    arrOpponentTeam.push(objO);
    fnAddPreviewCard(elPreviewOpponent, objO.name, objO.img);
  }

  /* Hide start, show selection (previews), then go prompt */
  elSectionStart.classList.add("hidden");
  elSectionSelection.classList.remove("hidden");

  const modal = bootstrap.Modal.getInstance(elDexModal);
  if(modal) modal.hide();

  /* Lock the 6 buttons to avoid mixing flows */
  arrSelectButtons.forEach(b => b.disabled = true);
  numChosenCount = 3;
  fnStartBattlePrompt();
});

/* =============== BATTLE =============== */

/* Battle elements */
const elPlayerActiveImg   = document.querySelector("#playerActiveImg");
const elPlayerActiveName  = document.querySelector("#playerActiveName");
const elPlayerActiveHPText= document.querySelector("#playerActiveHPText");
const elPlayerActiveHPBar = document.querySelector("#playerActiveHPBar");

const elOpponentActiveImg   = document.querySelector("#opponentActiveImg");
const elOpponentActiveName  = document.querySelector("#opponentActiveName");
const elOpponentActiveHPText= document.querySelector("#opponentActiveHPText");
const elOpponentActiveHPBar = document.querySelector("#opponentActiveHPBar");

const elPokedexImg        = document.querySelector("#playerPokedexImg");
const elPokedexName       = document.querySelector("#playerPokedexName");
const elPokedexHPText     = document.querySelector("#playerPokedexHPText");
const elPokedexMovesList  = document.querySelector("#playerPokedexMoves");

const btnFight            = document.querySelector("#btnFight");
const btnSwitch           = document.querySelector("#btnSwitch");
const btnBag              = document.querySelector("#btnBag");
const btnRun              = document.querySelector("#btnRun");
const elActionPanel       = document.querySelector("#actionPanel");
const elBattleLog         = document.querySelector("#battleLog");

const btnPrevActive       = document.querySelector("#btnPrevActive");
const btnNextActive       = document.querySelector("#btnNextActive");
const elCooldownBadge     = document.querySelector("#battleCooldown");

let boolGameActive        = false;
let boolBusyTurn          = false;
let numPlayerIndex        = 0;
let numOpponentIndex      = 0;
let objBagItems           = { potion: 3, superPotion: 1 };

const numCooldownMs       = 1000;
let timerOpponent         = null;

/* Render both HUD sides and the small Pokédex */
function fnRenderActiveUI(){
  const objP = arrPlayerTeam[numPlayerIndex];
  const objO = arrOpponentTeam[numOpponentIndex];

  elPlayerActiveImg.src = objP.img;
  elPlayerActiveName.textContent = objP.name;
  elPlayerActiveHPText.textContent = `${objP.hp}/${objP.maxHp} HP`;
  elPlayerActiveHPBar.style.width = Math.max(0, Math.round(objP.hp/objP.maxHp*100)) + "%";

  elOpponentActiveImg.src = objO.img;
  elOpponentActiveName.textContent = objO.name;
  elOpponentActiveHPText.textContent = `${objO.hp}/${objO.maxHp} HP`;
  elOpponentActiveHPBar.style.width = Math.max(0, Math.round(objO.hp/objO.maxHp*100)) + "%";

  elPokedexImg.src = objP.img;
  elPokedexName.textContent = objP.name;
  elPokedexHPText.textContent = `${objP.hp}/${objP.maxHp} HP`;

  elPokedexMovesList.innerHTML = "";
  for(let i=0;i<objP.moves.length;i++){
    const objMove = objP.moves[i];
    const elLi = document.createElement("li");
    elLi.className = "list-group-item d-flex justify-content-between align-items-center";
    elLi.textContent = objMove.name;
    const elBadge = document.createElement("span");
    elBadge.className = "badge text-bg-primary rounded-pill";
    elBadge.textContent = objMove.power;
    elLi.appendChild(elBadge);
    elPokedexMovesList.appendChild(elLi);
  }
}

function fnLog(strMsg){ elBattleLog.textContent = strMsg; }

function fnAnyAlive(arrTeam){
  for(let i=0;i<arrTeam.length;i++){
    if(arrTeam[i].alive) return true;
  }
  return false;
}
function fnNextAliveIndex(arrTeam){
  for(let i=0;i<arrTeam.length;i++){
    if(arrTeam[i].alive) return i;
  }
  return -1;
}
function fnDamage(numBase){
  return Math.max(5, Math.floor((numBase || 10) + Math.random()*10));
}
function fnSetActionsEnabled(boolEnabled){
  [btnFight, btnSwitch, btnBag, btnRun, btnPrevActive, btnNextActive].forEach(b => { if(b){ b.disabled = !boolEnabled; } });
  elActionPanel.querySelectorAll("button").forEach(b => b.disabled = !boolEnabled);
}
function fnShowCooldown(boolShow){
  if(elCooldownBadge){ elCooldownBadge.classList.toggle("d-none", !boolShow); }
}

/* When ready → show prompt and prepare battle UI */
function fnStartBattlePrompt(){
  elSectionSelection.classList.add("hidden");
  elSectionBattle.classList.remove("hidden");

  numPlayerIndex = fnNextAliveIndex(arrPlayerTeam);
  numOpponentIndex = fnNextAliveIndex(arrOpponentTeam);
  fnRenderActiveUI();

  elActionPanel.innerHTML = `
    <div class="text-center">
      <p class="mb-2">Fight or Run?</p>
      <button id="btnStartFight" class="btn btn-danger me-2">Fight</button>
      <button id="btnStartRun" class="btn btn-outline-dark">Run</button>
    </div>
  `;
  fnLog("Choose: Fight or Run.");

  document.querySelector("#btnStartFight").addEventListener("click", () => {
    boolGameActive = true;
    elActionPanel.innerHTML = "";
    fnOpenFightPanel();
  });
  document.querySelector("#btnStartRun").addEventListener("click", () => {
    fnHandleRun();
  });
}

/* Actions: Fight / Switch / Bag / Run */
function fnOpenFightPanel(){
  if(!boolGameActive || boolBusyTurn) return;
  const objP = arrPlayerTeam[numPlayerIndex];
  elActionPanel.innerHTML = `
    <div class="mb-2">Attack ${arrOpponentTeam[numOpponentIndex].name} with:</div>
    <div class="d-flex flex-wrap gap-2">
      ${objP.moves.map((m,i)=>`
        <button class="btn btn-outline-primary btn-sm" data-idx="${i}">
          ${m.name} (${m.power})
        </button>
      `).join("")}
    </div>
  `;
  elActionPanel.querySelectorAll("button[data-idx]").forEach(btn => {
    btn.addEventListener("click", () => {
      const numIdx = Number(btn.dataset.idx);
      fnDoPlayerAttack(numIdx);
    });
  });
}
function fnOpenSwitchPanel(){
  if(!boolGameActive || boolBusyTurn) return;
  let strHtml = `<div class="mb-2">Choose a Pokémon to switch in.</div><div class="d-flex flex-wrap gap-2">`;
  for(let i=0;i<arrPlayerTeam.length;i++){
    const obj = arrPlayerTeam[i];
    if(!obj.alive || i===numPlayerIndex) continue;
    strHtml += `<button class="btn btn-outline-secondary btn-sm" data-switch="${i}">
      ${obj.name} (${obj.hp}/${obj.maxHp})
    </button>`;
  }
  strHtml += `</div>`;
  elActionPanel.innerHTML = strHtml;

  elActionPanel.querySelectorAll("button[data-switch]").forEach(b => {
    b.addEventListener("click", () => {
      const numIdx = Number(b.dataset.switch);
      fnSwitchTo(numIdx);
      elActionPanel.innerHTML = "";
    });
  });
}
function fnOpenBagPanel(){
  if(!boolGameActive || boolBusyTurn) return;
  elActionPanel.innerHTML = `
    <div class="mb-2">Choose an item.</div>
    <div class="d-flex flex-wrap gap-2">
      <button id="btnUsePotion" class="btn btn-success btn-sm" ${objBagItems.potion<=0?"disabled":""}>Potion (+30) x${objBagItems.potion}</button>
      <button id="btnUseSuper"  class="btn btn-success btn-sm" ${objBagItems.superPotion<=0?"disabled":""}>Super Potion (+60) x${objBagItems.superPotion}</button>
    </div>
  `;
  const btnUsePotion = document.querySelector("#btnUsePotion");
  const btnUseSuper  = document.querySelector("#btnUseSuper");

  if(btnUsePotion) btnUsePotion.addEventListener("click", () => {
    if(objBagItems.potion<=0) return;
    objBagItems.potion--;
    const objP = arrPlayerTeam[numPlayerIndex];
    objP.hp = Math.min(objP.maxHp, objP.hp + 30);
    fnLog(`${objP.name} restored 30 HP.`);
    fnRenderActiveUI();
    elActionPanel.innerHTML = "";
    fnOpponentAfterCooldown();
  });
  if(btnUseSuper) btnUseSuper.addEventListener("click", () => {
    if(objBagItems.superPotion<=0) return;
    objBagItems.superPotion--;
    const objP = arrPlayerTeam[numPlayerIndex];
    objP.hp = Math.min(objP.maxHp, objP.hp + 60);
    fnLog(`${objP.name} restored 60 HP.`);
    fnRenderActiveUI();
    elActionPanel.innerHTML = "";
    fnOpponentAfterCooldown();
  });
}
function fnHandleRun(){
  elSectionBattle.classList.add("hidden");
  elSectionLose.classList.remove("hidden");
  fnLog("Game Over. You ran away.");
  boolGameActive = false;
}

/* Prev/Next buttons for quick switching that costs your turn */
btnPrevActive.addEventListener("click", () => {
  if(!boolGameActive || boolBusyTurn) return;
  let numIdx = numPlayerIndex;
  for(let k=0;k<arrPlayerTeam.length;k++){
    numIdx = (numIdx - 1 + arrPlayerTeam.length) % arrPlayerTeam.length;
    if(arrPlayerTeam[numIdx].alive) { fnSwitchTo(numIdx); break; }
  }
});
btnNextActive.addEventListener("click", () => {
  if(!boolGameActive || boolBusyTurn) return;
  let numIdx = numPlayerIndex;
  for(let k=0;k<arrPlayerTeam.length;k++){
    numIdx = (numIdx + 1) % arrPlayerTeam.length;
    if(arrPlayerTeam[numIdx].alive) { fnSwitchTo(numIdx); break; }
  }
});

/* Switch helper (uses your turn) */
function fnSwitchTo(numNewIndex){
  if(!boolGameActive || boolBusyTurn) return;
  const objTarget = arrPlayerTeam[numNewIndex];
  if(!objTarget || !objTarget.alive) return;

  numPlayerIndex = numNewIndex;
  fnRenderActiveUI();
  fnLog(`You switched to ${arrPlayerTeam[numPlayerIndex].name}.`);
  fnOpponentAfterCooldown();
}

/* Attack → then opponent acts after 1s */
function fnDoPlayerAttack(numMoveIndex){
  if(!boolGameActive || boolBusyTurn) return;

  const objP = arrPlayerTeam[numPlayerIndex];
  const objO = arrOpponentTeam[numOpponentIndex];
  const objMove = objP.moves[numMoveIndex];

  const numHit = fnDamage(objMove.power);
  objO.hp = Math.max(0, objO.hp - numHit);
  fnRenderActiveUI();
  fnLog(`${objP.name} used ${objMove.name} (-${numHit} HP on ${objO.name})`);

  if(objO.hp <= 0){
    objO.alive = false;
    const numNext = fnNextAliveIndex(arrOpponentTeam);
    if(numNext === -1){ fnShowWinScreen(); return; }
    numOpponentIndex = numNext;
    fnRenderActiveUI();
  }

  fnOpponentAfterCooldown();
}

/* Opponent acts after cooldown */
function fnOpponentAfterCooldown(){
  boolBusyTurn = true;
  fnSetActionsEnabled(false);
  fnShowCooldown(true);

  if(timerOpponent) clearTimeout(timerOpponent);
  timerOpponent = setTimeout(() => {
    fnDoOpponentTurn();
    boolBusyTurn = false;
    fnSetActionsEnabled(true);
    fnShowCooldown(false);
  }, numCooldownMs);
}

/* Opponent move: simple random */
function fnDoOpponentTurn(){
  if(!boolGameActive) return;
  const objP = arrPlayerTeam[numPlayerIndex];
  const objO = arrOpponentTeam[numOpponentIndex];
  const objMove = objO.moves[Math.floor(Math.random()*objO.moves.length)];

  const numHit = fnDamage(objMove.power);
  objP.hp = Math.max(0, objP.hp - numHit);
  fnRenderActiveUI();
  fnLog(`${objO.name} used ${objMove.name} (-${numHit} HP on ${objP.name})`);

  if(objP.hp <= 0){
    objP.alive = false;
    const numNext = fnNextAliveIndex(arrPlayerTeam);
    if(numNext === -1){ fnShowLoseScreen(); return; }
    numPlayerIndex = numNext;
    fnRenderActiveUI();
  }
}

/* Win / Lose screens */
function fnShowWinScreen(){
  boolGameActive = false;
  elSectionBattle.classList.add("hidden");
  const elGallery = document.querySelector("#winTeamGallery");
  elGallery.innerHTML = arrPlayerTeam.map(p => `
    <div class="col-4 col-md-3">
      <div class="card text-center">
        <div class="ratio ratio-1x1 bg-light">
          <img src="${p.img}" alt="${p.name}" class="card-img-top p-2">
        </div>
        <div class="card-body p-2">
          <div class="small text-capitalize fw-semibold">${p.name}</div>
        </div>
      </div>
    </div>
  `).join("");
  elSectionWin.classList.remove("hidden");
}
function fnShowLoseScreen(){
  boolGameActive = false;
  elSectionBattle.classList.add("hidden");
  elSectionLose.classList.remove("hidden");
}

/* Action buttons */
btnFight.addEventListener("click", () => { if(boolGameActive && !boolBusyTurn) fnOpenFightPanel(); });
btnSwitch.addEventListener("click", () => { if(boolGameActive && !boolBusyTurn) fnOpenSwitchPanel(); });
btnBag.addEventListener("click", () => { if(boolGameActive && !boolBusyTurn) fnOpenBagPanel(); });
btnRun.addEventListener("click",  fnHandleRun);

/* Play Again → reset to selection */
document.querySelector("#btnPlayAgainWin").addEventListener("click", fnResetToSelection);
document.querySelector("#btnPlayAgainLose").addEventListener("click", fnResetToSelection);

async function fnResetToSelection(){
  arrPlayerTeam = [];
  arrOpponentTeam = [];
  arrPlayerChosenIds = [];
  numChosenCount = 0;
  numPlayerIndex = 0;
  numOpponentIndex = 0;
  boolGameActive = false;
  boolBusyTurn = false;
  objBagItems = { potion: 3, superPotion: 1 };
  if(timerOpponent){ clearTimeout(timerOpponent); timerOpponent = null; }

  document.querySelector("#selectedPokemonsID").textContent = "—";
  elPreviewPlayer.innerHTML = "";
  elPreviewOpponent.innerHTML = "";
  elActionPanel.innerHTML = "";
  elBattleLog.textContent = "Choose: Fight or Run.";

  elSectionWin.classList.add("hidden");
  elSectionLose.classList.add("hidden");
  elSectionSelection.classList.remove("hidden");

  arrSelectButtons.forEach(b => b.disabled = false);
  await fnLoadStarterButtons();
}
