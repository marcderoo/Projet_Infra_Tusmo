/** Importer le logo des nouilles */
appUtils.loadObj("/static/noodles.png", true).then((res) => {
    appUtils.doIfOrWhen("DOMContentLoaded", () => {
        document.querySelector('img.noodles').src = res;
    });
})

/**Empecher le zoom par double tap sur iphone */
let lastTouchEnd = 0;

document.addEventListener('touchend', (event) => {
    const now = new Date().getTime();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault(); // Empêche le zoom par double tap
    }
    lastTouchEnd = now;
});

const confetti = new Confetti();

let NBLETTERS = real_word.length;
const NBTRY = 6;
const GRIDGAP = 0.5;
const MAXLETTERS = 9;
let FIRSTLETTER = real_word[0];

let dico = [];

let confirmed = false;
let end = false;
let validLetters = [];
let stateLetters = {};
let history = [];

const anecdotes = [
    '"Motus" a été créé par Thierry Beccaro, le célèbre animateur français. L’émission a été lancée en 1990 et a rencontré un grand succès grâce à son concept à la fois simple et stimulant. L’émission a duré plusieurs années, avec des saisons ponctuées de rebondissements et de surprises.',
    "Le concept de \"Motus\" est inspiré de celui du jeu de société Mastermind, où il faut deviner un code de couleurs. Dans \"Motus\", le défi est de deviner un mot de 5 ou 6 lettres en un nombre limité d'essais",
    'Au-delà de l’aspect télévisé, "Motus" est un jeu populaire dans les foyers français, avec des versions adaptées pour les jeux de société. Les familles adorent se défier en devinant des mots, et cela a renforcé la popularité du programme en dehors du petit écran.',
    "La plus grosse cagnotte de l'histoire de \"Motus\" est de 17 600 €7 (soit 22 émissions sans une Super partie gagnée)."
]
let def =  anecdotes[Math.floor(Math.random() * anecdotes.length)];

fetch(`def/${real_word.toLowerCase()}`)
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.text();
  })
  .then(data => {
    if(data != "err"){
        def = `${real_word.charAt(0).toUpperCase() + real_word.slice(1).toLowerCase()} : ${data.toLowerCase()}`;
    }
  })

  appUtils.loadObj(`dico/${FIRSTLETTER}_${NBLETTERS}.txt`)
  .then(data => {
    dico = data.replaceAll("\r", "").split("\n");
    console.log(dico);
    appUtils.emit('dicoLoad');
  })
  .catch(error => {
    console.error('There was a problem with the fetch operation:', error);
  });

function addLetter(letter, state, pos, countRes){//2 valid, 1 good, 0 unvalid
    if(!Object.keys(stateLetters).includes(letter)){
        stateLetters[letter] = {
            count : 0,
            posValid : new Set(),
            posGood : new Set(),
            notMore : false
        }
    }

    stateLetters[letter].count = Math.max(stateLetters[letter].count, isNaN(countRes) ? 0 : countRes);
    
    switch(state) {
        case 2:
            stateLetters[letter].posValid.add(pos);
            break;
        case 1:
            stateLetters[letter].posGood.add(pos);
            break;
        case 0:
            stateLetters[letter].notMore = true;
            break;
    }
}

function verify(written_word){
    let res = []

    dic_real_word = real_word.split('').reduce((acc, char) => {
        acc[char] = (acc[char] || 0) + 1;
        return acc;
      }, {});

    for(let i = 0; i < written_word.length; i++){
        if(written_word[i] == real_word[i]){
            res.push(2);
            dic_real_word[real_word[i]] -= 1;
        } else {
            res.push(0);
        }
    }
    for(let i = 0; i < written_word.length; i++){
        if(res[i] == 0 && written_word[i] in dic_real_word && dic_real_word[written_word[i]] > 0){
            res[i] = 1;
            dic_real_word[written_word[i]] -= 1;
        }
    }
    return res;
}

