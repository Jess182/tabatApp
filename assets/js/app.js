// @ts-check

const { computed, createApp, ref, watch } = Vue;
const { Loading, QSpinnerFacebook } = Quasar;

const LOADING_CONFIG = {
  spinner: QSpinnerFacebook,
  spinnerColor: "primary",
  backgroundColor: "dark",
};

// LocalStorage keys
const ROUNDS_KEY = "tabatApp-rounds";
const WORK_TIME_KEY = "tabatApp-work-time";
const RECOVER_TIME_KEY = "tabatApp-recover-time";

// IndexedDB keys
const WORK_TIME_SOUND_KEY = "workTimeSound";
const RECOVER_TIME_SOUND_KEY = "recoverTimeSound";

const DEFAULT_SOUND_PATHS = {
  [WORK_TIME_SOUND_KEY]: "/assets/audios/bell.mp3",
  [RECOVER_TIME_SOUND_KEY]: "assets/audios/buzzer.mp3",
};

let db;
let dbRequest = indexedDB.open("tabatApp", 1);

let globalInterval = null;
let initTime = null;
let startTime = null;

let appIsPaused = false;
let recoverMode = false;

let workTimeSound;
let recoverTimeSound;

const ROUNDS = ref(+localStorage.getItem(ROUNDS_KEY) || 5);
const WORK_TIME = ref(+localStorage.getItem(WORK_TIME_KEY) || 25);
const RECOVER_TIME = ref(+localStorage.getItem(RECOVER_TIME_KEY) || 10);

const recoverTime = ref(RECOVER_TIME.value);
const workTime = ref(WORK_TIME.value);
const rounds = ref(ROUNDS.value);

const ms = ref(0);
const sec = ref(0);
const min = ref(0);

const lastControl = ref("stop");
const modal = ref(false);

const workTimeSoundInput = ref(null);
const recoverTimeSoundInput = ref(null);

/**
 * Callback function for globalInterval,
 * if app or watchers are not paused, computed elapsed time and add to ms ref
 */
function intervalCb() {
  if (appIsPaused) return;

  const elapsedTime = Date.now() - startTime;

  ms.value = elapsedTime;
}

/** Unpaused watchers & update startTime */
function enableVueWatchers() {
  // Start time after "wake up"
  startTime = Date.now();
}

function resetRecover() {
  recoverMode = false;
  recoverTime.value = RECOVER_TIME.value;
}

function reset(keepLastState) {
  function resetValues(keepTime) {
    clearInterval(globalInterval);

    globalInterval = null;
    initTime = null;
    startTime = null;

    if (keepTime) return;

    ms.value = 0;
    sec.value = 0;
    min.value = 0;
  }

  resetValues(keepLastState);

  if (!keepLastState) rounds.value = ROUNDS.value;

  resetRecover();

  workTime.value = WORK_TIME.value;

  lastControl.value = keepLastState ? "finish" : "stop";

  appIsPaused = false;
}

async function handleClick(action) {
  if (action === "stop") {
    reset();
    navigator.serviceWorker.controller?.postMessage({ command: "stop" });
  }

  if (action === "pause") {
    appIsPaused = true;
  }

  if (action === "play") {
    let permission = Notification.permission;

    if (permission === "default") {
      permission = await Notification.requestPermission();
    }

    if (permission !== "granted") {
      alert(
        "Permission for notifications is required for the timer to work in the background."
      );
      lastControl.value = "stop"; // Revert state if permission denied
      return;
    }
  }

  lastControl.value = action;
}

function saveSettings() {
  localStorage.setItem(ROUNDS_KEY, ROUNDS.value);
  localStorage.setItem(WORK_TIME_KEY, WORK_TIME.value);
  localStorage.setItem(RECOVER_TIME_KEY, RECOVER_TIME.value);

  rounds.value = ROUNDS.value;
  workTime.value = WORK_TIME.value;
  recoverTime.value = RECOVER_TIME.value;

  if (workTimeSoundInput.value) {
    const reader = new FileReader();

    reader.onload = (e) => {
      saveAudio(e.target?.result, WORK_TIME_SOUND_KEY);
      setAudio(WORK_TIME_SOUND_KEY);
    };

    reader.readAsArrayBuffer(workTimeSoundInput.value);
  }

  if (recoverTimeSoundInput.value) {
    const reader = new FileReader();

    reader.onload = (e) => {
      saveAudio(e.target?.result, RECOVER_TIME_SOUND_KEY);
      setAudio(RECOVER_TIME_SOUND_KEY);
    };

    reader.readAsArrayBuffer(recoverTimeSoundInput.value);
  }

  modal.value = false;
}

function saveAudio(buffer, key) {
  const transaction = db.transaction(["audios"], "readwrite");
  const objectStore = transaction.objectStore("audios");
  const dbAction = objectStore.put(buffer, key);

  dbAction.onerror = (event) =>
    console.error(`Error to save audio: ${event.target.error}`);
}

function setAudio(key) {
  const transaction = db.transaction(["audios"], "readonly");

  const objectStore = transaction.objectStore("audios");

  const getRequest = objectStore.get(key);

  let audioURL;
  let blob;

  getRequest.onsuccess = (event) => {
    const audioData = event.target.result;

    if (audioData) {
      blob = new Blob([audioData], { type: "audio/mp3" });
      audioURL = URL.createObjectURL(blob);
    } else {
      console.debug(`Set default sound for: ${key}`);

      audioURL = DEFAULT_SOUND_PATHS[key];

      fetch(DEFAULT_SOUND_PATHS[key])
        .then((res) => res.blob())
        .then((blob) => setAudioInput(key, blob));
    }

    if (key.includes("work")) {
      workTimeSound = new Audio(audioURL);
    } else {
      recoverTimeSound = new Audio(audioURL);
    }

    if (blob) setAudioInput(key, blob);
  };

  getRequest.onerror = (event) =>
    console.error(`Error to get audio: ${event.target.error}`);
}

