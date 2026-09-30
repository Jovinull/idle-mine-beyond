<script lang="ts">
  import { page } from "$app/state";
  import { absoluteUrl, site } from "$lib/site";

  type Props = { title?: string; description?: string; noindex?: boolean };
  let {
    title,
    description = site.description,
    noindex = false,
  }: Props = $props();

  const fullTitle = $derived(title ? `${title} · ${site.name}` : site.name);
  const canonical = $derived(absoluteUrl(page.url.pathname));
</script>

<svelte:head>
  <title>{fullTitle}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonical} />
  <meta property="og:site_name" content={site.name} />
  <meta property="og:type" content="website" />
  <meta property="og:title" content={title ?? site.name} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonical} />
  <meta property="og:image" content={absoluteUrl("/og.png")} />
  <meta name="twitter:card" content="summary_large_image" />
  {#if noindex}<meta name="robots" content="noindex" />{/if}
</svelte:head>
