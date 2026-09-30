<script lang="ts">
  const icons = {
    money: { src: "/Images/money.png", label: "Money" },
    gems: { src: "/Images/gem.png", label: "Gems" },
    planetcoin: { src: "/Images/planetcoin.png", label: "Planet Coins" },
    wisdom: { src: "/Images/wisdom.png", label: "Wisdom" },
  } as const;

  type Props = {
    kind: keyof typeof icons;
    size?: number;
    decorative?: boolean;
  };
  let { kind, size = 18, decorative = false }: Props = $props();
  const icon = $derived(icons[kind]);
</script>

<img
  class="resource-icon"
  src={icon.src}
  alt={decorative ? "" : icon.label}
  title={decorative ? undefined : icon.label}
  width={size}
  height={size}
/>

<style>
  .resource-icon {
    display: inline-block;
    vertical-align: -0.2em;
  }
</style>
