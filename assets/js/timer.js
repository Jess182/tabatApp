const { computed, ref } = Vue;

export const ms = ref(0);
export const sec = ref(0);
export const min = ref(0);

export const milliseconds = computed(() =>
  ms.value < 10 ? `00${ms.value}` : ms.value < 100 ? `0${ms.value}` : ms.value
);

export const seconds = computed(() =>
  sec.value < 10 ? `0${sec.value}` : sec.value
);

export const minutes = computed(() =>
  min.value < 10 ? `0${min.value}` : min.value
);
