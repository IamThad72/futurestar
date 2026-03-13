<template>
    <div>
      <h2 >This is a reusable component!</h2>
      <p>{{ message }}</p>
      <h3>{{ message2 }}</h3>
    </div>
    
  </template>
  
  <script>
  export default {
    name: 'myComponent',
    props: {
      message: {
        type: String,
        default: 'Hello from the component!',
      },
      message2: {
        type: String,
        default: 'Hello from the component!',
      },
    },
  }
  </script>
  
  <style scoped>
  /* Add component-specific styles here */
  </style>