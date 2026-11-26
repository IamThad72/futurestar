<template>
  <LegalDocument
    :document="privacyPolicy"
    :updated="LEGAL_UPDATED"
    :draft="LEGAL_DRAFT"
    :support-email="supportEmail"
  />
</template>

<script setup>
import { computed } from "vue";
import { LEGAL_DRAFT, LEGAL_UPDATED, privacyPolicy } from "~/utils/legalText";

const config = useRuntimeConfig();
const supportEmail = computed(() => String(config.public.supportEmail || "").trim());

useHead({ title: "Privacy policy" });
</script>
