const { computed, createApp, ref, watch } = Vue;

const ROUNDS_KEY = 'tabatApp-rounds';
const WORK_TIME_KEY = 'tabatApp-work-time';
const RECOVER_TIME_KEY = 'tabatApp-recover-time';

let startTimeSound = new Audio('/assets/audio/bell.mp3');
let endTimeSound = new Audio('/assets/audio/buzzer.mp3');

const ROUNDS = ref(+localStorage.getItem(ROUNDS_KEY));
const WORK_TIME = ref(+localStorage.getItem(WORK_TIME_KEY));
const RECOVER_TIME = ref(+localStorage.getItem(RECOVER_TIME_KEY));

let interval = null;
let initTime = null;
let startTime = null;

let pausedWatchers = false;
let isPaused = false;
let recoverMode = false;

let snapShotObj = null;

const lastControl = ref('stop');
const modal = ref(false);

const ms = ref(0);
const sec = ref(0);
const min = ref(0);

const recoverTime = ref(RECOVER_TIME.value);
const workTime = ref(WORK_TIME.value);
const rounds = ref(ROUNDS.value);

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

// Function to sync elapsedTime from initTime to now in all components
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

  modal.value = false;
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

  // "play" functionality
  watch(lastControl, (newValue, oldValue) => {
    if (newValue === 'play') {
      // Start time when you "play"
      startTime = Date.now();

      if (oldValue === 'stop') {
        interval = setInterval(intervalCb, 1);

        initTime = startTime;

        startTimeSound.play();
      }

      if (oldValue === 'pause') isPaused = false;
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

    endTimeSound.play();

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

    if (rounds.value) startTimeSound.play();

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
