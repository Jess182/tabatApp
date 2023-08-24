import * as timer from './timer.js';
import * as config from './config.js';

const { createApp, watch } = Vue;

const ROUNDS = +localStorage.getItem('tabatApp-rounds');
const ROUND_TIME = +localStorage.getItem('tabatApp-round-time');
const RECOVER_TIME = +localStorage.getItem('tabatApp-recover-time');

let startTime;
let interval;

let isPaused = false;
let recoverMode = false;

function timerFn() {
  if (!isPaused) timer.ms.value = Date.now() - startTime;
}

function resetTime(keepTime) {
  clearInterval(interval);

  interval = null;

  if (!keepTime) {
    timer.ms.value = 0;
    timer.sec.value = 0;
    timer.min.value = 0;
  }
}

function resetRecover() {
  recoverMode = false;
  config.recoverTime.value = RECOVER_TIME;
}

function reset(keepLastState) {
  resetTime(keepLastState);

  if (!keepLastState) {
    config.rounds.value = ROUNDS;
  }

  resetRecover();

  config.roundTime.value = ROUND_TIME;

  config.lastControl.value = keepLastState ? 'finish' : 'stop';

  isPaused = false;
}

function handleClick(action) {
  config.lastControl.value = action;

  if (action === 'stop') {
    reset();
  }

  if (action === 'pause') {
    isPaused = true;
  }
}

function setup() {
  // "play" functionality
  watch(config.lastControl, (newValue, oldValue) => {
    if (newValue === 'play' && oldValue === 'stop') {
      startTime = Date.now();

      interval = setInterval(timerFn, 1);
    }

    if (newValue === 'play' && oldValue === 'pause') isPaused = false;
  });

  // "milliseconds" functionality
  watch(timer.ms, (value) => {
    if (value > 999) {
      timer.sec.value++;
      timer.ms.value = 0;
      startTime = Date.now();
    }
  });

  // "seconds" functionality
  watch(timer.sec, (value) => {
    if (value > 59) {
      timer.min.value++;
      timer.sec.value = 0;
    }

    // validate "if value" to avoid decrease values when timer.sec resets
    if (value) {
      if (!recoverMode) {
        config.roundTime.value--;
      } else {
        config.recoverTime.value--;
      }
    }
  });

  // "round time" functionality
  watch(config.roundTime, (value) => {
    if (value) return;

    recoverMode = true;

    config.roundTime.value = ROUND_TIME;

    config.rounds.value--;
  });

  // "recover time" functionality
  watch(config.recoverTime, (value) => {
    if (!value) resetRecover();
  });

  // "rounds" functionality
  watch(config.rounds, (value) => {
    if (!value && interval) reset(true);
  });

  return { ...timer, ...config, handleClick };
}

createApp({ setup })
  .use(Quasar, {
    config: {
      brand: {
        primary: '#4acaa8',
        secondary: '#009879',
        accent: '#81fed9',

        dark: '#121212',
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