appUtils.subscribe('DOMContentLoaded', () => {
    appUtils.addRule("setGridSize", 
        `.grid-container {
            grid-template-columns: repeat(${NBLETTERS}, 1fr); /* 7 colonnes égales */
            grid-template-rows: repeat(${NBTRY}, 1fr);   /* 6 lignes égales */
            height: min(100%, calc(${NBTRY / NBLETTERS} * (100vw - 20px))); /* Occupe la hauteur définie par la grille (ou moins si la largeur dépasse)*/
        }`
    );

    // Sélection du conteneur de la grille
    const container = document.querySelector('.grid-container');

    let lastCell = null;
  
    // Générer les NBLETTERS x NBTRY cellules
    for (let i = 0; i < NBLETTERS * NBTRY; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      if (i === 0){
        cell.innerHTML = FIRSTLETTER;
        cell.classList.add((PLAYERTURN === 0 || PLAYERTURN == -1) ? "player-cell" : "ia-cell");
        validLetters.push(FIRSTLETTER);
        addLetter(FIRSTLETTER, 2, 0, 1);
      } else if (i < NBLETTERS) {
        validLetters.push(false);
      }
      container.appendChild(cell);
      lastCell = cell;
    }

    /** Manage font and border size for cell */
    appUtils.linkRuleTo("UpdateCellsFontBorder", "cellResize", () => {
        const cellWidth = lastCell.offsetWidth; // Largeur du conteneur
        const fontSize = cellWidth * 3 / 8;
        const borderWidth = cellWidth * 1 / 20;

        return `.cell {
            font-size : ${fontSize}px;
            border-width: ${borderWidth}px;
        }`
    });

    /** Manage help container height */
    appUtils.linkRuleTo("UpdateHelpContainerHeight", "cellResize", () => {
        // Récupère la position de l'élément
        const rect = container.getBoundingClientRect();

        return `.help-container {
            top : ${rect.top}px;
            height : ${rect.bottom - rect.top}px;
        }`
    });

    const resizeObserverCell = new ResizeObserver(() => {
        appUtils.emit("cellResize");
    });
    resizeObserverCell.observe(lastCell);

    // Génération des lettres de l'alphabet
    const alphabetContainer = document.querySelector('.alphabet-grid');
    const azerty = [
        'AZERTYUIOP',
        'QSDFGHJKLM',
        '⌫WXCVBN✔'
    ];
    let lastCellAlphabet = null;

    azerty.forEach(row => {
        const rowContainer = document.createElement('div');
        rowContainer.classList.add('alphabet-row');

        row.split('').forEach(letter => {
            const letterCell = document.createElement('div');
            letterCell.classList.add('alphabet-cell');
            letterCell.textContent = letter;
            const rawLetter = letter == "✔" ? 'ENTER' : (letter == "⌫" ? 'BACKSPACE' : letter);
            letterCell.setAttribute('data-letter', rawLetter);
            letterCell.addEventListener("mousedown", () => appUtils.emit('keydown', rawLetter));
            letterCell.addEventListener("mouseleave", () => appUtils.emit('keyup', rawLetter));
            letterCell.addEventListener("mouseup", () => appUtils.emit('keyup', rawLetter));
            if(rawLetter != letter){
                letterCell.classList.add('special');
            }

            appUtils.subscribe('keydown', (key) => {
                if(key == rawLetter){
                    letterCell.classList.add('clicked');
                    setTimeout(() => appUtils.emit('keyup', key), 500);
                }
            })

            appUtils.subscribe('keyup', (key) => {
                if(key == rawLetter){
                    letterCell.classList.remove('clicked');
                }
            })

            rowContainer.appendChild(letterCell);
            lastCellAlphabet = letterCell;
        });

        alphabetContainer.appendChild(rowContainer);
    });

    appUtils.linkRuleTo("UpdateAlphabetCellsFontOutline", "alphabetCellResize", () => {
        const cellWidth = lastCellAlphabet.offsetWidth; // Largeur du conteneur
        const fontSize = cellWidth * 3 / 8; 
        const outlineWidth = cellWidth * 1 / 20;

        return `.alphabet-cell {
            font-size : ${fontSize}px;
            outline-width: ${outlineWidth}px;
        }`
    });

    appUtils.linkRuleTo("UpdateAlphabetCellsSpecialFont", "alphabetCellResize", () => {
        const cellWidth = lastCellAlphabet.offsetWidth; // Largeur du conteneur
        const fontSize = cellWidth * 5 / 8;

        return `.alphabet-cell.special {
            font-size : ${fontSize}px
        }`
    });

    appUtils.linkRuleTo("UpdateHelpersWidth", "alphabetCellResize", () => {
        return `@media (max-width: calc(9 / 6 *  3 * (23vh - 4px  -  0.375rem) - 2vh + 20px + 6vw + 10em)) {
            .help-container {
                width : ${alphabetContainer.offsetWidth}px !important;
            }
        }`
    });

    const resizeObserverAlphabetCell = new ResizeObserver(() => {
        appUtils.emit("alphabetCellResize");
    });
    resizeObserverAlphabetCell.observe(lastCellAlphabet);
});

