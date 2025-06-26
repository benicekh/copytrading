const DEBUG = false;

if (!DEBUG) {
  console.log = function () {}; // Disable all console.log calls
}

let treatment;

treatment = parseInt(Qualtrics.SurveyEngine.getEmbeddedData("treatment"));

let pathseries;
pathseries = Qualtrics.SurveyEngine.getEmbeddedData("pathseries");

let pricePaths;
pricePaths = JSON.parse(Qualtrics.SurveyEngine.getEmbeddedData("pricepaths"));
const pricePathsCRRA = {};
pricePathsCRRA.Elicitation = [
  250.0, 265.0, 255.0, 240.0, 235.0, 230.0, 235.0, 240.0, 255.0, 245.0, 255.0,
  265.0, 275.0, 290.0, 300.0, 285.0, 300.0, 290.0, 280.0, 275.0, 260.0, 245.0,
  260.0, 255.0, 240.0, 230.0, 215.0, 200.0, 205.0, 190.0, 205.0, 210.0, 200.0,
  195.0, 185.0, 175.0, 165.0, 155.0, 150.0, 145.0, 140.0, 125.0, 140.0, 150.0,
  155.0, 165.0, 175.0, 180.0, 190.0, 200.0, 205.0,
];

let dataTraining;
dataTraining = JSON.parse(
  Qualtrics.SurveyEngine.getEmbeddedData("dataTraining")
);
let data;
data = JSON.parse(Qualtrics.SurveyEngine.getEmbeddedData("botdata"));
let followersTreatment;
followersTreatment = parseInt(
  Qualtrics.SurveyEngine.getEmbeddedData("followersTreatment")
);
let TLs;
TLs = JSON.parse(Qualtrics.SurveyEngine.getEmbeddedData("TLs"));

// Function to toggle column visibility and adjust colspan
function toggleColumnBasedOnTreatment() {
  const columns = document.querySelectorAll(".toggle-column");
  const topPerformersCell = document.getElementById("table_TOPPERFORMERS");

  if (followersTreatment === 0) {
    columns.forEach((column) => column.classList.add("hidden"));
    topPerformersCell.setAttribute("colspan", "7");
  } else {
    columns.forEach((column) => column.classList.remove("hidden"));
    topPerformersCell.setAttribute("colspan", "8");
  }
}

// Call the function to apply the initial state
toggleColumnBasedOnTreatment();

let nameTreatment;
nameTreatment = parseInt(
  Qualtrics.SurveyEngine.getEmbeddedData("nameTreatment")
);

let inertiaTreatment;

inertiaTreatment = parseInt(
  Qualtrics.SurveyEngine.getEmbeddedData("inertiaTreatment")
);

console.log(data["stage_0"]["round_0"]);

//document.getElementById("copydata").classList.add("hidden");

document.getElementById("rounddata").classList.add("hidden");

document.getElementById("chartdiv").classList.add("hidden");

document.getElementById("chartwrap").classList.add("hidden");

document.getElementById("copydata").classList.add("hidden");

// Initialize Variables

/// Price Path Version

let pathVersion;

let pathPrice;

let path;

let copiedTL = null;

/// Phase played 0 - training, rest decisions

let phase = 0;

/// max phases

let maxPhases;

/// random price path or fixed order

const randompath = 0;

//// Starting Round data

var roundDataStart = {
  price: 250, //Price of the asset
  cash: 2500, //Cash amount
  asset: 0, // assets held
  round: 0, // current round
  portfolio: 0, // unrealised asset value
  rankingClicks: [], // use of buttons in ranking
  plotClicks: [], // use of buttons to see strategy
};

var roundDataPersistent = {
  gain: 0, // total cash gain all phases

  endowments: 0, // total endowments so far for returns calculation

  return: 0, // total return all phases
};

//// Round data\

var roundData = {
  price: roundDataStart.price, //Price of the asset
  cash: roundDataStart.cash, //Cash amount
  asset: roundDataStart.asset, // assets held
  round: roundDataStart.round, // current round
  portfolio: roundDataStart.portfolio, // unrealised asset value
  rankingClicks: roundDataStart.rankingClicks, // use of buttons in ranking
  plotClicks: roundDataStart.plotClicks, // use of buttons to see strategy
  next: 0, // count of button use
  previous: 0,
};

//// Next Round data

var roundDataNew = roundData;

/// Rounds/stage

const trainingrounds = 5;

var rounds = 41;
if (treatment == 1) {
  rounds = 51;
}
var currentround = roundDataStart.round;
/// Stages object Training/Treatment
const Stages = [
  { stage: "training", rounds: trainingrounds },
  { stage: "regular", rounds: rounds },
];

/// Function to randomly pick price path

//// set pathPrice to relevant chosen price path array

// Random integer

