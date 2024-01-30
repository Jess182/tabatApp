const { computed, createApp, ref, watch } = Vue;
const { Loading, QSpinnerFacebook } = Quasar;

const LOADING_CONFIG = {
  spinner: QSpinnerFacebook,
  spinnerColor: 'primary',
  backgroundColor: 'dark',
}

// LocalStorage keys
const ROUNDS_KEY = 'tabatApp-rounds';
const WORK_TIME_KEY = 'tabatApp-work-time';
const RECOVER_TIME_KEY = 'tabatApp-recover-time';

// IndexDB keys
const WORK_TIME_SOUND_KEY = 'workTimeSound';
const RECOVER_TIME_SOUND_KEY = 'recoverTimeSound';

const DEFAULT_SOUND_PATHS = {
  [WORK_TIME_SOUND_KEY]: '/assets/audios/bell.mp3',
  [RECOVER_TIME_SOUND_KEY]: 'assets/audios/buzzer.mp3',
};

let db;
let dbRequest = indexedDB.open('tabatApp', 1);

let interval = null;
let initTime = null;
let startTime = null;

let pausedWatchers = false;
let isPaused = false;
let recoverMode = false;

let snapShotObj = null;

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

const lastControl = ref('stop');
const modal = ref(false);

const workTimeSoundInput = ref(null);
const recoverTimeSoundInput = ref(null);

function intervalCb() {
  if (pausedWatchers || isPaused) return;

  const elapsedTime = Date.now() - startTime;

  // Tick enter to this validation after "unpaused" or "wake up"
  if (snapShotObj) {
    /*
     * This statement is to "avoid reset ms" after "unpaused" or "wake up"
     * While not pass one second, tick continue append snapshot ms & elapsedTime
     */
    ms.value = snapShotObj.ms + elapsedTime;

    return;
  }

  ms.value = elapsedTime;
}

function enableWatchers() {
  // Start time after "wake up"
  startTime = Date.now();

  pausedWatchers = false;
}

function renderElapsedTime(elapsedTime) {
  pausedWatchers = true;

  if (elapsedTime <= 999) {
    // let computedMs = elapsedTime + ms.value;
    let computedMs = snapShotObj.ms + elapsedTime;

    if (computedMs <= 999) {
      ms.value += elapsedTime;

      enableWatchers();

      return;
    }

    let [seconds, milliseconds] = `${computedMs / 1000}`.split('.');

    sec.value += seconds;

    ms.value = milliseconds;

    enableWatchers();

    return;
  }

  const roundTime = WORK_TIME.value + RECOVER_TIME.value;

  const totalTime = roundTime * ROUNDS.value * 1000;

  elapsedTime = elapsedTime >= totalTime ? totalTime : elapsedTime;

  let [seconds, milliseconds] = `${elapsedTime / 1000}`.split('.');

  seconds = +seconds;

  milliseconds = !milliseconds ? 0 : +milliseconds;

  // Render milliseconds
  ms.value = milliseconds;

  const computedRounds = parseInt(seconds / roundTime);

  const elapsedMoreThanRound = seconds >= roundTime;

  rounds.value = !elapsedMoreThanRound
    ? rounds.value
    : computedRounds < ROUNDS.value
      ? computedRounds
      : 0;

  const cpuTime = elapsedMoreThanRound ? 1 : 0;

  const sliders = syncSliders({}, seconds - cpuTime);

  // Render workTime & recoverTime
  workTime.value = sliders.workTime;
  recoverTime.value = sliders.recoverTime;
  recoverMode = !(sliders.recoverTime === RECOVER_TIME.value);

  // Render seconds
  if (seconds <= 59) {
    sec.value = seconds;
    enableWatchers();
    return;
  }

  const computedMinutes = +seconds / 60;

  const secondsInDec = computedMinutes % 1;

  const computedSeconds = Math.round((secondsInDec * 60) / 1);

  // Render seconds
  sec.value = computedSeconds;

  const minutes = Math.floor(computedMinutes);

  // Render minutes
  min.value = minutes;

  enableWatchers();
}