async function processKeys(data, player = 1) {
    const range = 300;
    const min = 50;

    const func = (x) => (x + 1) * (x - data.length);

    const norm = (i) => min + range / (func(0) - func(Math.floor(data.length / 2))) * (func(i) - func(Math.floor(data.length / 2)));

    let cancel = false; //Add canclation flag for avoid multiple process Key;
    appUtils.subscribe("cancelProcessKey", () => cancel = true);
    
    for (let i = 0; i < data.length; i++) {
        enterKey("BACKSPACE", player);
    }

    for (let i = 0; i < data.length; i++) {
        if(cancel) return;
        enterKey(data.charAt(i), player);
        if(i !== data.length - 1) await new Promise(resolve => setTimeout(resolve, norm(i))); // Pause de norm(i) ms entre les appels
    }
    if(player === 1) enterKey("ENTER", 1);
}

const enterKey = function(key, player = -1) {// Player 0 : humain, player 1 : ia
    const cells = Array.from(document.querySelectorAll("div.cell"));
    let cellBeforeFirstEmptyCellOrPlaceHolder = { cell : cells[cells.length - 1], index : cells.length - 1 };
    let cellBeforeFirstEmptyCell = { cell : cells[cells.length - 1], index : cells.length - 1 };
    let found = false;
    for (let i = 0; i < cells.length; i++) {
        if ((cells[i].innerHTML == "" || cells[i].classList.contains("placeholder")) && !found) {
            cellBeforeFirstEmptyCellOrPlaceHolder = { cell: cells[i - 1], index: i - 1 };
            found = true;
        }
        
        if (cells[i].innerHTML == ""){
            cellBeforeFirstEmptyCell = { cell: cells[i - 1], index: i - 1 };
            break;
        }
    }

    if(!end){
        if (key.length === 1 && /[a-zA-Z]/.test(key)) {
            if((cellBeforeFirstEmptyCellOrPlaceHolder.index + 1) % NBLETTERS !== 0 || confirmed){
                if(cellBeforeFirstEmptyCellOrPlaceHolder.index % NBLETTERS !== 0 || cells[cellBeforeFirstEmptyCellOrPlaceHolder.index].innerHTML !== key.toUpperCase()){
                    if(cells[cellBeforeFirstEmptyCellOrPlaceHolder.index + 1].innerHTML != key.toUpperCase()){
                        cells[cellBeforeFirstEmptyCellOrPlaceHolder.index + 1].classList.remove("valid");
                    }

                    cells[cellBeforeFirstEmptyCellOrPlaceHolder.index + 1].classList.remove("placeholder");
                    cells[cellBeforeFirstEmptyCellOrPlaceHolder.index + 1].innerHTML = key.toUpperCase();
                    if(player == 0 || player == -1){
                        cells[cellBeforeFirstEmptyCellOrPlaceHolder.index + 1].classList.add("player-cell");
                    } else if (player == 1){
                        cells[cellBeforeFirstEmptyCellOrPlaceHolder.index + 1].classList.add("ia-cell");
                        cells[cellBeforeFirstEmptyCellOrPlaceHolder.index + 1 - ((cellBeforeFirstEmptyCellOrPlaceHolder.index + 1) % NBLETTERS)].classList.remove("ia-cell-blinking");
                    }
                    confirmed = false;
                }
            }
        } else if (key == "BACKSPACE"){
            if (cellBeforeFirstEmptyCellOrPlaceHolder && cellBeforeFirstEmptyCellOrPlaceHolder.index % NBLETTERS !== 0) {
                if(validLetters[cellBeforeFirstEmptyCellOrPlaceHolder.index % NBLETTERS]){
                    cells[cellBeforeFirstEmptyCellOrPlaceHolder.index].innerHTML = validLetters[cellBeforeFirstEmptyCellOrPlaceHolder.index % NBLETTERS];
                    cells[cellBeforeFirstEmptyCellOrPlaceHolder.index].classList.add("valid");
                    cells[cellBeforeFirstEmptyCellOrPlaceHolder.index].classList.add("placeholder");
                } else {
                    cells[cellBeforeFirstEmptyCellOrPlaceHolder.index].innerHTML = "";
                }
                cells[cellBeforeFirstEmptyCellOrPlaceHolder.index].classList.remove("player-cell");
                cells[cellBeforeFirstEmptyCellOrPlaceHolder.index].classList.remove("ia-cell");
            }
        } else if (key == "ENTER"){
            if ((cellBeforeFirstEmptyCell.index + 1) % NBLETTERS === 0) {
                const word = cells.slice(cellBeforeFirstEmptyCell.index + 1 - NBLETTERS, cellBeforeFirstEmptyCell.index + 1).map(cell => cell.innerHTML).join("");
                if(dico.includes(word.toLowerCase())){
                  history.push(word.toLowerCase());
                  const res = verify(word);
                  let resLettersCount = {};
                  for(let i = 0; i < res.length; i++){
                    if(res[i] == 2 || res[i] == 1){
                        resLettersCount[word[i]] = Object.keys(resLettersCount).includes(word[i]) ? resLettersCount[word[i]] + 1 : 1;
                    }
                  }
                  for(let i = 0; i < res.length; i++){
                      cells[cellBeforeFirstEmptyCell.index + 1 - NBLETTERS + i].classList.add(player == 1 ? "ia-cell" : "player-cell");//Add border to all cells

                      cells[cellBeforeFirstEmptyCell.index + 1 - NBLETTERS + i].classList.remove("placeholder");

                      addLetter(cells[cellBeforeFirstEmptyCell.index + 1 - NBLETTERS + i].innerHTML, res[i], i, resLettersCount[cells[cellBeforeFirstEmptyCell.index + 1 - NBLETTERS + i].innerHTML]);

                      const alphabetLetter = document.querySelector(`div.alphabet-cell[data-letter="${cells[cellBeforeFirstEmptyCell.index + 1 - NBLETTERS + i].innerHTML}"`);
                      if(res[i] == 2){
                        validLetters[i] = cells[cellBeforeFirstEmptyCell.index + 1 - NBLETTERS + i].innerHTML;
                        alphabetLetter.classList.remove("good");
                        alphabetLetter.classList.add("valid");
                        cells[cellBeforeFirstEmptyCell.index + 1 - NBLETTERS + i].classList.add("valid");
                      }
                      else if (res[i] == 1){
                        if(!alphabetLetter.classList.contains("valid")) alphabetLetter.classList.add("good");
                        cells[cellBeforeFirstEmptyCell.index + 1 - NBLETTERS + i].classList.add("good");
                      }
                      if (res[i] == 0){
                        if(!alphabetLetter.classList.contains("valid")  && !alphabetLetter.classList.contains("good")) alphabetLetter.classList.add("unvalid");
                        cells[cellBeforeFirstEmptyCell.index + 1 - NBLETTERS + i].classList.add("unvalid");
                      }
                  }

                  const unvalidLeft = ["A",  "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",  "N",  "O", "P",  "Q",  "R", "S", "T", "U",  "V", "W", "X", "Y",  "Z"]
                  .filter((letter)  => {
                      let res = Object.keys(stateLetters).includes(letter) && stateLetters[letter].count == 0 && stateLetters[letter].notMore; // Lettre déjà affiché comme mauvaise
                      res ||= real_word.includes(letter); // Lettre bonne
                      return !res;
                  });
              
                  if(unvalidLeft.length == 0){
                      const elmt = document.getElementById("helpLetterM");
                      elmt.classList.add("unclickable");
                      elmt.removeAttribute("onclick");
                  }

                  confirmed = true;
                  if(res.every(e => e === 2)){
                      end = true;
                      confetti.launch();
                      
                      count += 1;
                      const attemps = Math.floor(cellBeforeFirstEmptyCell.index / NBLETTERS);
                      score += (PLAYERTURN === -1 || attemps % 2 === PLAYERTURN) ? 100 - attemps * 10 : 0;

                      const dialog = document.createElement("dialog");
                      dialog.innerHTML = `<h2 style="margin-top: 0px;">Le saviez-vous ?</h2>
                        ${def}<br><br>
                        <div class="
                            next-button
                        " onclick=document.getElementById("form-end").submit()>Mot Suivant <span style="
                            border-style: solid;
                            border-width: 0.25em 0.25em 0 0;
                            content: '';
                            display: inline-block;
                            height: 0.45em;
                            position: relative;
                            top: 0.20em;
                            transform: rotate(45deg);
                            vertical-align: top;
                            width: 0.45em;
                            left: 0em;
                        "></span></div><br><br>`

                      document.body.appendChild(dialog);

                      dialog.showModal();

                        const form = document.createElement('form');
                        form.method = 'POST';
                        form.id = 'form-end';
                        form.action = window.location.href;
                        form.hidden = true;

                        const countInput = document.createElement('input');
                        countInput.type = 'hidden';
                        countInput.name = 'count';
                        countInput.id = 'count';
                        countInput.value = count; 

                        const scoreInput = document.createElement('input');
                        scoreInput.type = 'hidden';
                        scoreInput.name = 'score';
                        scoreInput.id = 'score';
                        scoreInput.value = score; 

                        form.appendChild(countInput);
                        form.appendChild(scoreInput);

                        document.body.appendChild(form);

                        appUtils.subscribe('keydown', function(key) {
                            if(key == "ENTER"){
                                form.submit();
                            }
                        })

                  } else {
                    if(cellBeforeFirstEmptyCell.index !== cells.length - 1){
                        for(let i = 0; i < res.length; i++){
                            if(validLetters[i]){
                                cells[cellBeforeFirstEmptyCell.index + 1 + i].innerHTML = validLetters[i];
                                cells[cellBeforeFirstEmptyCell.index + 1 + i].classList.add("valid");
                                cells[cellBeforeFirstEmptyCell.index + 1 + i].classList.add("placeholder");
                            }                                          
                        }
                        cells[cellBeforeFirstEmptyCell.index + 1].classList.remove("placeholder");
                        if(player == 1 || player == -1){
                            cells[cellBeforeFirstEmptyCell.index + 1].classList.add("player-cell");
                        } else if (player == 0) {
                            cells[cellBeforeFirstEmptyCell.index + 1].classList.add("ia-cell");
                            cells[cellBeforeFirstEmptyCell.index + 1].classList.add("ia-cell-blinking");
                        }
                    } else {/* Looser Scren*/
                        end = true;
                        
                        count += 1;
  
                        const dialog = document.createElement("dialog");
                        dialog.innerHTML = `Dommage 😢, la réponse était : ${real_word} ...<br><br><h2 style="margin-top: 0px;">Le saviez-vous ?</h2>
                          ${def}<br><br>
                          <div class="
                              next-button
                          " onclick=document.getElementById("form-end").submit()>Mot Suivant <span style="
                              border-style: solid;
                              border-width: 0.25em 0.25em 0 0;
                              content: '';
                              display: inline-block;
                              height: 0.45em;
                              position: relative;
                              top: 0.20em;
                              transform: rotate(45deg);
                              vertical-align: top;
                              width: 0.45em;
                              left: 0em;
                          "></span></div><br><br>`
  
                        document.body.appendChild(dialog);
  
                        dialog.showModal();
  
                          const form = document.createElement('form');
                          form.method = 'POST';
                          form.id = 'form-end';
                          form.action = window.location.href;
                          form.hidden = true;
  
                          const countInput = document.createElement('input');
                          countInput.type = 'hidden';
                          countInput.name = 'count';
                          countInput.id = 'count';
                          countInput.value = count; 
  
                          const scoreInput = document.createElement('input');
                          scoreInput.type = 'hidden';
                          scoreInput.name = 'score';
                          scoreInput.id = 'score';
                          scoreInput.value = score; 
  
                          form.appendChild(countInput);
                          form.appendChild(scoreInput);
  
                          document.body.appendChild(form);
  
                          appUtils.subscribe('keydown', function(key) {
                              if(key == "ENTER"){
                                  form.submit();
                              }
                          })                        
                    }
                  }
                } else {
                  cells.slice(cellBeforeFirstEmptyCell.index + 1 - NBLETTERS, cellBeforeFirstEmptyCell.index + 1).forEach(elmt => elmt.classList.add("uncorrect"));
                  end = true;
                  setTimeout(function(){
                    for(let i = 0; i < NBLETTERS; i++){
                        cells[cellBeforeFirstEmptyCell.index + 1 - NBLETTERS + i].classList.remove("uncorrect");
                        cells[cellBeforeFirstEmptyCell.index + 1 - NBLETTERS + i].innerHTML = "";

                        if(validLetters[i]){
                            cells[cellBeforeFirstEmptyCell.index + 1 - NBLETTERS + i].innerHTML = validLetters[i];
                            cells[cellBeforeFirstEmptyCell.index + 1 - NBLETTERS + i].classList.add("valid");
                            cells[cellBeforeFirstEmptyCell.index + 1 - NBLETTERS + i].classList.add("placeholder"); 
                        }            
                        
                        if(i === 0){
                            cells[cellBeforeFirstEmptyCell.index + 1 - NBLETTERS].innerHTML = FIRSTLETTER;
                            cells[cellBeforeFirstEmptyCell.index + 1 - NBLETTERS].classList.remove("placeholder");
                        } else {
                            cells[cellBeforeFirstEmptyCell.index + 1 - NBLETTERS + i].classList.remove("player-cell");
                            cells[cellBeforeFirstEmptyCell.index + 1 - NBLETTERS + i].classList.remove("ia-cell");
                        }
                    }
                    


                    if(cellBeforeFirstEmptyCell.index + 1 - NBLETTERS !== 0){
                        cells[cellBeforeFirstEmptyCell.index + 1 - NBLETTERS].classList.add("valid"); 
                    } else {
                        cells[cellBeforeFirstEmptyCell.index + 1 - NBLETTERS].classList.remove("valid"); 
                    }
                    end = false;
                  }, 300);
                }
            }
        }
    }
}

