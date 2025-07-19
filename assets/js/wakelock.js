// @ts-check

if (!("wakeLock" in navigator))
  Quasar.Notify.create({
    message: "This app needs to keep screen on to work correctly",
    position: "top",
    color: "warning",
  });

async function activeWakelock() {
  try {
    if (document.visibilityState !== "visible") return;
    await navigator.wakeLock.request("screen");
  } catch (error) {
    console.error(error);
  }
}

document.addEventListener("DOMContentLoaded", activeWakelock);

document.addEventListener("visibilitychange", activeWakelock);
