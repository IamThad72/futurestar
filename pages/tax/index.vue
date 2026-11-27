<script setup>
import { taxYearPath } from "~/utils/taxYear";

await navigateTo(taxYearPath(), { replace: true });
</script>