/** Help buttons*/
appUtils.subscribe("helpIA", () => {
    let cells = Array.from(document.querySelectorAll("div.cell"));
    let cellBeforeFirstEmptyCellIdx = cells.length - 1;
    for (let i = 0; i < cells.length; i++) {
        if (cells[i].innerHTML == "") {
            cellBeforeFirstEmptyCellIdx = i - 1;
            break;
        }
    }

    if(PLAYERTURN === -1 || Math.floor(cellBeforeFirstEmptyCellIdx / NBLETTERS) % 2 === PLAYERTURN) {
        appUtils.emit("cancelProcessKey");

        fetch(`ia/3`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                len : NBLETTERS,
                firstLetter : FIRSTLETTER,
                validLetters : validLetters,
                stateLetters : Object.entries(stateLetters).reduce((acc, [key, value]) => {
                    acc[key] = {
                        ...value,
                        posValid: Array.from(value.posValid),
                        posGood: Array.from(value.posGood),
                    };
                    return acc;
                    }, {}
                ),
                history : history
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();
        })
        .then(word => {
            processKeys(word, 0);
        })
        .catch(error => {
            console.error('Erreur lors de la requête:', error);
        })
    }
})

appUtils.subscribe("helpLetterBP", () => { //Lettre bonne et bien placé
    let cells = Array.from(document.querySelectorAll("div.cell"));
    let cellBeforeFirstEmptyCellIdx = cells.length - 1;
    for (let i = 0; i < cells.length; i++) {
        if (cells[i].innerHTML == "") {
            cellBeforeFirstEmptyCellIdx = i - 1;
            break;
        }
    }

    if(PLAYERTURN === -1 || Math.floor(cellBeforeFirstEmptyCellIdx / NBLETTERS) % 2 === PLAYERTURN) {
        const idxFalse = validLetters.map((e, i) => e === false ? i : '').filter(String);

        if(idxFalse.length == 1){
            const elmt = document.getElementById("helpLetterBP");
            elmt.classList.add("unclickable");
            elmt.removeAttribute("onclick");
        }

        const idx = idxFalse[Math.floor(Math.random() * idxFalse.length)];
        const cellIdx = Math.floor(cellBeforeFirstEmptyCellIdx / NBLETTERS) * NBLETTERS + idx;

        validLetters[idx] = real_word[idx];

        if(!Object.keys(stateLetters).includes(real_word[idx])){
            stateLetters[real_word[idx]] = {
                count : 0,
                posValid : new Set(),
                posGood : new Set(),
                notMore : false
            }
        }
        const count = stateLetters[real_word[idx]].count > stateLetters[real_word[idx]].posValid.size ? stateLetters[real_word[idx]].count : stateLetters[real_word[idx]].count + 1;
        addLetter(real_word[idx], 2, idx, count);

        const cell = cells[cellIdx];
        cell.innerHTML = real_word[idx];
        cell.classList.add("valid");
        if(cellBeforeFirstEmptyCellIdx < cellIdx) cell.classList.add("placeholder");

        const alphabetLetter = document.querySelector(`div.alphabet-cell[data-letter="${real_word[idx]}"`);
        alphabetLetter.classList.remove("good");
        alphabetLetter.classList.add("valid");
    }
})

appUtils.subscribe("helpLetterM", () => { // Lettre mauvaise
    const possiblesLetters = ["A",  "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",  "N",  "O", "P",  "Q",  "R", "S", "T", "U",  "V", "W", "X", "Y",  "Z"]
    .filter((letter)  => {
        let res = Object.keys(stateLetters).includes(letter) && stateLetters[letter].count == 0 && stateLetters[letter].notMore; // Lettre déjà affiché comme mauvaise
        res ||= real_word.includes(letter); // Lettre bonne
        return !res;
    });

    if(possiblesLetters.length == 1){
        const elmt = document.getElementById("helpLetterM");
        elmt.classList.add("unclickable");
        elmt.removeAttribute("onclick");
    }

    const choosenLetter = possiblesLetters[Math.floor(Math.random() * possiblesLetters.length)];
    addLetter(choosenLetter, 0, 0, 0);
    
    const alphabetLetter = document.querySelector(`div.alphabet-cell[data-letter="${choosenLetter}"`);
    alphabetLetter.classList.add("unvalid");
})