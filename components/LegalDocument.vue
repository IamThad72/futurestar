<template>
  <article class="app-page mx-auto max-w-2xl pb-safe-content">
    <p>
      <button type="button" class="btn btn-ghost min-h-11 px-0 text-navy" @click="goBack">
        Back
      </button>
    </p>

    <p
      v-if="draft"
      class="mt-2 rounded-box border border-warning/40 bg-warning/10 px-3 py-2 text-sm leading-6 text-base-content"
      role="note"
    >
      <strong>Draft.</strong>
      This text is not approved. It needs the owner’s review before it can be published.
    </p>

    <h1 class="mt-4 text-ink">{{ document.title }}</h1>
    <p class="mt-2 text-sm text-muted">Last updated {{ updatedLabel }}</p>

    <nav class="mt-6" :aria-label="`${document.title} contents`">
      <h2 class="text-base font-semibold text-ink">Contents</h2>
      <ol class="mt-2 list-decimal space-y-2 pl-5 text-base leading-6">
        <li v-for="item in contents" :key="item.id">
          <a
            :href="`#${item.id}`"
            class="inline-flex min-h-11 items-center text-navy underline underline-offset-2"
            @click.prevent="scrollToSection(item.id)"
          >
            {{ item.heading }}
          </a>
        </li>
      </ol>
    </nav>

    <section
      v-for="section in document.sections"
      :key="section.id"
      class="mt-8"
      :aria-labelledby="section.id"
    >
      <h2 :id="section.id" class="scroll-mt-24 text-xl font-semibold text-ink">
        {{ section.heading }}
      </h2>
      <template v-for="(block, index) in section.blocks" :key="`${section.id}-${index}`">
        <h3 v-if="block.type === 'h3'" class="mt-4 text-base font-semibold text-ink">
          {{ block.text }}
        </h3>
        <p v-else-if="block.type === 'p'" class="mt-3 break-words text-base leading-6 text-ink">
          <template v-if="block.parts">
            <template v-for="(part, partIndex) in block.parts" :key="partIndex">
              <AppLink
                v-if="part && part.href"
                :to="part.href"
                class="font-semibold text-navy underline underline-offset-2"
              >
                {{ part.label }}
              </AppLink>
              <template v-else>{{ part }}</template>
            </template>
          </template>
          <template v-else>{{ block.text }}</template>
        </p>
        <ul
          v-else-if="block.type === 'ul'"
          class="mt-3 list-disc space-y-2 pl-5 text-base leading-6 text-ink"
        >
          <li v-for="item in block.items" :key="item" class="break-words">{{ item }}</li>
        </ul>
        <p
          v-else-if="block.type === 'placeholder'"
          class="mt-3 break-words rounded-box border border-warning/40 bg-warning/10 px-3 py-2 text-base leading-6 text-base-content"
          role="note"
        >
          <span class="font-semibold">Owner to fill.</span>
          {{ block.text }}
        </p>
        <p
          v-else-if="block.type === 'supportEmail'"
          class="mt-3 break-words text-base leading-6 text-ink"
          v-html="supportEmailHtml"
        />
      </template>
    </section>
  </article>
</template>

<script setup>
import { computed } from "vue";
import { legalUpdatedLabel, tableOfContents } from "~/utils/legalText";
import { supportEmailInnerHtml } from "~/utils/supportEmail";

const props = defineProps({
  document: {
    type: Object,
    required: true,
  },
  updated: {
    type: String,
    required: true,
  },
  draft: {
    type: Boolean,
    default: true,
  },
  supportEmail: {
    type: String,
    default: "",
  },
});

const router = useRouter();
const contents = computed(() => tableOfContents(props.document));
const updatedLabel = computed(() => legalUpdatedLabel(props.updated));
const supportEmailHtml = computed(() => supportEmailInnerHtml(props.supportEmail));

function goBack() {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  void router.push("/");
}

async function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const ion = el.closest("ion-content");
  if (ion && typeof ion.getScrollElement === "function") {
    const scrollEl = await ion.getScrollElement();
    const top = el.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop - 16;
    if (typeof ion.scrollToPoint === "function") {
      await ion.scrollToPoint(0, Math.max(0, top), 300);
      return;
    }
  }
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}
</script>
