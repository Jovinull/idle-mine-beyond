<script lang="ts">
  import { onMount } from "svelte";

  let dark = $state(false);

  function effectiveDark(): boolean {
    const chosen = document.documentElement.dataset["theme"];
    if (chosen === "dark") return true;
    if (chosen === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  onMount(() => {
    dark = effectiveDark();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const follow = () => (dark = effectiveDark());
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  });

  function toggle() {
    dark = !dark;
    const theme = dark ? "dark" : "light";
    document.documentElement.dataset["theme"] = theme;
    try {
      localStorage.setItem("imb-site-theme", theme);
    } catch {
      // The theme still applies for this page view.
    }
  }
</script>

<button
  class="theme-toggle"
  type="button"
  onclick={toggle}
  aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
  title={dark ? "Light theme" : "Dark theme"}
>
  {#if dark}
    <svg viewBox="0 0 24 24" aria-hidden="true"
      ><circle cx="12" cy="12" r="4.2" /><path
        d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"
      /></svg
    >
  {:else}
    <svg viewBox="0 0 24 24" aria-hidden="true"
      ><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" /></svg
    >
  {/if}
</button>

<style>
  .theme-toggle {
    display: inline-grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: var(--radius);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
  }

  .theme-toggle:hover {
    color: var(--text);
    border-color: var(--line);
  }

  svg {
    width: 1.15rem;
    height: 1.15rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
