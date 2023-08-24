const { ref } = Vue;

export const rounds = ref(+localStorage.getItem('tabatApp-rounds'));
export const roundTime = ref(+localStorage.getItem('tabatApp-round-time'));
export const recoverTime = ref(+localStorage.getItem('tabatApp-recover-time'));

export const lastControl = ref('stop');