// Function to sync elapsedTime, from initTime to now, in all components
function syncSliders(sliders, elapsedTime, pointer) {
  if (elapsedTime === 0) return sliders;

  if (!pointer || pointer === 'workTime') {
    if (elapsedTime < WORK_TIME.value) {
      sliders.workTime = WORK_TIME.value - elapsedTime;
      sliders.recoverTime = RECOVER_TIME.value;
      return sliders;
    } else if (elapsedTime === WORK_TIME.value) {
      sliders.workTime = elapsedTime;
      sliders.recoverTime = RECOVER_TIME.value;
      return sliders;
    } else {
      sliders.workTime = WORK_TIME.value;
      return syncSliders(sliders, elapsedTime - WORK_TIME.value, 'recoverTime');
    }
  }

  if (pointer === 'recoverTime') {
    if (elapsedTime < RECOVER_TIME.value) {
      sliders.recoverTime = RECOVER_TIME.value - elapsedTime;
      sliders.workTime = WORK_TIME.value;
      return sliders;
    } else if (elapsedTime === RECOVER_TIME.value) {
      sliders.recoverTime = elapsedTime;
      sliders.workTime = WORK_TIME.value;
      return sliders;
    } else {
      sliders.recoverTime = RECOVER_TIME.value;
      return syncSliders(sliders, elapsedTime - RECOVER_TIME.value, 'workTime');
    }
  }
}

function takeSnapshot() {
  snapShotObj = {
    ms: ms.value,
    sec: sec.value,
    min: min.value,
    workTime: workTime.value,
    recoverTime: recoverTime.value,
    rounds: rounds.value,
  };
}

function resetTime(keepTime) {
  clearInterval(interval);

  interval = null;
  initTime = null;
  startTime = null;

  if (keepTime) return;

  ms.value = 0;
  sec.value = 0;
  min.value = 0;
}

function resetRecover() {
  recoverMode = false;
  recoverTime.value = RECOVER_TIME.value;
}

function reset(keepLastState) {
  resetTime(keepLastState);

  if (!keepLastState) rounds.value = ROUNDS.value;

  resetRecover();

  workTime.value = WORK_TIME.value;

  lastControl.value = keepLastState ? 'finish' : 'stop';

  snapShotObj = null;

  isPaused = false;
}

function handleClick(action) {
  lastControl.value = action;

  if (action === 'stop') reset();

  if (action === 'pause') {
    isPaused = true;
    takeSnapshot();
  }
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
      saveAudio(e.target.result, WORK_TIME_SOUND_KEY);
      setAudio(WORK_TIME_SOUND_KEY);
    };

    reader.readAsArrayBuffer(workTimeSoundInput.value);
  }

  if (recoverTimeSoundInput.value) {
    const reader = new FileReader();

    reader.onload = (e) => {
      saveAudio(e.target.result, RECOVER_TIME_SOUND_KEY);
      setAudio(RECOVER_TIME_SOUND_KEY);
    };

    reader.readAsArrayBuffer(recoverTimeSoundInput.value);
  }

  modal.value = false;
}

function saveAudio(buffer, key) {
  const transaction = db.transaction(['audios'], 'readwrite');
  const objectStore = transaction.objectStore('audios');
  const dbAction = objectStore.put(buffer, key);

  dbAction.onerror = (event) =>
    console.error(`Error to save audio: ${event.target.error}`);
}