const getRandomInt = function (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/// Calculate Bayesian Updating
function calculateIncreaseProbs(
  P_list,
  ch = 0.15,
  omega = 1,
  gamma = 1,
  q = 0.15
) {
  const increase_probs = [];

  // Helper: Bayesian update
  function p_hat(p, z, omega, ch) {
    const num = Math.pow(0.5 + ch, z) * Math.pow(0.5 - ch, 1 - z) * p;
    const denom =
      num + Math.pow(0.5 - ch, z) * Math.pow(0.5 + ch, 1 - z) * (1 - p);
    return num / denom;
  }

  function p_update(p, z, omega, gamma, ch) {
    const prob = p_hat(p, z, omega, ch);
    const change = q * gamma;
    return (1 - change) * prob + change * (1 - prob);
  }

  // Process each block of 40 separately
  for (let start = 0; start < P_list.length; start += 41) {
    const end = Math.min(start + 40, P_list.length);
    const block = P_list.slice(start, end);
    let p = 0.5;
    let up;
    const block_probs = [parseFloat(p.toFixed(4))]; // first element in block

    for (let i = 1; i < block.length; i++) {
      const z = block[i] > block[i - 1] ? 1 : 0;
      p = p_update(p, z, omega, gamma, ch); // this is only the probability of being in the good state, need to adjust for price increase
      block_probs.push(parseFloat(p.toFixed(4)));
    }

    increase_probs.push(...block_probs);
  }

  return increase_probs;
}

//// turn prob good state to prob price increase
function priceUp(p, ch) {
  let up;
  up = (8 * p * ch + 2 - 4 * ch) / 4;
  return up.toFixed(2);
}

/// Random or sequential picking of price path
const pathPicker = function () {
  const isCRRA = treatment == 1;
  const paths = isCRRA ? pricePathsCRRA : pricePaths;
  const keys = Object.keys(paths);
  const num = randompath === 1 ? getRandomInt(0, keys.length - 1) : 0;
  const pathKey = keys[num];

  const pathPrice = paths[pathKey];
  const pathProb = calculateIncreaseProbs(pathPrice);
  const pathVersion = pathKey;

  console.log("path:", pathKey);
  delete paths[pathKey];
  console.log("pricePaths:", paths);
  console.log("Current Path:", pathPrice);
  console.log("Current Prob:", pathProb);

  return pathPrice;
};

var randomProperty = function (obj) {
  var keys = Object.keys(obj);

  return obj[keys[(keys.length * Math.random()) << 0]];
};

//let test = randomProperty(pricePaths);
//console.log(test);

if (Stages[0].stage === "training") {
  pathPrice = [250, 245, 240, 230, 245];
  pathVersion = "training";
} else {
  pathPicker();
  console.log("It picks the new path");
}

//pathPrice = pricePaths[pathPicker()];
//console.log(pathPrice);

///// Current
var priceParameters = {
  price: roundData.stockPrice, //Price of the asset
  cash: roundData.cash, //Cash amount
};
///// Main data storage, to be passed to Qualtrics
var DATA = {};
DATA.rounds = [];
DATA.stagesummaries = [];

DATA.roundSeries = [];
DATA.priceSeries = [];
DATA.assetsSeries = [];
DATA.OngoingReturn = [];
const storeDataRound = function () {
  //Compile round data.
  var stage = Stages[0].stage;
  var realValue = roundData.asset * roundData.price;
  var portfolio = returnsCalc(roundData.portfolio, realValue);
  var ongoingReturn = returnsCalc(roundDataStart.cash, wealthCalc());
  DATA.roundSeries.push(roundData.round);
  DATA.priceSeries.push(roundData.price);
  DATA.assetsSeries.push(roundData.asset);
  DATA.OngoingReturn.push(parseInt(ongoingReturn));
  var x = {
    r: roundData.round,
    phase: Stages[0].stage,
    stg: phase,
    p: roundData.price,
    a: roundData.asset,
    c: roundData.cash,
    prob: roundData.prob,
    path: pathVersion,
    portfolio: portfolio,
    ongoingReturn: ongoingReturn,
    unrealized: roundData.portfolio,
    clicks: roundData.rankingClicks,
    plotclicks: roundData.plotClicks,
    next: roundData.next,
    previous: roundData.previous,
    treatment: treatment,
    pathseries: pathseries,
  };
  roundData.next = 0;
  roundData.previous = 0;

  //Save in array.
  DATA.rounds.push(x);
};

// References to screen elements
var SCREENELEMENTS = {
  //Subscreen elements
  round_title: document.getElementById("round_TITLE"),
  decision_screen: document.getElementById("round_DECISION"),
  copy_data_screen: document.getElementById("copydata"),
  instructions: document.getElementById("instructions"),
  instructions_nextbutton: document.getElementById("instruction_next"),
  instructions_text: document.getElementById("instruction_text"),
  /*   //Instruction elements
  instructions: document.getElementById("instructions"),
  instructions_text: document.getElementById("instructions_text"),
  instructions_button: document.getElementById("BUTTON_INSTRUCTIONS"), */

  //Decision screen elements
  decision_roundnum: document.getElementById("table_ROUNDNUM"),
  decision_price: document.getElementById("table_PRICE"),
  decision_positiontext: document.getElementById("table_POSITIONTEXT"),
  decision_positionvalue: document.getElementById("table_POSITIONVALUE"),
  decision_shares: document.getElementById("table_SHARES"),
  decision_buybutton: document.getElementById("table_BUTTON_BUY"),
  decision_sellbutton: document.getElementById("table_BUTTON_SELL"),
  decision_cash: document.getElementById("table_CASH"),
  decision_prob: document.getElementById("table_PROB"),
  decision_nextbutton: document.getElementById("BUTTON_DECISION"),
  decision_nextbutton_training: document.getElementById(
    "BUTTON_TRAINING_START"
  ),
  decision_nextbutton_show_info: document.getElementById("BUTTON_INFO_SHOW"),
  decision_shares_label: document.getElementById("label_SHARES"),
  decision_price_label: document.getElementById("label_PRICE"),
  decision_cash_label: document.getElementById("label_CASH"),
  decision_return_label: document.getElementById("label_RETURN"),
  decision_return: document.getElementById("table_RETURN"),
  copytable: document.getElementById("copytable"),

  //End of Round Screen
  eor: document.getElementById("table_ENDOFROUND"),
  eorwealth: document.getElementById("table_EORWEALTH"),
  eorcash: document.getElementById("table_EORCASH"),
  eorreturn: document.getElementById("table_EORRETURN"),
  eorcashall: document.getElementById("table_EORCASHALL"),
  eorreturnall: document.getElementById("table_EORRETURNALL"),
  eorwealthall: document.getElementById("table_EORWEALTHALL"),
  // Player list
  copytable_header: document.getElementById("table_TOPPERFORMERS"),
  rank1: document.getElementById("table_RANK1"),
  player1: document.getElementById("table_PLAYER1"),
  wealth1: document.getElementById("table_PLAYER1_WEALTH"),

  return1: document.getElementById("table_PLAYER1_RETURN"),
  wealthall1: document.getElementById("table_PLAYER1_WEALTHALL"),

  retall1: document.getElementById("table_PLAYER1_RETALL"),
  copiers1: document.getElementById("table_PLAYER1_COPIERS"),
  rank2: document.getElementById("table_RANK2"),
  player2: document.getElementById("table_PLAYER2"),
  wealth2: document.getElementById("table_PLAYER2_WEALTH"),

  return2: document.getElementById("table_PLAYER2_RETURN"),
  wealthall2: document.getElementById("table_PLAYER2_WEALTHALL"),

  retall2: document.getElementById("table_PLAYER2_RETALL"),
  copiers2: document.getElementById("table_PLAYER2_COPIERS"),
  rank3: document.getElementById("table_RANK3"),
  player3: document.getElementById("table_PLAYER3"),
  wealth3: document.getElementById("table_PLAYER3_WEALTH"),

  return3: document.getElementById("table_PLAYER3_RETURN"),
  wealthall3: document.getElementById("table_PLAYER3_WEALTHALL"),

  retall3: document.getElementById("table_PLAYER3_RETALL"),
  copiers3: document.getElementById("table_PLAYER3_COPIERS"),
  rank4: document.getElementById("table_RANK4"),
  player4: document.getElementById("table_PLAYER4"),
  wealth4: document.getElementById("table_PLAYER4_WEALTH"),

  return4: document.getElementById("table_PLAYER4_RETURN"),
  wealthall4: document.getElementById("table_PLAYER4_WEALTHALL"),

  retall4: document.getElementById("table_PLAYER4_RETALL"),
  copiers4: document.getElementById("table_PLAYER4_COPIERS"),
  rank5: document.getElementById("table_RANK5"),
  player5: document.getElementById("table_PLAYER5"),
  wealth5: document.getElementById("table_PLAYER5_WEALTH"),

  return5: document.getElementById("table_PLAYER5_RETURN"),
  wealthall5: document.getElementById("table_PLAYER5_WEALTHALL"),

  retall5: document.getElementById("table_PLAYER5_RETALL"),
  copiers5: document.getElementById("table_PLAYER5_COPIERS"),
  copy_button1: document.getElementById("BUTTON_COPY_1"),
  copy_button2: document.getElementById("BUTTON_COPY_2"),
  copy_button3: document.getElementById("BUTTON_COPY_3"),
  copy_button4: document.getElementById("BUTTON_COPY_4"),
  copy_button5: document.getElementById("BUTTON_COPY_5"),
  copy_next: document.getElementById("BUTTON_BROWSE_NEXT"),
  copy_prev: document.getElementById("BUTTON_BROWSE_PREV"),

  hide_copy: document.getElementById("BUTTON_DECISION_HIDE"),

  // Copy request line
  copy_request: document.getElementById("copyRequest"),
};

// Debug mode hide elements
const hideElement = function (element) {
  element.classList.toggle("hidden");
};

// for testing purposes; comment next line out to reveal button
SCREENELEMENTS.hide_copy.classList.add("hidden");

SCREENELEMENTS.hide_copy.onclick = function () {
  hideElement(SCREENELEMENTS.copytable);
  if (SCREENELEMENTS.copytable.classList.contains("hidden")) {
    SCREENELEMENTS.hide_copy.textContent = "Show Copy Window";
  } else {
    SCREENELEMENTS.hide_copy.textContent = "Hide Copy Window";
  }
};

// Visuals Initialization
/// Hide Qualtrics next button
/// Set Variable screenelements to starting value
const initialize = function () {
  roundData.price = roundDataStart.price;
  roundData.prob = roundDataStart.prob;
  roundData.asset = roundDataStart.asset;
  roundData.cash = roundDataStart.cash;
  roundData.round = roundDataStart.round;
  roundData.portfolio = roundDataStart.portfolio;

  DATA.roundSeries = [];
  DATA.priceSeries = [];
  DATA.assetsSeries = [];
  DATA.OngoingReturn = [];
  SCREENELEMENTS.decision_sellbutton.classList.add("unavailable");
  SCREENELEMENTS.decision_nextbutton_show_info.classList.add("hidden");
  if (Stages[0].stage === "regular") {
    if (treatment === 1) {
      document.getElementById("rounddata").classList.remove("hidden");
      document.getElementById("chartwrap").classList.remove("hidden");
    }

    document.getElementById("chartdiv").classList.remove("hidden");
    //document.getElementById("chartwrap").classList.remove("hidden");
    //document.getElementById("copydata").classList.add("hidden");
    document.getElementById("resultdata").classList.add("hidden");
    SCREENELEMENTS.copytable_header.textContent = "Traders";
    SCREENELEMENTS.decision_nextbutton.classList.remove("hidden");
    SCREENELEMENTS.decision_nextbutton_training.classList.add("hidden");
  } else {
    SCREENELEMENTS.instructions.classList.remove("hidden");
    SCREENELEMENTS.decision_sellbutton.classList.add("unavailable");
    if (treatment === 3) {
      document.getElementById("rounddata").classList.add("hidden");
    }

    document.getElementById("chartdiv").classList.add("hidden");
    document.getElementById("chartwrap").classList.add("hidden");
    //document.getElementById("copydata").classList.add("hidden");
    document.getElementById("resultdata").classList.add("hidden");
    SCREENELEMENTS.decision_nextbutton.classList.add("hidden");
    SCREENELEMENTS.decision_nextbutton_training.classList.add("hidden");
    SCREENELEMENTS.copy_request.classList.add("hidden");
    //SCREENELEMENTS.copytable.classList.add("hidden");
    if (Stages[0].stage === "training") {
      SCREENELEMENTS.instructions_text.textContent =
        "The start button will initiate the training round that will allow you to familiarize yourself with the interface!";
    } else {
      SCREENELEMENTS.instructions_text.textContent =
        "Pressing the start button will begin the trading game!";
    }
  }
  if (treatment == 1) {
    SCREENELEMENTS.copy_data_screen.classList.add("hidden");
    SCREENELEMENTS.copy_request.classList.add("hidden");
  } else if (treatment == 2) {
    console.log(treatment);
    SCREENELEMENTS.copy_button1.classList.add("hidden");
    SCREENELEMENTS.copy_button2.classList.add("hidden");
    SCREENELEMENTS.copy_button3.classList.add("hidden");
    SCREENELEMENTS.copy_button4.classList.add("hidden");
    SCREENELEMENTS.copy_button5.classList.add("hidden");
    SCREENELEMENTS.copy_request.classList.add("hidden");
  } else {
    SCREENELEMENTS.decision_buybutton.classList.add("hidden");
    SCREENELEMENTS.decision_sellbutton.classList.add("hidden");
  }

  if (Stages[0].stage === "training" && roundData.round === 0) {
    maxpage =
      Math.ceil(Object.keys(dataTraining["stage_0"]["round_0"]).length / 5) - 1;
    console.log("maxpage:" + maxpage);
  } else {
    maxpage = Math.ceil(Object.keys(data["stage_0"]["round_0"]).length / 5) - 1;
    console.log("maxpage:" + maxpage);
  }
  page = 0;
  SCREENELEMENTS.copy_prev.classList.add("hidden");
  SCREENELEMENTS.copy_next.classList.remove("hidden");
  if (maxpage === 0) {
    SCREENELEMENTS.copy_next.classList.add("hidden");
  }
};

/// Update Screenelements
const update = function () {
  if (roundData.round !== Stages[0].rounds && treatment != 1) {
    copyMechanism(copiedTL, phase, roundData.round);
  }
  SCREENELEMENTS.decision_price.textContent = roundData.price;
  SCREENELEMENTS.decision_shares.textContent = roundData.asset;
  SCREENELEMENTS.decision_cash.textContent = roundData.cash;
  const probFormatted = priceUp(roundData.prob, 0.15);
  SCREENELEMENTS.decision_prob.innerHTML = isNaN(probFormatted)
    ? ""
    : `<b>${probFormatted}%</b>`;
  SCREENELEMENTS.decision_roundnum.textContent =
    "Period: " + (roundData.round + 1);
  if (roundData.round + 1 === Stages[0].rounds) {
    SCREENELEMENTS.decision_roundnum.textContent = "End of Phase";
  }
  var realValue = roundData.asset * roundData.price;
  //SCREENELEMENTS.decision_return.textContent =
  //  returnsCalc(roundData.portfolio, realValue) + "%";
  SCREENELEMENTS.decision_return.textContent = realValue + roundData.cash;
  if (roundData.price === 0) {
    SCREENELEMENTS.decision_buybutton.classList.add("unavailable");
  }
};

// Functions

/// Picking price path randomly

/// Buying Asset

//// Button visuals & event listener

SCREENELEMENTS.decision_buybutton.onclick = function () {
  console.log("buy");

  if (roundData.price > roundData.cash) {
    //// Check for sufficient cash
    console.log("not enough money");
    SCREENELEMENTS.decision_buybutton.classList.add("unavailable"); // change button color on hover
  } else if (roundData.price === 0) {
    //// Check if asset has crashed
    console.log("asset is worthless");
    SCREENELEMENTS.decision_buybutton.classList.add("unavailable"); // change button color on hover
  } else {
    //// Change values - cash, assets held
    roundData.asset++;
    roundData.cash = roundData.cash - roundData.price;
    roundData.portfolio = roundData.portfolio + roundData.price;
    SCREENELEMENTS.decision_sellbutton.classList.remove("unavailable");
  }
  update();
};

/// Selling Asset

SCREENELEMENTS.decision_sellbutton.onclick = function () {
  console.log("sell");

  if (roundData.asset <= 0) {
    //// Check whether assets are owned
    console.log("no assets owned");
    SCREENELEMENTS.decision_sellbutton.classList.add("unavailable"); // change button color on hover
  } else {
    //// Change values - cash, assets held
    roundData.portfolio =
      roundData.portfolio - roundData.portfolio / roundData.asset;
    roundData.asset--;
    roundData.cash = roundData.cash + roundData.price;
  }
  if (
    roundData.asset > 0 &&
    roundData.cash + roundData.price > roundData.price
  ) {
    SCREENELEMENTS.decision_buybutton.classList.remove("unavailable");
  }
  if (roundData.asset == 0) {
    SCREENELEMENTS.decision_sellbutton.classList.add("unavailable");
  }
  update();
};

let TLrank;
/// Next Round
SCREENELEMENTS.decision_nextbutton.onclick = function () {
  Plotly.purge(eorchartdiv);
  //console.log(copyRank);
  //console.log(copiedTL);
  if (
    roundData.round + 1 === Stages[0].rounds &&
    treatment === 3 &&
    copiedTL === null
  ) {
    SCREENELEMENTS.decision_nextbutton.classList.add("hidden");
  }
  if (roundData.round + 1 === Stages[0].rounds) {
    //console.log("Done!");
    finalRound();
  } else if (roundData.round === Stages[0].rounds) {
    //console.log("next round");
    nextPhase();
    TLrank = copyMechanism(copiedTL, phase, roundData.round);
    document.getElementById("copydata").classList.remove("hidden");
    toggleColumnVisibility(true);
  } else if (roundData.round + 2 === Stages[0].rounds) {
    SCREENELEMENTS.decision_nextbutton.textContent = "Show Results";
    endRound();
  } else {
    //console.log("Next!");
    document.getElementById("copydata").classList.add("hidden");
    toggleColumnVisibility(false);
    if (treatment === 3) {
      SCREENELEMENTS.decision_nextbutton.classList.add("hidden");
    }
    endRound();
  }
};

////Hiding the Pre Training Info window
SCREENELEMENTS.decision_nextbutton_training.onclick = function () {
  Plotly.purge(eorchartdiv);
  SCREENELEMENTS.decision_sellbutton.classList.add("unavailable");
  if (treatment != 3) {
    document.getElementById("rounddata").classList.remove("hidden");
    document.getElementById("chartwrap").classList.remove("hidden");
  }
  document.getElementById("chartdiv").classList.remove("hidden");
  //document.getElementById("chartwrap").classList.remove("hidden");
  //document.getElementById("copydata").classList.add("hidden");
  document.getElementById("resultdata").classList.add("hidden");
  SCREENELEMENTS.copytable_header.textContent = "Traders";
  SCREENELEMENTS.decision_nextbutton.classList.remove("hidden");
  SCREENELEMENTS.decision_nextbutton_training.classList.add("hidden");
  console.log("trying to find out what is happening");
  SCREENELEMENTS.decision_nextbutton.textContent = "Begin Phase";
  update();
  showMessageRow();
  document.getElementById("messageRow").innerHTML =
    "<h2>Clicking on 'Begin Phase' will calculate price developments and trades.</h2>";
};

/// Hiding the Instruction Window
var originalDisplay = document.querySelector(".centered-container").style
  .display;
SCREENELEMENTS.instructions_nextbutton.onclick = function () {
  //hideMessageRow();
  document.querySelector(".centered-container").style.display = "none";
  SCREENELEMENTS.instructions.classList.add("hidden");
  SCREENELEMENTS.instructions_nextbutton.classList.add("hidden");
  SCREENELEMENTS.instructions_text.classList.add("hidden");

  if (Stages[0].stage === "training" && roundData.round === 0) {
    if (treatment == 2) {
      SCREENELEMENTS.copytable_header.textContent =
        "Performance of other players during the previous phase is shown here";
      document.getElementById("copydata").classList.remove("hidden");
      toggleColumnVisibility(true);
      SCREENELEMENTS.decision_nextbutton.classList.add("hidden");
      SCREENELEMENTS.decision_nextbutton_training.classList.remove("hidden");
      SCREENELEMENTS.copy_request.classList.add("hidden");
      updateRanks();
    } else if (treatment == 3) {
      SCREENELEMENTS.copytable_header.textContent =
        "Performance of copyable players during the previous phase is shown here";
      document.getElementById("copydata").classList.remove("hidden");
      toggleColumnVisibility(true);
      SCREENELEMENTS.decision_nextbutton.classList.add("hidden");
      SCREENELEMENTS.decision_nextbutton_training.classList.add("hidden");
      SCREENELEMENTS.copy_request.classList.remove("hidden");
      updateRanks();
    } else {
      document.getElementById("rounddata").classList.remove("hidden");
      document.getElementById("chartdiv").classList.remove("hidden");
      document.getElementById("chartwrap").classList.remove("hidden");
      SCREENELEMENTS.decision_nextbutton.classList.remove("hidden");
    }
  } else if (Stages[0].stage === "training" && roundData.round > 0) {
    if (treatment == 2) {
      document.getElementById("copydata").classList.remove("hidden");
      toggleColumnVisibility(true);
      document.getElementById("copytable").style.display = "table";
      SCREENELEMENTS.decision_nextbutton.classList.remove("hidden");
      SCREENELEMENTS.decision_nextbutton_training.classList.add("hidden");
      SCREENELEMENTS.copy_request.classList.add("hidden");
      updateRanks();
    } else if (treatment == 3) {
      document.getElementById("copydata").classList.remove("hidden");
      toggleColumnVisibility(true);
      document.getElementById("copytable").style.display = "table";
      SCREENELEMENTS.decision_nextbutton.classList.add("hidden");
      SCREENELEMENTS.decision_nextbutton_training.classList.add("hidden");
      SCREENELEMENTS.copy_request.classList.remove("hidden");
      updateRanks();
      hideMessageRow();
    } else {
      //SCREENELEMENTS.decision_nextbutton.classList.remove("hidden");
      nextPhase();
    }
  }
};

/// Move from training results to copy window for 1st real phase, show info window in between
SCREENELEMENTS.decision_nextbutton_show_info.onclick = function () {
  copiedTL = null;
  copyRank = null;

  document.querySelector(".centered-container").style.display = "block";

  SCREENELEMENTS.instructions.classList.remove("hidden");
  SCREENELEMENTS.instructions_text.classList.remove("hidden");
  document.getElementById("resultdata").classList.add("hidden");
  SCREENELEMENTS.decision_nextbutton_show_info.classList.add("hidden");
  SCREENELEMENTS.instructions_text.innerHTML = `
  <strong style="font-size: 1.2em;">
    That was the training phase
  </strong><br>
  <span style="font-size: 1.1em;">
    Pressing the start button will begin the trading game!
  </span>
`;
  SCREENELEMENTS.instructions_nextbutton.classList.remove("hidden");
};

// End of round function
const endRound = function () {
  // Safe round data
  storeDataRound();
  // Update Plot element
  //CC.updatePlotPath(roundData.price);
  roundData.round++;
  roundData.price = pathPrice[roundData.round];
  roundData.prob = pathProb[roundData.round];
  CC.updatePlotPath(roundData.price);
  update();
  // Define a function to handle the next button click
  function handleNextButton() {
    if (roundData.round + 1 === Stages[0].rounds) {
      finalRound();
      document.getElementById("chartwrap").classList.remove("hidden");
    } else if (roundData.round + 2 === Stages[0].rounds) {
      SCREENELEMENTS.decision_nextbutton.classList.remove("hidden");
      SCREENELEMENTS.decision_nextbutton.textContent = "Show Results";
      endRound();
    } else {
      endRound();
    }
  }

  // Check if another round is needed
  if (treatment === 3) {
    if (roundData.round + 2 <= Stages[0].rounds) {
      // Schedule the next button click after a delay
      setTimeout(handleNextButton, 1);
    }
  }
};

function handleNextButtonClick() {
  //console.log(copyRank);
  //console.log(copiedTL);
  if (
    roundData.round + 1 === Stages[0].rounds &&
    treatment === 3 &&
    copiedTL === null
  ) {
    SCREENELEMENTS.decision_nextbutton.classList.add("hidden");
  }
  if (roundData.round + 1 === Stages[0].rounds) {
    //console.log("Done!");
    finalRound();
  } else if (roundData.round === Stages[0].rounds) {
    //console.log("next round");
    nextPhase();
  } else if (roundData.round + 2 === Stages[0].rounds) {
    SCREENELEMENTS.decision_nextbutton.textContent = "Show Results";
    endRound();
  } else {
    //console.log("Next!");

    endRound();
  }
}

// Final round
const finalRound = function () {
  console.log("final round triggers");
  console.log("Phase" + phase);
  console.log("Round" + roundData.round);
  // Safe round data
  storeDataRound();
  // Update Plot element
  //CC.updatePlotPath(roundData.price);
  roundData.price = pathPrice[roundData.round];
  roundData.prob = pathProb[roundData.round];
  update();
  updateRanks();
  //wealthCalc();
  // keep track of total gain and return
  if (Stages[0].stage === "regular") {
    SCREENELEMENTS.eor.textContent = "End of Phase: " + (phase + 1);
    roundDataPersistent.gain =
      roundDataPersistent.gain + wealthCalc() - roundDataStart.cash;
    roundDataPersistent.endowments =
      roundDataPersistent.endowments + roundDataStart.cash;
    roundDataPersistent.return = returnsCalc(
      roundDataPersistent.endowments,
      roundDataPersistent.gain + roundDataPersistent.endowments
    );
    SCREENELEMENTS.copytable_header.textContent =
      "Traders' Performance Phase: " + (phase + 1);
    if (treatment === 1) {
      document.getElementById("copydata").classList.add("hidden");
      toggleColumnVisibility(false);
    } else {
      document.getElementById("copydata").classList.remove("hidden");
      toggleColumnVisibility(true);
    }
  } else {
    console.log("triggered");
    SCREENELEMENTS.eor.textContent = "End of Training Phase";
    updateRanks();
    //document.getElementById("copydata").classList.remove("hidden");
    SCREENELEMENTS.decision_nextbutton_show_info.classList.remove("hidden");
    SCREENELEMENTS.decision_nextbutton.classList.add("hidden");
    document.getElementById("copydata").classList.add("hidden");
    toggleColumnVisibility(false);
    //document.getElementById("copytable").classList.add("hidden");
    SCREENELEMENTS.copy_request.classList.add("hidden");
  }
  console.log(roundDataPersistent);
  // update Display to show final wealth instead
  SCREENELEMENTS.eorwealth.textContent = wealthCalc();
  SCREENELEMENTS.eorreturn.textContent = returnsCalc(
    roundDataStart.cash,
    wealthCalc()
  );
  SCREENELEMENTS.eorcash.textContent = wealthCalc() - roundDataStart.cash;
  SCREENELEMENTS.eorcashall.textContent = roundDataPersistent.gain;
  SCREENELEMENTS.eorreturnall.textContent = roundDataPersistent.return;
  SCREENELEMENTS.eorwealthall.textContent =
    roundDataPersistent.gain + roundDataPersistent.endowments;

  if (Stages[0].stage === "training") {
    SCREENELEMENTS.eorcashall.textContent = wealthCalc() - roundDataStart.cash;
    SCREENELEMENTS.eorreturnall.textContent = returnsCalc(
      roundDataStart.cash,
      wealthCalc()
    );
    SCREENELEMENTS.eorwealthall.textContent = wealthCalc();
  }
  // hide normal screens and show end of round screen
  document.getElementById("rounddata").classList.add("hidden");
  document.getElementById("chartdiv").classList.add("hidden");
  document.getElementById("chartwrap").classList.add("hidden");
  document.getElementById("resultdata").classList.remove("hidden");

  if (treatment === 3 && copiedTL === null && Stages[0].stage === "regular") {
    SCREENELEMENTS.decision_nextbutton.classList.add("hidden");
    SCREENELEMENTS.copy_request.classList.remove("hidden");
  }
  if (treatment === 1 && Stages[0].stage === "regular") {
    SCREENELEMENTS.copytable.classList.add("hidden");
  }
  if (Stages[0].stage === "training") {
    SCREENELEMENTS.decision_nextbutton.textContent = "Begin Phase";
  } else {
    if (phase + 1 < maxPhases) {
      SCREENELEMENTS.decision_nextbutton.textContent = "Next Phase";
    } else {
      SCREENELEMENTS.decision_nextbutton.textContent = "End Game";
      console.log("End of game test");
      console.log(phase);
      console.log(roundData.round);
    }
  }
  console.log(roundData.plotClicks);
  var x = {
    phaseName: Stages[0].stage,
    phase: phase,
    wealth: wealthCalc(),
    gain: wealthCalc() - roundDataStart.cash,
    phaseReturn: returnsCalc(roundDataStart.cash, wealthCalc()),
    wealthALL: (phase + 1) * roundDataStart.cash + roundDataPersistent.gain,
    gainAll: roundDataPersistent.gain,
    returnAll: roundDataPersistent.return,
    tradeLeader: copiedTL,
    TLrank: TLrank,
    treatment: treatment,
    roundSeries: DATA.roundSeries,
    priceSeries: DATA.priceSeries,
    assetsSeries: DATA.assetsSeries,
    ongoingReturn: DATA.OngoingReturn,
    plotclicks: roundData.plotClicks,
    rankingClicks: roundData.rankingClicks,
    pathseries: pathseries,
    path: pathVersion,
    nameTreatment: nameTreatment, //1 shows risk categories
    followersTreatment: followersTreatment, //0 hides followers
  };
  console.log("pushing stagesummaries");
  console.log(x);
  console.log(roundData.plotClicks);
  DATA.stagesummaries.push(x);
  roundData.rankingClicks = [];
  roundData.plotClicks = [];
  console.log("plotclick test:");
  console.log(roundData.plotClicks);
  console.log(x);
  console.log("TLrank:");
  console.log(copyRank);
  roundData.round++;
  if (!inertiaTreatment) {
    console.log("inertia test");
    resetCopiedTrader();
    updateRanks();
  }
};

// Calculate wealth in final round
const wealthCalc = function () {
  const wealth = roundData.price * roundData.asset + roundData.cash;
  return wealth;
};

//Function to implement banker's rounding to stay in line with Python
const roundHalfToEven = function (num, decimals = 2) {
  const factor = Math.pow(10, decimals);
  const n = num * factor;
  const floored = Math.floor(n);
  const diff = n - floored;

  if (diff > 0.5) {
    return (Math.ceil(n) / factor).toFixed(decimals);
  } else if (diff < 0.5) {
    return (floored / factor).toFixed(decimals);
  } else {
    // diff === 0.5
    // Round to even
    if (floored % 2 === 0) {
      return (floored / factor).toFixed(decimals);
    } else {
      return (Math.ceil(n) / factor).toFixed(decimals);
    }
  }
};

// Calculate percentage return between two values
const returnsCalc = function (initial, final) {
  var ret = ((final - initial) / initial) * 100;
  ret = roundHalfToEven(ret, 2);
  if (isNaN(ret)) {
    ret = "0.00";
  }
  return ret;
};

/// Next Phase

const nextPhase = function () {
  if (treatment === 3) {
    SCREENELEMENTS.decision_nextbutton.textContent = "Calculate";
  } else {
    SCREENELEMENTS.decision_nextbutton.textContent = "Next";
  }
  if (Stages[0].stage === "training") {
    Stages.splice(0, 1); // remove old stage from object
    initializePhase();
    hideMessageRow();
    if (treatment === 3) {
      setTimeout(() => {
        SCREENELEMENTS.decision_nextbutton.click();
      }, 50);
    }
  } else {
    if (phase + 1 < maxPhases) {
      phase++;
      console.log(DATA);
      initializePhase();
      if (treatment === 3) {
        setTimeout(() => {
          SCREENELEMENTS.decision_nextbutton.click();
        }, 50);
      }
    } else {
      SCREENELEMENTS.decision_nextbutton.textContent = "End Game";
      console.log("the game is over!");

      if (treatment != 3) {
        const ks = [5, 10, 15];
        const ch = 0.15;
        const scaleFactor = 1000;

        const { E_list, P_list, increase_probs, s_obs_list } =
          generateEstimationLists(DATA.rounds);
        const realData = [];
        for (let i = 0; i < E_list.length; i++) {
          const E = E_list[i];
          const P = P_list[i];
          const s_obs = s_obs_list[i];
          const maxShares = Math.floor(E / P);
          const p = increase_probs[i]; // Now directly used
          realData.push({ E, s_obs, maxShares, p });
        }

        function utility(w, r) {
          w = w / scaleFactor;
          if (w <= 0) return -Infinity;
          if (r === 1) return Math.log(w);
          return (Math.pow(w, 1 - r) - 1) / (1 - r);
        }

        function expectedUtility(s, E, r, p) {
          const pos = ks.map((k) => utility(E + s * k, r));
          const neg = ks.map((k) => utility(Math.max(E - s * k, 0), r));
          const sumPos = pos.reduce((a, b) => a + b, 0);
          const sumNeg = neg.reduce((a, b) => a + b, 0);
          const up = (8 * p * ch + 2 - 4 * ch) / 12;
          const down = (2 + 4 * ch - 8 * p * ch) / 12;
          return s !== 0 ? up * sumPos + down * sumNeg : utility(E, r);
        }

        function logLikelihoodReal(data, r, lambda) {
          let sum = 0;
          for (const trial of data) {
            const utils = [];
            for (let s = 0; s <= trial.maxShares; s++) {
              const EU = expectedUtility(s, trial.E, r, trial.p);
              utils.push(lambda * scaleFactor * EU);
            }
            const maxU = Math.max(...utils);
            const expUtils = utils.map((u) => Math.exp(u - maxU));
            const denom = expUtils.reduce((a, b) => a + b, 0);
            const prob = expUtils[trial.s_obs] / denom;
            sum += Math.log(prob + 1e-12);
          }
          return sum;
        }

        function countMatchesReal(data, r) {
          let correct = 0;
          for (const trial of data) {
            let bestS = 0;
            let bestEU = -Infinity;
            for (let s = 0; s <= trial.maxShares; s++) {
              const EU = expectedUtility(s, trial.E, r, trial.p);
              if (EU > bestEU) {
                bestEU = EU;
                bestS = s;
              }
            }
            // Optional debug
            //console.log(
            //  `r=${r}, trial.E=${trial.E}, predicted s=${bestS}, observed s=${trial.s_obs},p=${trial.p}`
            //);
            if (bestS === trial.s_obs) correct++;
          }
          return correct;
        }

        function nelderMeadOptimize(f, initialGuess, options = {}) {
          const maxIterations = options.maxIterations || 200;
          const tolerance = options.tolerance || 1e-6;
          const alpha = 1;
          const gamma = 2;
          const rho = 0.5;
          const sigma = 0.5;

          let n = initialGuess.length;
          let simplex = [];
          let values = [];

          // Initialize simplex
          simplex.push(initialGuess);
          for (let i = 0; i < n; i++) {
            let point = initialGuess.slice();
            point[i] += 0.05;
            simplex.push(point);
          }

          values = simplex.map(f);

          for (let iter = 0; iter < maxIterations; iter++) {
            // Sort simplex
            simplex = simplex
              .map((p, i) => ({ p, val: values[i] }))
              .sort((a, b) => a.val - b.val)
              .map((x) => x.p);
            values = simplex.map(f);

            let best = simplex[0];
            let worst = simplex[n];
            let secondWorst = simplex[n - 1];

            // Compute centroid excluding worst
            let centroid = Array(n).fill(0);
            for (let i = 0; i < n; i++) {
              for (let j = 0; j < n; j++) {
                centroid[j] += simplex[i][j] / n;
              }
            }

            // Reflection
            let reflected = centroid.map((c, i) => c + alpha * (c - worst[i]));
            let fReflected = f(reflected);

            if (fReflected < values[0]) {
              // Expansion
              let expanded = centroid.map(
                (c, i) => c + gamma * (reflected[i] - c)
              );
              let fExpanded = f(expanded);
              if (fExpanded < fReflected) {
                simplex[n] = expanded;
                values[n] = fExpanded;
              } else {
                simplex[n] = reflected;
                values[n] = fReflected;
              }
            } else if (fReflected < values[n - 1]) {
              simplex[n] = reflected;
              values[n] = fReflected;
            } else {
              // Contraction
              let contracted = centroid.map((c, i) => c + rho * (worst[i] - c));
              let fContracted = f(contracted);
              if (fContracted < values[n]) {
                simplex[n] = contracted;
                values[n] = fContracted;
              } else {
                // Shrink
                for (let i = 1; i < simplex.length; i++) {
                  simplex[i] = simplex[0].map(
                    (b, j) => b + sigma * (simplex[i][j] - b)
                  );
                  values[i] = f(simplex[i]);
                }
              }
            }

            const spread = Math.max(...values) - Math.min(...values);
            if (spread < tolerance) break;
          }

          return {
            solution: simplex[0],
            f: values[0],
          };
        }

        const result = nelderMeadOptimize(
          ([r, lambda]) => {
            if (lambda <= 0 || r < -5 || r > 10) return Infinity;
            return -logLikelihoodReal(realData, r, lambda);
          },
          [-1.5, 2.0] // Initial guess
        );

        /**
         * Assigns `r` to one of the categories [-1.5, 0, 1, 3, 6].
         * Cut‐points are at the midpoints: -0.75, 0.5, 2, 4.5.
         * Everything below -0.75 → -1.5; everything ≥ 4.5 → 6.
         */
        function categorizeR(r) {
          const cats = [-1.5, 0, 1, 3, 6];
          const mids = cats.slice(0, -1).map((v, i) => (v + cats[i + 1]) / 2);
          for (let i = 0; i < mids.length; i++) {
            if (r < mids[i]) return cats[i];
          }
          return cats[cats.length - 1];
        }
        const rCategory = categorizeR(result.solution[0]);
        console.log("=== Nelder-Mead Estimation (manual) ===");
        console.log("Estimated r:", result.solution[0].toFixed(3));
        console.log("Estimated λ:", result.solution[1].toFixed(3));
        console.log("Log-likelihood:", (-result.f).toFixed(3));
        console.log("r falls in bucket:", rCategory);

        function hardmaxRestricted5(data) {
          const rCandidates = [-1.5, 0, 1, 3, 6];
          const matchCounts = [];
          let bestScore = -1;

          for (var i = 0; i < rCandidates.length; i++) {
            var r = rCandidates[i];
            var matches = countMatchesReal(data, r);
            console.log("r = " + r + ", matches = " + matches);
            matchCounts.push({ r: r, matches: matches });
            if (typeof matches === "number" && matches > bestScore) {
              bestScore = matches;
            }
          }

          // Filter to tied best scores
          var tiedBest = [];
          for (var i = 0; i < matchCounts.length; i++) {
            if (matchCounts[i].matches === bestScore) {
              tiedBest.push(matchCounts[i]);
            }
          }

          // Break tie using closeness to Nelder-Mead estimate, if available
          var bestR = null;
          if (tiedBest.length > 0) {
            if (
              typeof result !== "undefined" &&
              result !== null &&
              result.solution &&
              typeof result.solution[0] === "number"
            ) {
              var nelderMeadR = result.solution[0];
              tiedBest.sort(function (a, b) {
                return (
                  Math.abs(a.r - nelderMeadR) - Math.abs(b.r - nelderMeadR)
                );
              });
              bestR = tiedBest[0].r;
            } else {
              console.warn(
                "'result.solution[0]' is unavailable. Skipping tie-breaking."
              );
              bestR = tiedBest[0].r;
            }
          }

          // Print results
          console.log("=== Hardmax (5-point Restricted) Estimation ===");
          for (var i = 0; i < matchCounts.length; i++) {
            console.log(
              "r = " +
                matchCounts[i].r +
                ": " +
                matchCounts[i].matches +
                " matches"
            );
          }
          console.log("Best r (from fixed set): " + bestR);
          console.log(
            "Matches: " +
              bestScore +
              " / " +
              (data && data.length ? data.length : "?")
          );

          // Set embedded data in Qualtrics
          if (
            typeof Qualtrics !== "undefined" &&
            Qualtrics.SurveyEngine &&
            typeof Qualtrics.SurveyEngine.setEmbeddedData === "function"
          ) {
            Qualtrics.SurveyEngine.setEmbeddedData("HardR", bestR);
          }

          return {
            bestR: bestR,
            bestScore: bestScore,
            matchCounts: matchCounts,
          };
        }
        const restrictedResult = hardmaxRestricted5(realData);
        Qualtrics.SurveyEngine.setEmbeddedData(
          "mleR",
          result.solution[0].toFixed(3)
        );
        Qualtrics.SurveyEngine.setEmbeddedData(
          "mleLambda",
          result.solution[1].toFixed(3)
        );

        function estimateRfromHardmaxReal(
          data,
          rMin = -2.5,
          rMax = 8,
          step = 0.05
        ) {
          let bestR = rMin;
          let bestScore = -1;
          for (let r = rMin; r <= rMax; r += step) {
            const score = countMatchesReal(data, r);
            if (score > bestScore) {
              bestScore = score;
              bestR = r;
            }
          }
          return { bestR, bestScore };
        }

        const hardmaxRealResult = estimateRfromHardmaxReal(realData);
        console.log("=== Hardmax Estimation from Real Data (Match Count) ===");
        console.log(
          "Estimated r (max match):",
          hardmaxRealResult.bestR.toFixed(3)
        );
        console.log(
          "Matches:",
          hardmaxRealResult.bestScore,
          "/",
          realData.length
        );
        Qualtrics.SurveyEngine.setEmbeddedData(
          "HardRfree",
          hardmaxRealResult.bestR.toFixed(3)
        );
      }

      QM.writeData(DATA);
      let gainValue =
        DATA.stagesummaries &&
        DATA.stagesummaries[winningIndex] &&
        DATA.stagesummaries[winningIndex].gain !== undefined &&
        DATA.stagesummaries[winningIndex].gain !== null
          ? DATA.stagesummaries[winningIndex].gain
          : null;
      console.log(`Winning Index: ${winningIndex}, Gain: ${gainValue}`);
      console.log("Gaivalue:");
      console.log(gainValue);

      var key = treatment === 1 ? "ElicitationGain" : "FinalGain";
      Qualtrics.SurveyEngine.setEmbeddedData(key, gainValue);

      Qualtrics.SurveyEngine.setEmbeddedData("WinningRound", winningIndex);
      Qualtrics.SurveyEngine.setEmbeddedData("Endowment", roundDataStart.cash);
      Qualtrics.SurveyEngine.setEmbeddedData(
        "Payout",
        roundDataStart.cash + gainValue
      );
      Qualtrics.SurveyEngine.setEmbeddedData(
        "nameList",
        JSON.stringify(scrambledNameList)
      );

      //QM.writeData(DATA.stagesummaries);
      QM.submitQuestion();
    }
    console.log(Stages[0].stage);
    console.log(Stages[0].rounds);
    console.log("Phase:");
    console.log(phase);
    //
  }
  // Resetting everything
};

function generateEstimationLists(DATA) {
  const E_list = [];
  const P_list = [];
  const increase_probs = [];
  const s_obs_list = [];

  for (let key in DATA.rounds) {
    const round = DATA.rounds[key];
    const roundIndex = parseInt(key, 10);

    // Skip the first 5 rounds
    if (roundIndex <= 4) continue;

    // Skip rounds where r == 40
    if (round.r === 50) continue;

    const a = round.a;
    const p = round.p;
    const c = round.c;
    const prob = round.prob;

    const E = a * p + c;

    E_list.push(E);
    P_list.push(p);
    increase_probs.push(prob);
    s_obs_list.push(a);
  }

  return { E_list, P_list, increase_probs, s_obs_list };
}

const initializePhase = function () {
  // initializing a new phase to be called after last round
  console.log("Phase:");
  console.log(phase);
  initialize();
  update();
  CC.reset(Stages[0].rounds - 1);
  //CC.updatePlotPath(roundData.price);store
  SCREENELEMENTS.decision_price_label.textContent = "Asset Price:";
  SCREENELEMENTS.decision_cash_label.textContent = "Cash:";
  SCREENELEMENTS.decision_shares_label.textContent = "Shares:";
  SCREENELEMENTS.decision_sellbutton.classList.add("exBUTTON--unavailable");
  SCREENELEMENTS.decision_return_label.textContent = "Wealth:";
  SCREENELEMENTS.decision_return.textContent = " 0";
  if (treatment == 1) {
    SCREENELEMENTS.copy_data_screen.classList.add("hidden");
  } else if (treatment == 2) {
    SCREENELEMENTS.copy_button1.classList.add("hidden");
    SCREENELEMENTS.copy_button2.classList.add("hidden");
    SCREENELEMENTS.copy_button3.classList.add("hidden");
    SCREENELEMENTS.copy_button4.classList.add("hidden");
    SCREENELEMENTS.copy_button5.classList.add("hidden");
  } else {
    SCREENELEMENTS.decision_buybutton.classList.add("hidden");
    SCREENELEMENTS.decision_sellbutton.classList.add("hidden");
  }
  pathPicker();
};

//// Check which stage
//// move to next stage, reset everything
//// if finished wrapping up game TO ADD STEPS

// Misc

// Plotly
const ChartController = function (nrounds, startprice) {
  // Needs a reference to the chart div. This is hardcoded!
  var divname = "chartdiv";

  // Defining plot layout
  var layout = {
    showlegend: false,
    width: "95%",
    height: 300,
    title: {
      text: "Share Price Development",
      font: {
        size: 15,
      },
    },
    margin: {
      l: 50,
      r: 0,
      b: 50,
      t: 50,
      pad: 0,
    },
    paper_bgcolor: "white",
    plot_bgcolor: "white",
    yaxis: {
      title: "Price in ECU",
      titlefont: {
        size: 15,
        color: "black",
      },
      linecolor: "white",
      ticks: "inside",
      tickfont: {
        color: "black",
      },
      showgrid: true,
    },
    xaxis: {
      title: "Period",
      titlefont: {
        size: 15,
        color: "black",
      },
      tickfont: {
        color: "black",
      },
      autotick: false,
      ticks: "outside",
      tick0: 0,
      dtick: 1,
      range: [-0.5, nrounds + 0.5],
      tickvals: [0].concat(
        Array.from(
          { length: Math.ceil(nrounds / 10) },
          (_, i) => i * 10 + 1
        ).filter((v) => v <= nrounds)
      ),
      ticks: "outside",
      showgrid: false,
      automargin: true,
    },
    hoverlabel: {
      bgcolor: "white",
      font: { color: "black", size: 20 },
    },
  };

  // Will store the y-axis values
  var y = [startprice];

  // Create a plot data element
  var Plotdata = [
    {
      y: y,
      mode: "lines",
      marker: { color: "blue", size: 10 },
    },
  ];

  // Already draw an empty graph on initialization
  Plotly.plot(divname, Plotdata, layout, { staticPlot: true });

  // Call to plot the price path with a new value
  this.updatePlotPath = function (newprice) {
    Plotdata[0].y.push(newprice);
    setrange();
    Plotly.newPlot(divname, Plotdata, layout, { staticPlot: true });
  };

  // Call to reset the chart entirely. Needs a new number of rounds
  this.reset = function (newrounds) {
    layout.xaxis.range = [-0.5, newrounds + 0.5];
    layout.xaxis.tickvals = Array.from(
      { length: Math.ceil(newrounds / 10) + 1 },
      (_, i) => i * 10 + 1
    ).filter((v) => v <= newrounds);
    setrange();

    Plotdata[0].y = [startprice];

    Plotly.newPlot(divname, Plotdata, layout);
  };

  // Sets the range of the graph such that the lines are a bit more centered.
  // Sets the range based on 10 off from the min and max of the return sequence.
  function setrange() {
    // Get the min and max of the plotted array
    var range = Plotdata[0].y;
    var max = Math.max.apply(null, range);
    var min = Math.min.apply(null, range);

    // Set the range in the layout object
    Plotly.relayout(divname, "yaxis.range", [min - 10, max + 10]);
  }

  // Copies the current state of the graph to an object with the given name
  this.copyToNewObject = function (name) {
    Plotly.newPlot(name, Plotdata, layout, { staticPlot: true });
  };
};

var CC = new ChartController(Stages[0].rounds - 1, roundData.price);

//Plotly Popup chart controller
const PopupChartController = function (
  nrounds,
  roundseries,
  rightseries,
  leftseries,
  chart,
  title,
  righttitle,
  type,
  startrange,
  name
) {
  //Needs a reference to the chart div. This is hardcoded!
  roundData.rankingClicks.push(name);
  var divname = chart;
  //Defining plot layout
  var layout = {
    showlegend: true,
    width: 350,
    height: 200,
    title: {
      text: title,
      font: {
        size: 10,
      },
    },
    margin: {
      l: 40,
      r: 40,
      b: 80,
      t: 40,
      pad: 5,
      autoexpand: false,
    },
    paper_bgcolor: "white",
    plot_bgcolor: "white",
    yaxis: {
      title: "Price in ECU",
      titlefont: {
        size: 10,
        color: "black",
      },
      linecolor: "black",
      ticks: "outside",
      tickfont: {
        color: "black",
      },
      showgrid: true,
      zeroline: false,
      overlaying: "y2",
    },
    yaxis2: {
      title: righttitle,
      titlefont: {
        size: 10,
        color: "black",
      },
      linecolor: "black",
      ticks: "inside",
      tickfont: {
        color: "black",
      },
      showgrid: true,
      zeroline: false,
      side: "right",
    },

    xaxis: {
      title: "Period",
      titlefont: {
        size: 10,
        color: "black",
      },
      tickfont: {
        color: "black",
      },
      autotick: false,
      ticks: "inside",
      //tick0: 0,
      dtick: 1,
      range: [startrange, nrounds - 1 + 0.5],
      zeroline: false,
      showgrid: false,
    },
    hoverlabel: {
      bgcolor: "white",
      font: { color: "black", size: 20 },
    },
    legend: {
      orientation: "h", // Horizontal orientation
      yanchor: "top",
      y: -0.5, // Position below the plot; adjust as needed
      xanchor: "center",
      x: 0.5, // Centered horizontally
    },
  };

  var right = {
    //x: roundseries,
    y: rightseries,
    name: righttitle,
    xaxis: "x",
    yaxis: "y2",
    type: type,
  };
  var left = {
    x: roundseries,
    y: leftseries,
    name: "Price in ECU",
    type: "line",
    xaxis: "x",
    yaxis: "y",
  };
  var data = [left, right];
  Plotly.newPlot(divname, data, layout, { staticPlot: true });
};

//Plotly.plot(divname, Plotdata, layout, { staticPlot: true });

// Qualtrics Interactions

const QualtricsManager = function () {
  //Next button and output field
  var NextButton = document.getElementById("NextButton");

  //This boolean tests if we're currently in Qualtrics.
  var inQualtrics = NextButton !== null;
  console.warn("Qualtrics enviroment detected: " + inQualtrics);

  //On initalization, hide the nextbutton and output field, load treatment and path
  if (inQualtrics) {
    treatment = parseInt(Qualtrics.SurveyEngine.getEmbeddedData("treatment"));
    if (treatment == 1) {
      maxPhases = 1;
    } else {
      maxPhases = 10;
    }
    console.log("max phases: " + maxPhases);
    console.log("treatment: " + treatment);
    console.log(typeof treatment);
    pathseries = Qualtrics.SurveyEngine.getEmbeddedData("pathseries");
    console.log(pathseries);
    NextButton.style.display = "none";
  }

  //Attempts to paste the output into the
  this.writeData = function (data) {
    // Make sure we’re comparing numbers (or change to String() if treatment comes in as a string)
    var treatment = Number(treatment);

    // Choose the embedded-data field based on treatment
    var key = treatment === 1 ? "DataElicitation" : "Data";

    if (inQualtrics) {
      Qualtrics.SurveyEngine.setEmbeddedData(key, JSON.stringify(data));
    } else {
      console.warn("Failed to write data, as we're not in Qualtrics");
      console.log(key + ": ", data);
      console.log(key + ": ", JSON.stringify(data));
    }
  };

  //Submits the qualtrics data
  this.submitQuestion = function () {
    if (inQualtrics) {
      NextButton.click();
    } else {
      console.warn("Failed to hit Qualtrics NextButton");
    }
  };

  //Calculates the subjects earnings: one stage wealth and one accuracy bonus
  this.setEmbeddedData = function (expdata) {
    //Select a random stage and round
    var SelectedRound = sampleRandomElementFromArray(expdata.rounds);
    while (
      SelectedRound.stg === "alwaysBuyTraining" ||
      SelectedRound.stg === "alwaysSellTraining" ||
      SelectedRound.r === 1
    ) {
      SelectedRound = sampleRandomElementFromArray(expdata.rounds);
    }

    var SelectedStage = sampleRandomElementFromArray(expdata.stagesummaries);

    //Wealth in ECU: Wealth
    Qualtrics.SurveyEngine.setEmbeddedData("Wealth", SelectedStage.wealth_end);

    //Payment round: PaymentRound
    Qualtrics.SurveyEngine.setEmbeddedData("PaymentRound", SelectedRound.r);

    //Payment round: StageSelected
    Qualtrics.SurveyEngine.setEmbeddedData("PaymentStage", SelectedRound.ses);

    //Total payment in CHF: Payment
    var totalbonus = SelectedStage.wealth_end;
    var exchangerate = 1 / 20;
    var payoff = (totalbonus * exchangerate * 10) / 10;
    Qualtrics.SurveyEngine.setEmbeddedData("Payment", payoff.toFixed(1));
  };

  //Retrieves a variable from Qualtrics EmbeddedVariables
  this.getEmbeddedData = function (variable) {
    if (inQualtrics) {
      console.log(
        "Retrieving variable " +
          variable +
          " at value " +
          Qualtrics.SurveyEngine.getEmbeddedData(variable)
      );
      return Qualtrics.SurveyEngine.getEmbeddedData(variable);
    } else {
      console.warn(
        "Currently not in Qualtrics; unable to retrieve " + variable
      );
    }
  };
};

/* const pp = {};
for (let i = 0; i < 30; i += 1) {
  let propName = `path${i}`; // create a dynamic property name
  pp[propName] = [];
  pp[propName].push(QM.getEmbeddedData(propName));

  //for (let j = 0; j < 40; j += 1) {
  //  let p = `${i}.${j}`;
  //  pp[propName].push(QM.getEmbeddedData(p));
  //}
}*/

/// Top performer functionality

//// Page browsing button
/// calculate number of pages
let page = 0;
let maxpage;

console.log(maxpage);
/// Eventlistner
SCREENELEMENTS.copy_next.onclick = function () {
  if (page + 1 <= maxpage) {
    page += 1;
    roundData.rankingClicks.push("Next");
    roundData.next += 1;
  }
  if (page != 0) {
    SCREENELEMENTS.copy_prev.classList.remove("hidden");
  }
  SCREENELEMENTS.copy_prev.textContent = "Previous 5";
  if (page == maxpage) {
    SCREENELEMENTS.copy_next.classList.add("hidden");
  }
  updateRanks();
};
SCREENELEMENTS.copy_prev.onclick = function () {
  if (page >= 0) {
    page -= 1;
    roundData.rankingClicks.push("Previous");
    roundData.previous += 1;
  }
  if (page == 0) {
    SCREENELEMENTS.copy_prev.classList.add("hidden");
  }
  if (page <= maxpage) {
    SCREENELEMENTS.copy_next.classList.remove("hidden");
  }
  updateRanks();
};

//Function that adjusts displayed playernames depending on risk level and treatment

//Array shuffle for the non informative names
//Run once at startup and save list to Qualtrics
const nameList = ["Trader A", "Trader B", "Trader C", "Trader D", "Trader E"];

function shuffleArray(array) {
  // Create a copy of the array to avoid mutating the original array
  let arr = array.slice();

  // Loop through the array
  for (let i = arr.length - 1; i > 0; i--) {
    // Generate a random index
    const j = Math.floor(Math.random() * (i + 1));

    // Swap elements at index i and index j
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

function processName(crra) {
  // Split the input string by "_"
  const parts = crra.split("_");
  //console.log(parts);
  // Extract the value of X
  const x = parseFloat(parts[1]);
  //console.log(x);

  // Depending on the value of X, return different strings
  // By treatment
  if (Stages[0].stage != "training" || roundData.round > 0) {
    if (nameTreatment === 1) {
      switch (x) {
        case -1.5:
          return "Risk-seeking Trader";
        case 0:
          return "Risk-neutral Trader";
        case 1:
          return "Slightly risk-averse Trader";
        case 3:
          return "Moderately risk-averse Trader";
        case 6:
          return "Highly risk-averse Trader";
        default:
          return "Error";
      }
    } else {
      switch (x) {
        case -1.5:
          return scrambledNameList[0];
        case 0:
          return scrambledNameList[1];
        case 1:
          return scrambledNameList[2];
        case 3:
          return scrambledNameList[3];
        case 6:
          return scrambledNameList[4];
        default:
          return "Error";
      }
    }
  } else {
    return crra;
  }
}

// Rank number
// Updating values
const updateRanks = function () {
  if (treatment != 1) {
    if (Stages[0].stage === "training" && roundData.round === 0) {
      maxpage =
        Math.ceil(Object.keys(dataTraining["stage_0"]["round_0"]).length / 5) -
        1;
    } else {
      maxpage =
        Math.ceil(Object.keys(data["stage_0"]["round_0"]).length / 5) - 1;
    }
    if (maxpage === 0) {
      SCREENELEMENTS.copy_next.classList.add("hidden");
    }
    SCREENELEMENTS.rank1.textContent = 1 + page * 5 + ".";
    SCREENELEMENTS.rank2.textContent = 2 + page * 5 + ".";
    SCREENELEMENTS.rank3.textContent = 3 + page * 5 + ".";
    SCREENELEMENTS.rank4.textContent = 4 + page * 5 + ".";
    SCREENELEMENTS.rank5.textContent = 5 + page * 5 + ".";

    let stage = "stage_" + phase;
    let round = "round_" + 0;
    let rank1 = "rank_" + (1 + page * 5);
    let rank2 = "rank_" + (2 + page * 5);
    let rank3 = "rank_" + (3 + page * 5);
    let rank4 = "rank_" + (4 + page * 5);
    let rank5 = "rank_" + (5 + page * 5);

    for (let i = 1; i <= 5; i++) {
      const playerKey = "player" + i;
      const wealthKey = "wealth" + i;
      const gainKey = "gain" + i;
      const returnKey = "return" + i;
      const wealthallKey = "wealthall" + i;
      const gainallKey = "gainall" + i;
      const retallKey = "retall" + i;
      const copiersKey = "copiers" + i;
      let rankid = "rank_" + i;
      let playerData;

      if (Stages[0].stage === "training" && roundData.round === 0) {
        playerData = dataTraining[stage][round]["rank_" + (i + page * 5)] || {}; // Ensure playerData is an object
      } else if (Stages[0].stage === "training" && roundData.round > 3) {
        playerData = data[stage]["round_0"]["rank_" + (i + page * 5)] || {};
      } else if (Stages[0].stage != "training" && roundData.round === 0) {
        stage = "stage_" + phase;
        playerData = data[stage]["round_0"]["rank_" + (i + page * 5)] || {};
      } else if (
        Stages[0].stage != "training" &&
        phase === maxPhases - 1 &&
        roundData.round === 40
      ) {
        console.log("phase:" + phase);
        console.log("round" + roundData.round);
        stage = "stage_" + phase;
        console.log("stage term: " + stage);
        playerData = data[stage]["round_40"]["rank_" + (i + page * 5)] || {};
      } else {
        console.log("phase:" + phase);
        console.log("round" + roundData.round);
        stage = "stage_" + (phase + 1);
        playerData = data[stage]["round_0"]["rank_" + (i + page * 5)] || {};
        console.log(stage);
      }
      //console.log(playerData);
      const playerValue = playerData["ResponseId"] || "";
      const wealthValue =
        playerData["phaseWealth"] === 0 ? "0" : playerData["phaseWealth"] || "";
      //console.log(wealthValue);
      const returnValue =
        playerData["phaseReturn"] === 0 ? "0" : playerData["phaseReturn"] || "";
      const gainValue =
        playerData["gain"] === 0 ? "0" : playerData["gain"] || "";
      const retallValue =
        playerData["returnAllv2"] === 0 ? "0" : playerData["returnAllv2"] || "";
      const wealthallValue =
        playerData["wealthAllv2"] === 0 ? "0" : playerData["wealthAllv2"] || "";
      const currWealthValue =
        playerData["currWealth"] === 0 ? "0" : playerData["currWealth"] || "";
      const gainallValue =
        playerData["gainAll"] === 0 ? "0" : playerData["gainAll"] || "";
      if (followersTreatment == 1) {
        const copiersValue = TLs[nameTreatment][stage][rankid];
        console.log("Copiers Value:");
        console.log(copiersValue);
        console.log(copiersKey);
        SCREENELEMENTS[copiersKey].textContent = copiersValue + "%";
      }

      SCREENELEMENTS[playerKey].textContent = processName(playerValue);
      SCREENELEMENTS[wealthKey].textContent = wealthValue;
      SCREENELEMENTS[returnKey].textContent = returnValue + "%";
      if (phase === maxPhases - 1 && roundData.round === 40) {
        SCREENELEMENTS[wealthallKey].textContent = wealthallValue;
      } else {
        SCREENELEMENTS[wealthallKey].textContent =
          wealthallValue - currWealthValue;
      }
      SCREENELEMENTS[retallKey].textContent = retallValue + "%";
    }

    let playerData1;
    let playerData2;
    let playerData3;
    let playerData4;
    let playerData5;

    if (Stages[0].stage === "training" && roundData.round === 0) {
      playerData1 = dataTraining[stage][round][rank1] || {}; // Ensure playerData is an object
      playerData2 = dataTraining[stage][round][rank2] || {};
      playerData3 = dataTraining[stage][round][rank3] || {};
      playerData4 = dataTraining[stage][round][rank4] || {};
      playerData5 = dataTraining[stage][round][rank5] || {};
    } else if (Stages[0].stage === "training" && roundData.round > 3) {
      playerData1 = data[stage]["round_0"][rank1] || {}; // Ensure playerData is an object
      playerData2 = data[stage]["round_0"][rank2] || {};
      playerData3 = data[stage]["round_0"][rank3] || {};
      playerData4 = data[stage]["round_0"][rank4] || {};
      playerData5 = data[stage]["round_0"][rank5] || {};
    } else if (
      Stages[0].stage != "training" &&
      phase === maxPhases - 1 &&
      roundData.round === 40
    ) {
      stage = "stage_" + phase;
      playerData1 = data[stage]["round_40"][rank1] || {}; // Ensure playerData is an object
      playerData2 = data[stage]["round_40"][rank2] || {};
      playerData3 = data[stage]["round_40"][rank3] || {};
      playerData4 = data[stage]["round_40"][rank4] || {};
      playerData5 = data[stage]["round_40"][rank5] || {};
    } else {
      stage = "stage_" + (phase + 1);
      playerData1 = data[stage][round][rank1] || {}; // Ensure playerData is an object
      playerData2 = data[stage][round][rank2] || {};
      playerData3 = data[stage][round][rank3] || {};
      playerData4 = data[stage][round][rank4] || {};
      playerData5 = data[stage][round][rank5] || {};
    }

    //console.log(playerData1);
    window.lastPhaseReturn2 = playerData1["phaseReturn"];
    window.lastPhaseReturn3 = playerData2["phaseReturn"];
    window.lastPhaseReturn4 = playerData3["phaseReturn"];
    window.lastPhaseReturn5 = playerData4["phaseReturn"];
    window.lastPhaseReturn6 = playerData5["phaseReturn"];

    window.allPhaseReturn2 = playerData1["returnAllv2"];
    window.allPhaseReturn3 = playerData2["returnAllv2"];
    window.allPhaseReturn4 = playerData3["returnAllv2"];
    window.allPhaseReturn5 = playerData4["returnAllv2"];
    window.allPhaseReturn6 = playerData5["returnAllv2"];

    window.allPhaseGain2 = playerData1["gainAll"];
    window.allPhaseGain3 = playerData2["gainAll"];
    window.allPhaseGain4 = playerData3["gainAll"];
    window.allPhaseGain5 = playerData4["gainAll"];
    window.allPhaseGain6 = playerData5["gainAll"];

    window.thisPhaseReturn2 = returnsCalc(
      roundDataStart.cash - playerData1["unrealized"],
      playerData1["c"]
    );
    window.thisPhaseReturn3 = returnsCalc(
      roundDataStart.cash - playerData2["unrealized"],
      playerData2["c"]
    );
    window.thisPhaseReturn4 = returnsCalc(
      roundDataStart.cash - playerData3["unrealized"],
      playerData3["c"]
    );
    window.thisPhaseReturn5 = returnsCalc(
      roundDataStart.cash - playerData4["unrealized"],
      playerData4["c"]
    );
    window.thisPhaseReturn6 = returnsCalc(
      roundDataStart.cash - playerData5["unrealized"],
      playerData5["c"]
    );

    window.roundseries2 = playerData1["roundSeries"];
    window.roundseries3 = playerData2["roundSeries"];
    window.roundseries4 = playerData3["roundSeries"];
    window.roundseries5 = playerData4["roundSeries"];
    window.roundseries6 = playerData5["roundSeries"];

    window.priceseries2 = playerData1["priceSeries"];
    window.priceseries3 = playerData2["priceSeries"];
    window.priceseries4 = playerData3["priceSeries"];
    window.priceseries5 = playerData4["priceSeries"];
    window.priceseries6 = playerData5["priceSeries"];

    window.returnseries2 = playerData1["ongoingReturnSeries"];
    window.returnseries3 = playerData2["ongoingReturnSeries"];
    window.returnseries4 = playerData3["ongoingReturnSeries"];
    window.returnseries5 = playerData4["ongoingReturnSeries"];
    window.returnseries6 = playerData5["ongoingReturnSeries"];

    window.assetseries2 = playerData1["assetseries"];
    window.assetseries3 = playerData2["assetseries"];
    window.assetseries4 = playerData3["assetseries"];
    window.assetseries5 = playerData4["assetseries"];
    window.assetseries6 = playerData5["assetseries"];

    window.playerid2 = playerData1["ResponseId"];
    window.playerid3 = playerData2["ResponseId"];
    window.playerid4 = playerData3["ResponseId"];
    window.playerid5 = playerData4["ResponseId"];
    window.playerid6 = playerData5["ResponseId"];

    window.player1 = playerData1;
    window.player2 = playerData2;
    window.player3 = playerData3;
    window.player4 = playerData4;
    window.player5 = playerData5;

    document.querySelectorAll(".trader-button").forEach((button, index) => {
      //const traderId = `player${index + 1}`;
      const traderId = "player" + (index + 1);
      console.log(traderId);
      const traderInfo = window[traderId];
      //button.textContent = processName(traderInfo["ResponseId"]); // Update button title to trader's name - removed
      button.textContent = "Show";
    });

    document
      .querySelectorAll(".trader-button-perf")
      .forEach((button, index) => {
        //const traderId = `player${index + 1}`;
        const traderId = "player" + (index + 1);
        console.log(traderId);
        const traderInfo = window[traderId];
        //button.textContent = processName(traderInfo["ResponseId"]); // Update button title to trader's name - removed
        button.textContent = "Show";
      });

    //console.log("Copied TL: ");
    //console.log(copiedTL);
    setButtonClasses(processName(copiedTL));
    hideUnusedButtons("copytable");
  }
};
function hideMessageRow() {
  const messageRow = document.getElementById("messageRow");
  if (messageRow) {
    messageRow.style.display = "none";
  }
}

function showMessageRow() {
  const messageRow = document.getElementById("messageRow");
  if (messageRow) {
    messageRow.style.display = "";
  }
}

function calculateGlobalMaxAssets(traders) {
  // Flatten all asset series arrays from each trader and find the max value
  const allAssetsValues = traders.flatMap((trader) => trader["assetsSeries"]);
  globalMaxAssets = Math.max(...allAssetsValues) * 1.1; // Add 10% padding
}

function calculateGlobalReturn(traders) {
  // Flatten all asset series arrays from each trader and find the max value
  const allReturnValues = traders.flatMap(
    (trader) => trader["ongoingReturnSeries"]
  );
  globalMaxReturn = Math.max(...allReturnValues) * 1.1; // Add 10% padding
  globalMinReturn = Math.min(...allReturnValues) * 1.1;
}

let lastTraderId = null;
let lastChartType = null;
let globalMaxAssets = 0;
let globalMaxReturn = 0;
let globalMinReturn = 0;
// Plotly setup function for chart (this updates the plot)
function updateChart(trader) {
  const priceSeries = trader["priceSeries"];
  const roundSeries = trader["roundSeries"];
  const secondarySeries = trader["assetseries"]; // Second series for y-axis 2

  const traders = [
    window.player1,
    window.player2,
    window.player3,
    window.player4,
    window.player5,
  ];
  calculateGlobalMaxAssets(traders);

  // Main trace for the primary y-axis
  const trace1 = {
    x: roundSeries,
    y: priceSeries,
    mode: "lines+markers",
    type: "scatter",
    name: "Price",
    yaxis: "y2",
  };

  // Secondary trace for the secondary y-axis
  const trace2 = {
    x: roundSeries,
    y: secondarySeries,
    mode: "lines+markers",
    type: "scatter",
    name: "Assets",
    yaxis: "y1", // Specify the second y-axis
  };
  let head = processName(trader["ResponseId"]) + " Strategy";
  const layout = {
    title: head,
    xaxis: { title: "Rounds" },
    yaxis: {
      title: "Assets",
      side: "left",
      range: [0, globalMaxAssets],
    },
    height: 300,
    yaxis2: {
      title: "Price",
      overlaying: "y",
      side: "right",
    },
    legend: {
      orientation: "h",
      x: 0.5,
      xanchor: "center",
      y: -0.4,
    },
  };
  const config = {
    displayModeBar: false, // this is the line that hides the bar.
  };
  Plotly.newPlot("eorchartdiv", [trace1, trace2], layout, config);
}

function updateChartPerf(trader) {
  const priceSeries = trader["priceSeries"];
  const roundSeries = trader["roundSeries"];
  const secondarySeries = trader["ongoingReturnSeries"]; // Second series for y-axis 2

  const traders = [
    window.player1,
    window.player2,
    window.player3,
    window.player4,
    window.player5,
  ];
  calculateGlobalReturn(traders);

  // Main trace for the primary y-axis
  const trace1 = {
    x: roundSeries,
    y: priceSeries,
    mode: "lines+markers",
    type: "scatter",
    name: "Price",
    yaxis: "y2",
  };

  // Secondary trace for the secondary y-axis
  const trace2 = {
    x: roundSeries,
    y: secondarySeries,
    mode: "lines+markers",
    type: "scatter",
    name: "Return",
    yaxis: "y1", // Specify the second y-axis
  };
  let head = processName(trader["ResponseId"]) + " Performance";
  const layout = {
    title: head,
    xaxis: { title: "Rounds" },
    yaxis: {
      title: "Return",
      side: "left",
      range: [globalMinReturn, globalMaxReturn],
    },
    height: 300,
    yaxis2: {
      title: "Price",
      overlaying: "y",
      side: "right",
    },
    legend: {
      orientation: "h", // Horizontal legend
      x: 0.5, // Center it horizontally
      xanchor: "center",
      y: -0.4, // Position it below the plot
    },
  };
  const config = {
    displayModeBar: false, // this is the line that hides the bar.
  };
  Plotly.newPlot("eorchartdiv", [trace1, trace2], layout, config);
}

// Event listener for strategy buttons
document.querySelectorAll(".trader-button").forEach((button, index) => {
  const traderId = "player" + (index + 1);
  button.addEventListener("click", () => {
    const traderInfo = window[traderId];
    console.log(traderInfo);
    const traderResponseId = traderInfo["ResponseId"];
    const currentChartType = "strategy"; // Define the current chart type

    // Check if the same trader and chart type button was clicked
    if (
      lastTraderId === traderResponseId &&
      lastChartType === currentChartType
    ) {
      Plotly.purge("eorchartdiv"); // Clear the plot
      lastTraderId = null; // Reset the last trader
      lastChartType = null; // Reset the chart type
    } else {
      updateChart(traderInfo); // Update chart with new trader data
      lastTraderId = traderResponseId; // Update the last clicked trader
      lastChartType = currentChartType; // Update the last chart type
      roundData.plotClicks.push(traderResponseId);
      console.log(roundData.rankingClicks);
      console.log(roundData.plotClicks);
    }

    hideMessageRow();
  });
});

// Event listener for performance buttons
document.querySelectorAll(".trader-button-perf").forEach((button, index) => {
  const traderId = "player" + (index + 1);
  button.addEventListener("click", () => {
    const traderInfo = window[traderId];
    const traderResponseId = traderInfo["ResponseId"];
    const currentChartType = "performance"; // Define the current chart type

    // Check if the same trader and chart type button was clicked
    if (
      lastTraderId === traderResponseId &&
      lastChartType === currentChartType
    ) {
      Plotly.purge("eorchartdiv"); // Clear the plot
      lastTraderId = null; // Reset the last trader
      lastChartType = null; // Reset the chart type
    } else {
      updateChartPerf(traderInfo); // Update chart with new trader data
      lastTraderId = traderResponseId; // Update the last clicked trader
      lastChartType = currentChartType; // Update the last chart type
      roundData.rankingClicks.push(traderResponseId);
      console.log(roundData.rankingClicks);
      console.log(roundData.plotClicks);
    }

    hideMessageRow();
  });
});
/* taken out with implementation of buttons 22.11.
/// Info popup
const table = document.getElementById("copytable");
const rows = table.getElementsByTagName("tr");
const popup = document.getElementById("mypopup");
const popupName = document.getElementById("popupName");

for (let i = 2; i < rows.length; i++) {
  rows[i].addEventListener("click", function () {
    const targetCell = event.target;

    // Check if the clicked cell is in the last column
    if (
      targetCell.cellIndex === rows[i].cells.length - 1 ||
      targetCell.tagName === "BUTTON"
    ) {
      return; // Do nothing if it's the last column
    }

    event.stopPropagation();

    const cells = rows[i].getElementsByTagName("td");
    const name = cells[1].textContent;
    let thisPhaseReturn = "thisPhaseReturn" + i;
    let lastPhaseReturn = "lastPhaseReturn" + i;
    let allPhaseReturn = "allPhaseReturn" + i;
    let allPhaseGain = "allPhaseGain" + i;
    let roundseries = "roundseries" + i;
    let priceseries = "priceseries" + i;
    let returnseries = "returnseries" + i;
    let assetseries = "assetseries" + i;
    let rounds;
    let chart1 = "popupchartdiv2";
    let title1 = "Ongoing Returns";
    let righttitle1 = "Return in Percent";
    let chart2 = "popupchartdiv";
    let title2 = "The Number of Assets Held";
    let righttitle2 = "Number of Assets held";

    popupName.textContent = name;

    if (Stages[0].stage === "training" && roundData.round === 0) {
      rounds = Stages[0].rounds;
    } else if (Stages[0].stage === "training" && roundData.round === 4) {
      rounds = Stages[0].rounds;
    } else if (Stages[0].stage === "training" && roundData.round === 5) {
      rounds = Stages[1].rounds;
    } else {
      Stages[0].rounds;
    }

    PopupChartController(
      rounds,
      window[roundseries],
      window[returnseries],
      window[priceseries],
      chart1,
      title1,
      righttitle1,
      "line",
      0,
      name
    );
    /*
    PopupChartController(
      rounds,
      window[roundseries],
      window[assetseries],
      window[priceseries],
      chart2,
      title2,
      righttitle2,
      "bar",
      0
    );

    // Calculate the center of the screen
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    // Calculate the positioning for the popup
    const popupWidth = popup.offsetWidth;
    const popupHeight = popup.offsetHeight;
    const popupLeft = centerX - popupWidth / 2;
    const popupTop = centerY - popupHeight / 2;

    // Set the popup position
    popup.style.left = popupLeft + "px";
    popup.style.top = popupTop + "px";
    popup.style.display = "block";
  });
}

// Add a click event listener to the popup to hide it when clicked inside
popup.addEventListener("click", function (event) {
  event.stopPropagation(); // Prevent the click event from propagating to the parent elements
  popup.style.display = "none"; // Close the popup when clicked inside
});

document.addEventListener("click", function (event) {
  if (!popup.contains(event.target)) {
    popup.style.display = "none";
  }
});

*/

/// Copying functionality
//Eventlistener for the copy buttons
var copyRank = null; // Initialize copyRank to null
// Function to handle button clicks
function handleButtonClick(event) {
  // Disallow clicking if phase is 9 and round is larger than 39
  if (phase === 9 && roundData.round > 39) {
    return; // Exit the function early
  }

  const buttonId = event.target.id;
  const buttonNumber = Number(buttonId.split("_")[2]) + page * 5;
  // Check if roundData.round is equal to 0
  // Toggle the .hidden class on other buttons

  // Remove previous row highlights
  clearRowHighlights();

  for (let i = 1; i <= 5; i++) {
    const otherButton = document.getElementById("BUTTON_COPY_" + i);
    if (i != buttonNumber) {
      //otherButton.classList.add("hidden");
    }
  }

  // Toggle the .chosen class on the clicked button
  event.target.classList.toggle("chosen");
  event.target.textContent = "Copied";

  // If output is null, set it to the new value, otherwise, keep it as null
  if (copyRank === null) {
    copyRank = "rank_" + buttonNumber;
    // Store ID of copied trader
    var stage = "stage_" + phase;
    var round = "round_" + roundData.round;

    if (Stages[0].stage === "regular") {
      stage = "stage_" + (phase + 1);
      copiedTL = data[stage]["round_0"][copyRank]["ResponseId"];
      SCREENELEMENTS.decision_nextbutton.classList.remove("hidden");
      SCREENELEMENTS.copy_request.classList.add("hidden");
    } else if (Stages[0].stage === "training" && roundData.round > 0) {
      copiedTL = data[stage]["round_0"][copyRank]["ResponseId"];
      SCREENELEMENTS.decision_nextbutton.classList.remove("hidden");
      SCREENELEMENTS.copy_request.classList.add("hidden");
    } else {
      copiedTL = dataTraining[stage][round][copyRank]["ResponseId"];
      SCREENELEMENTS.decision_nextbutton_training.classList.remove("hidden");
      SCREENELEMENTS.copy_request.classList.add("hidden");
    }
    console.log(copiedTL);
    console.log(copyRank);
  } else {
    // If roundData.round is not 0, toggle the .hidden and .chosen classes
    for (let i = 1; i <= 5; i++) {
      const button = document.getElementById("BUTTON_COPY_" + i);
      button.classList.remove("hidden");
      button.classList.remove("chosen");
      button.textContent = "Copy";
      if (Stages[0].stage === "training") {
        SCREENELEMENTS.decision_nextbutton.classList.add("hidden");
        SCREENELEMENTS.decision_nextbutton_training.classList.add("hidden");
        SCREENELEMENTS.copy_request.classList.remove("hidden");
      } else {
        SCREENELEMENTS.decision_nextbutton.classList.add("hidden");
        SCREENELEMENTS.decision_nextbutton_training.classList.add("hidden");
        SCREENELEMENTS.copy_request.classList.remove("hidden");
      }
    }

    copyRank = null; // Reset output to null
    copiedTL = null;

    //console.log("all buttons are available again.");

    //console.log(copyRank);
  }

  //console.log(copiedTL);
}

/// function to reset copied trader
function resetCopiedTrader() {
  if (copiedTL !== null) {
    const processedName = processName(copiedTL); // Run the same transformation

    for (let i = 1; i <= 5; i++) {
      const button = document.getElementById("BUTTON_COPY_" + i);
      const playerCell = document.getElementById("table_PLAYER" + i);

      if (playerCell && playerCell.textContent === processedName) {
        button.click();

        // Clear old highlights
        clearRowHighlights();

        // Highlight the correct row
        const row = button.closest("tr");
        if (row) row.classList.add("copy-highlight");

        break;
      }
    }
  }
}

// Add event listeners to each button
for (let i = 1; i <= 5; i++) {
  const button = document.getElementById("BUTTON_COPY_" + i);
  button.addEventListener("click", handleButtonClick);
}

// Finding Rank dictionary based on Id saved when copy button is pressed
// Necessary because ranks change, to copy trading data of chosen trade leader
function copyMechanism(targetValue, phase, roundnr) {
  var foundKey = null;
  var stage = "stage_" + phase;
  var round = "round_" + roundData.round;

  if (Stages[0].stage === "training" && roundData.round < 5) {
    for (var key in dataTraining[stage][round]) {
      if (dataTraining[stage][round].hasOwnProperty(key)) {
        var innerDict = dataTraining[stage][round][key];
        for (var innerKey in innerDict) {
          if (
            innerDict.hasOwnProperty(innerKey) &&
            innerDict[innerKey] === targetValue
          ) {
            foundKey = key;
            break; // Exit the inner loop once a match is found
          }
        }
        if (foundKey !== null) {
          break; // Exit the outer loop if a match is found
        }
      }
    }
  } else if (Stages[0].stage === "training" && roundData.round === 5) {
    for (var key in data[stage]["round_0"]) {
      if (data[stage]["round_0"].hasOwnProperty(key)) {
        var innerDict = data[stage]["round_0"][key];
        for (var innerKey in innerDict) {
          if (
            innerDict.hasOwnProperty(innerKey) &&
            innerDict[innerKey] === targetValue
          ) {
            foundKey = key;
            break; // Exit the inner loop once a match is found
          }
        }
        if (foundKey !== null) {
          break; // Exit the outer loop if a match is found
        }
      }
    }
  } else {
    stage = "stage_" + phase;
    for (var key in data[stage][round]) {
      if (data[stage][round].hasOwnProperty(key)) {
        var innerDict = data[stage][round][key];
        for (var innerKey in innerDict) {
          if (
            innerDict.hasOwnProperty(innerKey) &&
            innerDict[innerKey] === targetValue
          ) {
            foundKey = key;
            break; // Exit the inner loop once a match is found
          }
        }
        if (foundKey !== null) {
          break; // Exit the outer loop if a match is found
        }
      }
    }
  }

  // Check if a matching key was found
  /*
  if (foundKey !== null) {
    console.log("Key for the target value:", foundKey);
  } else {
    console.log("Value not found in any keys.");
  }
*/

  if (copiedTL !== null) {
    if (Stages[0].stage === "training") {
      console.log(stage);
      console.log(round);
      console.log(copiedTL);
      console.log(foundKey);
      roundData.asset = dataTraining[stage][round][foundKey]["a"];
      roundData.cash = dataTraining[stage][round][foundKey]["c"];
      roundData.portfolio = dataTraining[stage][round][foundKey]["unrealized"];
    } else {
      roundData.asset = data[stage][round][foundKey]["a"];
      roundData.cash = data[stage][round][foundKey]["c"];
      roundData.portfolio = data[stage][round][foundKey]["unrealized"];
    }
  }
  return foundKey;
}

function clearRowHighlights() {
  const allRows = document.querySelectorAll("#copytable tr");
  allRows.forEach((row) => row.classList.remove("copy-highlight"));
}

//Function that adjusts the copy buttons when browsing
function setButtonClasses(playerText) {
  // Get all the "player" cells in the table
  const playerCells = document.querySelectorAll(".player");
  //console.log(playerCells);

  playerCells.forEach((playerCell, index) => {
    // Get the text content of the player cell and remove any leading/trailing spaces
    const cellText = playerCell.textContent.trim();
    //console.log(cellText);
    //console.log(cellText);
    // Find the corresponding button by using the index (1-based) and constructing the class name
    const buttonClassName = ".BUTTON_COPY_" + (index + 1);
    //console.log(buttonClassName);
    // Find the button with the matching class name
    const button = document.querySelectorAll(buttonClassName);
    //console.log(button[0]);
    // Check if the button and player text exist
    if (treatment === 3) {
      if (button[0]) {
        if (playerText === null) {
          // If playerText is null, remove both classes
          button[0].classList.remove("chosen", "hidden");
          button[0].textContent = "Copy";
        } else if (cellText === playerText) {
          // If there's a match, add the "chosen" class and remove the "hidden" class
          button[0].classList.add("chosen");
          button[0].classList.remove("hidden");
          button[0].textContent = "Copied";
        } else if (cellText !== playerText) {
          // If there's no match, add the "hidden" class and remove the "chosen" class

          button[0].classList.add("hidden");
          button[0].classList.remove("chosen");
          button[0].textContent = "Copy";
        }
      }
    }
  });
}

function hideUnusedButtons(tableId) {
  const table = document.getElementById(tableId);

  for (let i = 1; i <= 5; i++) {
    const className = ".BUTTON_COPY_" + i;
    const buttons = table.querySelectorAll(className);
    //console.log(buttons);
    buttons.forEach(function (button, index) {
      //console.log(button);
      const row = button.closest("tr");
      const secondColumn = row.cells[1];

      // Check if the cell in the second column has a null value
      if (secondColumn.textContent.trim().toLowerCase() === "") {
        button.classList.add("hidden"); // Add the "hidden" class
      } else {
        if (treatment === 3) {
          button.classList.remove("hidden"); // Add the "hidden" class
        }
      }
    });
  }
}

function toggleColumnVisibility(show) {
  const columns = document.querySelectorAll(".toggle-column");
  columns.forEach((column) => {
    column.style.display = show ? "table-cell" : "none";
  });

  // Optionally hide the header
  const header = document.querySelector(".toggle-column-header");
  if (header) {
    header.style.display = show ? "table-cell" : "none";
  }
}
// Trade leader data

/*
/// Price path loading and selection function
const pp = {};
const pricePathsAll = {}

for (let j = 1; j < 51; j += 1) {
  let pathname = "path"+j;
  pricePathsAll[pathname] = [];
}

 let qualtricsPaths = QM.getEmbeddedData("pricepaths")
 var QPtemp = qualtricsPaths.split(';');			


for (let i = 0; i < 30; i += 1) {
  let propName =i+"period"; // create a dynamic property name
  pp[propName] = [];
  let temp = QPtemp[i]
  var temparr = temp.split(',');			
	//console.log(temparr);
  pp[propName].push(temparr);
  for (let j = 1; j < 51; j += 1) {
    let pathname = "path"+j;
    let temp = parseInt(pp[propName][0][j]);
      //console.log(pathname+" at period"+i+":"+pricePathsAll[pathname][i - 1]);
    if (pricePathsAll[pathname][i-1] === 0) {
      temp = 0;
    }
    pricePathsAll[pathname].push(temp);
  }
}


/// This function selects the price paths according to drawn priceseries (subtreatment)
const pathSeriesPicker = function (originalObject, pathseries) {
  const newObject = {};
  let startKey = 1+5*(pathseries-1)
  let endKey = 5+5*(pathseries-1)

     if (treatment == 1) {
    const pathName = "path" + (endKey + 1)
    const path0 = "path" + 0
    newObject[path0] = originalObject[pathName];
  };

  for (let key in originalObject) {
    const keyNumber = parseInt(key.match(/\d+/)[0]);

    if (keyNumber >= startKey && keyNumber <= endKey) {
      newObject[key] = originalObject[key];
    }
  }

  return newObject;
}

const pricePaths = pathSeriesPicker(pricePathsAll, pathseries)
console.log(pricePaths);
*/

/* TO DO:
- Treatment sorter
  - Price paths

  - Main treatment
- Copy mechanism
  - implementing results (copy from TL data)
  - forcing of the copying (cannot continue without)
  - Feedback screen after copying (why/how did you pick a specific trader)
- fewer phases and periods
*/

/*
function hideButtonsWithNullValueInSecondColumn(tableId) {
  const table = document.getElementById(tableId);

  for (let i = 1; i <= 5; i++) {
    const className = `BUTTON_COPY_${i}`;
    const buttons = table.querySelectorAll(`.${className}`);

    buttons.forEach(function (button, index) {
      const row = button.closest("tr");
      const secondColumn = row.cells[1];

      // Check if the cell in the second column has a null value
      if (secondColumn.textContent.trim().toLowerCase() === "null") {
        button.classList.add("hidden"); // Add the "hidden" class
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", function () {
  hideButtonsWithNullValueInSecondColumn("myTable");
});
*/

var QM = new QualtricsManager();

//draw round that pays out
const max = Number(maxPhases) || 1; // coerce to number & guard against NaN
const winningIndex = Math.floor(Math.random() * max) + 1;
console.log(winningIndex);

initialize();
update();

const scrambledNameList = shuffleArray(nameList);
pathseries = data["stage_0"]["round_0"]["rank_1"]["pathseries"];
console.log("pathseries test");
console.log(pathseries);

// Call the function to apply the initial state
toggleColumnBasedOnTreatment();