function setAudioInput(key, blob) {
  if (key.includes("work")) {
    workTimeSoundInput.value = new File([blob], `${WORK_TIME_SOUND_KEY}.mp3`);
  } else {
    recoverTimeSoundInput.value = new File(
      [blob],
      `${RECOVER_TIME_SOUND_KEY}.mp3`
    );
  }
}

function watchers() {
  // "play" functionality
  watch(lastControl, (newValue, oldValue) => {
    // Start time when you "play"
    if (newValue === "play" && oldValue === "pause") {
      startTime = Date.now();
      appIsPaused = false;
    }

    if (newValue === "play" && oldValue === "stop") {
      let countDown = 3;

      Loading.show({
        ...LOADING_CONFIG,
        message: `Start in ${countDown} seconds...`,
      });

      countDown--;

      const countDownInterval = setInterval(() => {
        Loading.show({
          spinner: QSpinnerFacebook,
          spinnerColor: "primary",
          backgroundColor: "dark",
          message: `Start in ${countDown} seconds...`,
        });

        if (!countDown) {
          clearInterval(countDownInterval);

          Loading.hide();

          startTime = Date.now();

          globalInterval = setInterval(intervalCb, 10);

          initTime = startTime;

          workTimeSound?.play();

          // Start the background timer if the app is not visible
          if (document.visibilityState === "hidden") {
            navigator.serviceWorker.controller?.postMessage({
              command: "start",
              state: {
                // ... pass the full timer state here
              },
            });
          }
        }

        countDown--;
      }, 1000);
    }
  });

  // "milliseconds" functionality
  watch(ms, (value) => {
    if (value <= 999) return;

    // Start time after 1 second
    startTime = Date.now();

    sec.value++;

    ms.value = 0;

    if (value > 1999) console.error("Elapsed time for +2 seconds");
  });

  // "seconds" functionality
  watch(sec, (value) => {
    //  "if value" to avoid decrease sec when reset
    if (!value) return;

    if (value > 59) {
      min.value++;
      sec.value = 0;
    }

    if (recoverMode) {
      recoverTime.value--;
    } else {
      workTime.value--;
    }
  });

  // "round time" functionality
  watch(workTime, (value) => {
    if (value) return;

    recoverTimeSound?.play();

    recoverMode = true;

    workTime.value = WORK_TIME.value;

    // Round finish without recover time (affect to computedRounds in syncSliders())
    // rounds.value--;
  });

  // "recover time" functionality
  watch(recoverTime, (value) => {
    if (value) return;

    // Round finish with recover time (affect to computedRounds in syncSliders())
    rounds.value--;

    if (rounds.value) workTimeSound?.play();

    resetRecover();
  });

  // "rounds" functionality
  watch(rounds, (value) => {
    if (!value && globalInterval) reset(true); // validate 'globalInterval' to avoid change rounds when reset
  });
}

function setup() {
  dbRequest.onupgradeneeded = function (event) {
    db = event.target?.result;

    if (!db.objectStoreNames.contains("audios")) {
      db.createObjectStore("audios");
    }
  };

  dbRequest.onsuccess = (event) => {
    db = event.target?.result;

    setAudio(WORK_TIME_SOUND_KEY);
    setAudio(RECOVER_TIME_SOUND_KEY);
  };

  dbRequest.onerror = (event) =>
    console.error(`Error on database: ${event.target?.errorCode}`);

  // Check if app is active
  document.addEventListener("visibilitychange", async () => {
    if (!initTime) return;

    // If app goes to background, tell the Service Worker to take over.
    if (document.visibilityState === "hidden") {
      if (!appIsPaused && lastControl.value === "play") {
        navigator.serviceWorker.controller?.postMessage({
          command: "start",
          state: {
            rounds: rounds.value,
            workTime: workTime.value,
            recoverTime: recoverTime.value,
            isRecovering: recoverMode,
            workSound: DEFAULT_SOUND_PATHS[WORK_TIME_SOUND_KEY],
            recoverSound: DEFAULT_SOUND_PATHS[RECOVER_TIME_SOUND_KEY],
          },
        });
      }
    } else {
      // If app comes to foreground, stop the Service Worker timer.
      // The main app's interval will continue naturally.
      navigator.serviceWorker.controller?.postMessage({ command: "stop" });
      // We might need a "catch-up" logic here for the UI, but let's focus on the background part first.
    }
  });

  watchers();

  return {
    milliseconds: computed(() =>
      ms.value < 10
        ? `00${ms.value}`
        : ms.value < 100
        ? `0${ms.value}`
        : ms.value
    ),
    seconds: computed(() => (sec.value < 10 ? `0${sec.value}` : sec.value)),
    minutes: computed(() => (min.value < 10 ? `0${min.value}` : min.value)),
    handleClick,
    saveSettings,
    modal,
    lastControl,
    ROUNDS,
    WORK_TIME,
    RECOVER_TIME,
    rounds,
    workTime,
    recoverTime,
    workTimeSoundInput,
    recoverTimeSoundInput,
  };
}

createApp({ setup })
  .use(Quasar, {
    config: {
      brand: {
        primary: "#4acaa8",
        secondary: "#009879",
        accent: "#81fed9",

        dark: "#22272e",
        "dark-page": "#22272e",

        positive: "#21BA45",
        negative: "#C10015",
        info: "#31CCEC",
        warning: "#F2C037",
      },

      dark: true,
    },
  })
  .mount("#app");
