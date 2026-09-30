<script lang="ts">
  import type { DecimalSource } from "@idle-mine-beyond/core";
  import { fmt } from "$lib/notation.svelte";

  type Props = {
    value: DecimalSource;
    precision?: number;
    limit?: DecimalSource;
    below1000?: number;
  };
  let { value, precision = 2, limit = "1e12", below1000 }: Props = $props();
</script>

<span class="num">{fmt(value, precision, limit, below1000)}</span>
