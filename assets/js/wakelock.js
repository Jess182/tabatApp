if ('wakeLock' in navigator)
  console.warn('This app needs to keep screen on to work correctly');

async function activeWakelock() {
  try {
    if (document.visibilityState !== 'visible') return;
    await navigator.wakeLock.request('screen');
  } catch (error) {
    console.error(error);
  }
}

document.addEventListener('DOMContentLoaded', activeWakelock);

document.addEventListener('visibilitychange', activeWakelock);