function setAudio(key) {
  var transaction = db.transaction(['audios'], 'readonly');

  var objectStore = transaction.objectStore('audios');

  var getRequest = objectStore.get(key);

  let audioURL;
  let blob;

  getRequest.onsuccess = (event) => {
    var audioData = event.target.result;

    if (audioData) {
      blob = new Blob([audioData], { type: 'audio/mp3' });
      audioURL = URL.createObjectURL(blob);
    } else {
      console.debug(`Set default sound for: ${key}`);

      audioURL = DEFAULT_SOUND_PATHS[key];

      fetch(DEFAULT_SOUND_PATHS[key])
        .then((res) => res.blob())
        .then((blob) => setAudioInput(key, blob));
    }

    if (key.includes('work')) {
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
  if (key.includes('work')) {
    workTimeSoundInput.value = new File([blob], `${WORK_TIME_SOUND_KEY}.mp3`);
  } else {
    recoverTimeSoundInput.value = new File(
      [blob],
      `${RECOVER_TIME_SOUND_KEY}.mp3`
    );
  }
}

function watchers() {
  document.addEventListener('visibilitychange', () => {
    if (!initTime) return;

    if (document.visibilityState === 'hidden') {
      takeSnapshot();
      pausedWatchers = true;
    } else {
      if (!isPaused) {
        const elapsedTime = Date.now() - initTime;
        renderElapsedTime(elapsedTime);
      }
    }
  });

  dbRequest.onupgradeneeded = function (event) {
    db = event.target.result;

    if (!db.objectStoreNames.contains('audios')) {
      db.createObjectStore('audios');
    }
  };

  dbRequest.onsuccess = (event) => {
    db = event.target.result;

    setAudio(WORK_TIME_SOUND_KEY);
    setAudio(RECOVER_TIME_SOUND_KEY);
  };

  dbRequest.onerror = (event) =>
    console.error(`Error on database: ${event.target.errorCode}`);

  // "play" functionality
  watch(lastControl, (newValue, oldValue) => {
    // Start time when you "play"
    if (newValue === 'play' && oldValue === 'pause') {
      startTime = Date.now();

      isPaused = false;
    }


    if (newValue === 'play' && oldValue === 'stop') {
      Loading.show({
        ...LOADING_CONFIG,
        message: 'Start in 3 seconds...'
      });

      let timer = setTimeout(() => {
        Loading.show({
          ...LOADING_CONFIG,
          message: 'Start in 2 seconds...'
        });

        timer = setTimeout(() => {
          Loading.show({
            ...LOADING_CONFIG,
            message: 'Start in 1 seconds...'
          });

          timer = setTimeout(() => {
            Loading.hide()

            startTime = Date.now();

            interval = setInterval(intervalCb, 1);

            initTime = startTime;

            workTimeSound?.play();

            timer = void 0;
          }, 1000)
        }, 1000)
      }, 1000)




    }


  });

  // "milliseconds" functionality
  watch(ms, (value) => {
    if (value <= 999 || pausedWatchers) return;

    // Start time after 1 second
    startTime = Date.now();

    /*
     * After use snapshot ms & one second passed
     * Clear snapShotObj to avoid incorrect computed values
     * This statement needs to be here to works correctly
     */
    snapShotObj = null;

    sec.value++;

    ms.value = 0;

    if (value > 1999) console.error('Elapsed time for +2 seconds');
  });

  // "seconds" functionality
  watch(sec, (value) => {
    //  "if value" to avoid decrease sec when reset
    if (!value || pausedWatchers) return;

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
    if (value || pausedWatchers) return;

    recoverTimeSound?.play();

    recoverMode = true;

    workTime.value = WORK_TIME.value;

    // Round finish without recover time (affect to computedRounds in syncSliders())
    // rounds.value--;
  });

  // "recover time" functionality
  watch(recoverTime, (value) => {
    if (value || pausedWatchers) return;

    // Round finish with recover time (affect to computedRounds in syncSliders())
    rounds.value--;

    if (rounds.value) workTimeSound?.play();

    resetRecover();
  });

  // "rounds" functionality
  watch(rounds, (value) => {
    if (pausedWatchers) return;

    if (!value && interval) reset(true); // validate 'interval' to avoid change rounds when reset
  });
}

function setup() {
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
        primary: '#4acaa8',
        secondary: '#009879',
        accent: '#81fed9',

        dark: '#22272e',
        'dark-page': '#22272e',

        positive: '#21BA45',
        negative: '#C10015',
        info: '#31CCEC',
        warning: '#F2C037',
      },

      dark: true,
    },
  })
  .mount('#app');
