let stoppedVueWatchers = false;
let snapShotObj = null;

/**
 * Function that computed elapsedTime
 * @deprecated
 * */
function renderElapsedTime(elapsedTime) {
  stoppedVueWatchers = true;

  // If elapsed time is less than 1 second, add to ms ref and start watchers
  if (elapsedTime <= 999) {
    // let computedMs = elapsedTime + ms.value;
    let computedMs = snapShotObj.ms + elapsedTime;

    if (computedMs <= 999) {
      ms.value += elapsedTime;
      enableVueWatchers();
      return;
    }

    let [seconds, milliseconds] = `${computedMs / 1000}`.split(".");

    sec.value += seconds;

    ms.value = milliseconds;

    enableVueWatchers();

    return;
  }

  // If elapsed time is more than 1 second, compute rounds, work time, rest time & sync sliders

  const roundTime = WORK_TIME.value + RECOVER_TIME.value;

  const totalTime = roundTime * ROUNDS.value * 1000;

  elapsedTime = elapsedTime >= totalTime ? totalTime : elapsedTime;

  let [seconds, milliseconds] = `${elapsedTime / 1000}`.split(".");

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
    enableVueWatchers();
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

  enableVueWatchers();
}

/**
 * Function to sync elapsedTime, from initTime to now, in all components
 * @deprecated
 * */
function syncSliders(sliders, elapsedTime, pointer) {
  if (elapsedTime === 0) return sliders;

  if (!pointer || pointer === "workTime") {
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
      return syncSliders(sliders, elapsedTime - WORK_TIME.value, "recoverTime");
    }
  }

  if (pointer === "recoverTime") {
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
      return syncSliders(sliders, elapsedTime - RECOVER_TIME.value, "workTime");
    }
  }
}

/** @deprecated */
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
