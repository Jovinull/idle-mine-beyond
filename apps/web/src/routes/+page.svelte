<svelte:head>
  <title>Idle Mine Beyond — Foundation</title>
  <meta
    name="description"
    content="Engineering foundation for a faithful Idle Mine: Remix compatibility implementation."
  />
</svelte:head>

<main>
  <p class="eyebrow">IDLE MINE BEYOND</p>
  <h1>Foundation scaffold</h1>
  <p class="phase">Phase 0 — Foundation / reference archaeology</p>
  <p>Gameplay implementation has not started.</p>
  <p class="principle">IDENTICAL FIRST. BETTER SECOND.</p>
</main>

<style>
  :global(body) {
    margin: 0;
    min-width: 320px;
    min-height: 100vh;
    background: #151718;
    color: #e7e9e9;
    font: 16px/1.5 system-ui, sans-serif;
  }

  main {
    box-sizing: border-box;
    width: min(100% - 3rem, 52rem);
    margin: 0 auto;
    padding: 18vh 0;
  }

  .eyebrow {
    color: #a5b0b1;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.14em;
  }

  h1 {
    margin: 1rem 0 0.5rem;
    font-size: clamp(2rem, 6vw, 3.5rem);
    line-height: 1.1;
  }

  .phase {
    color: #b7c1a6;
  }

  .principle {
    margin-top: 3rem;
    color: #d5c39c;
    font-weight: 700;
    letter-spacing: 0.08em;
  }
</style>
