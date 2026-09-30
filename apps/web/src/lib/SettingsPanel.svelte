<script lang="ts">
  import type { NotationFormatter } from "@idle-mine-beyond/formatting";
  import type { RemixLegacySaveSettings } from "@idle-mine-beyond/persistence";

  type PreferenceKey = "showMineObjLevel" | "showMinCraftDamage";
  type Props = {
    settings: RemixLegacySaveSettings;
    formatters: readonly NotationFormatter[];
    onNumberFormatterChange: (index: number) => void;
    onThemeChange: (theme: "light" | "dark") => void;
    onPreferenceChange: (key: PreferenceKey, value: boolean) => void;
    onSave: () => void;
    onExportFieldStringChange: (value: string) => void;
    onExport: () => void;
    onImport: (value: string) => void;
    onHardReset: () => void;
    error: string;
  };

  let {
    settings,
    formatters,
    onNumberFormatterChange,
    onThemeChange,
    onPreferenceChange,
    onSave,
    onExportFieldStringChange,
    onExport,
    onImport,
    onHardReset,
    error,
  }: Props = $props();

  let exportFieldString = $derived(settings.exportFieldString);
</script>

<article class="settings" data-settings-panel>
  <h2>Settings</h2>
  <p>
    Change the Number Format of the Game, Save manually or export and import
    your Game.
  </p>
  <span>Number Format</span>
  <select
    id="numberformatselect"
    value={settings.numberFormatterIndex}
    onchange={(event) =>
      onNumberFormatterChange(Number(event.currentTarget.value))}
  >
    {#each formatters as formatter, index (`${index}:${formatter.name}`)}
      <option value={index}>{formatter.name}</option>
    {/each}
  </select>
  <br />
  <span>Theme</span>
  <button
    data-theme-choice="light"
    aria-pressed={settings.theme === "light"}
    onclick={() => onThemeChange("light")}>Light</button
  >
  <button
    data-theme-choice="dark"
    aria-pressed={settings.theme === "dark"}
    onclick={() => onThemeChange("dark")}>Dark</button
  >
  <br />
  <label
    ><span>Show Mineral Level</span><input
      data-setting="showMineObjLevel"
      type="checkbox"
      checked={settings.showMineObjLevel}
      onchange={(event) =>
        onPreferenceChange("showMineObjLevel", event.currentTarget.checked)}
    /></label
  >
  <br />
  <label
    ><span>Show minimum Base Damage for crafted Pickaxes</span><input
      data-setting="showMinCraftDamage"
      type="checkbox"
      checked={settings.showMinCraftDamage}
      onchange={(event) =>
        onPreferenceChange("showMinCraftDamage", event.currentTarget.checked)}
    /></label
  >
  <br />
  <button data-settings-save onclick={onSave}>Save</button>
  <button data-settings-export onclick={onExport}>Export</button>
  <button data-settings-import onclick={() => onImport(exportFieldString)}
    >Import (from Text Field)</button
  >
  <button data-settings-hard-reset onclick={onHardReset}>Hard Reset</button>
  <br />
  <p>
    Note: The Game won't save if cookies and browser storage are disabled.
    Clearing cookies and browser data might erase your savegame.
  </p>
  <textarea
    data-settings-save-field
    value={exportFieldString}
    oninput={(event) => {
      exportFieldString = event.currentTarget.value;
      onExportFieldStringChange(exportFieldString);
    }}></textarea>
  <p>
    Thanks to crovie, the creator of <a
      target="_blank"
      href="https://www.kongregate.com/games/crovie/idle-mine"
      ><i>Idle Mine</i></a
    > for making this interesting Game concept.
  </p>
  <p>
    Notations provided by <a
      target="_blank"
      href="https://github.com/antimatter-dimensions/notations"
      ><i>ad-notations</i></a
    >.
  </p>
  <div class="social" aria-label="Game links">
    <a target="_blank" href="https://www.youtube.com/veprogames"
      ><img src="/Images/social/youtube.png" alt="" /></a
    >
    <span>My YouTube</span>
    <a target="_blank" href="https://veprogames.github.io"
      ><img src="/Images/social/cook1eegames.png" alt="" /></a
    >
    <span>My Website</span>
    <a target="_blank" href="https://idle-mine-remix.fandom.com/wiki/"
      ><img src="/Images/social/wiki.png" alt="" /></a
    >
    <span>Wiki</span>
  </div>
  {#if error}
    <p class="settings-error" role="alert">{error}</p>
  {/if}
</article>

<style>
  article.settings h2 {
    margin: 0;
    font-family: Montserrat, sans-serif;
  }

  article.settings {
    box-sizing: border-box;
    height: 84vh;
    overflow-y: auto;
    padding: 0.5rem;
  }

  article.settings button {
    margin: 0.5em;
    font-family: "Work Sans", Helvetica, Arial, sans-serif;
    background-color: #cfcfcf;
    border: none;
    font-size: 110%;
    outline: 0;
  }

  article.settings button:hover {
    background-color: #b6b6b6;
  }

  article.settings textarea {
    width: 50%;
    height: 10rem;
  }

  .social {
    display: flex;
    align-items: center;
    position: fixed;
    bottom: 9vh;
    left: 0;
  }

  .social span {
    margin-right: 1rem;
  }

  .social a {
    margin: 0 0.5rem;
  }

  .social a img {
    height: 2rem;
  }

  :global(body[data-theme="dark"]) article.settings {
    background-color: #363636;
    color: #c1c1c1;
  }

  :global(body[data-theme="dark"]) article.settings button,
  :global(body[data-theme="dark"]) article.settings select,
  :global(body[data-theme="dark"]) article.settings textarea {
    background-color: #4d4d4d;
    color: #c1c1c1;
  }

  :global(body[data-theme="dark"]) article.settings button:hover {
    background-color: #636363;
  }

  :global(body[data-theme="dark"]) article.settings a {
    color: #299bff;
  }

  :global(body[data-theme="dark"]) article.settings a:visited {
    color: #0072ff;
  }

  .settings-error {
    color: #a90500;
  }
</style>
