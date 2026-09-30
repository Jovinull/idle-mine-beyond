<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import MineObject from "$lib/components/MineObject.svelte";
</script>

<svelte:head>
  <title
    >{page.status === 404 ? "Page not found" : "Error"} · Idle Mine Beyond</title
  >
  <meta name="robots" content="noindex" />
</svelte:head>

<section class="container error">
  <MineObject level={0} name="Mud" width={160} />
  <div>
    <p class="eyebrow">Error {page.status}</p>
    {#if page.status === 404}
      <h1>Nothing to mine here.</h1>
      <p class="lede">
        This page does not exist. It may have moved, or the link is wrong.
      </p>
    {:else}
      <h1>Something broke.</h1>
      <p class="lede">
        {page.error?.message ?? "An unexpected error occurred."}
      </p>
    {/if}
    <p class="links">
      <a class="button primary" href={resolve("/")}>Home</a>
      <a class="button" href={resolve("/wiki/")}>Wiki</a>
    </p>
  </div>
</section>

<style>
  .error {
    display: flex;
    align-items: center;
    gap: 3rem;
    padding-block: 6rem;
  }

  .links {
    display: flex;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }

  @media (max-width: 640px) {
    .error {
      flex-direction: column;
      align-items: flex-start;
      padding-block: 3rem;
    }
  }
</style>
