<template>
    <div>
      <div>
    <p>Count: {{ store.count }}</p>
    <button @click="store.increment" class="btn btn-active btn-success">Increment</button>
  </div>
      <MyComponent message="Thad is king" message2="FUCK YEAH" />
    </div>
    <NuxtLink to="/" class="btn btn-link">Go home</NuxtLink>
    <NuxtLink to="dev" class="btn btn-link">Go dev</NuxtLink>
  </template>
  
  <script setup>
  import { useCounterStore } from '~/stores/counter';

    const store = useCounterStore();
 
  </script>