<template>
  <StrengthExerciseList v-if="slug === 'strength-training'" />
  <EnduranceExerciseList v-else-if="slug === 'cardio-training'" kind="cardio" />
  <EnduranceExerciseList v-else-if="slug === 'aerobic-training'" kind="aerobic" />
  <FlexibilityExerciseList v-else-if="slug === 'stretching'" kind="stretch" />
  <FlexibilityExerciseList v-else-if="slug === 'yoga-training'" kind="yoga" />
  <FlexibilityExerciseList v-else-if="slug === 'plyometrics-training'" kind="plyo" />
</template>

<script setup>
defineProps({
  slug: { type: String, required: true },
});
</script>
