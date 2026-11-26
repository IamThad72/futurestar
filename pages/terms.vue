<template>
  <LegalDocument
    :document="termsOfService"
    :updated="LEGAL_UPDATED"
    :draft="LEGAL_DRAFT"
    :support-email="supportEmail"
  />
</template>

<script setup>
import { computed } from "vue";
import { LEGAL_DRAFT, LEGAL_UPDATED, termsOfService } from "~/utils/legalText";

const config = useRuntimeConfig();
const supportEmail = computed(() => String(config.public.supportEmail || "").trim());

useHead({ title: "Terms of service" });
</script>
