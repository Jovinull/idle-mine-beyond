import {
  createADNotationFormatters,
  createCommunityNotationFormatters,
  formatNumber,
  formatPercent,
} from "@idle-mine-beyond/formatting";

const formatters = [
  ...createADNotationFormatters(),
  ...createCommunityNotationFormatters(),
];
const standard = formatters.find((formatter) => formatter.name === "Standard");
const output = document.querySelector<HTMLPreElement>("#result");

if (!standard || !output) {
  throw new Error("Formatting smoke page failed to initialize.");
}

output.textContent = JSON.stringify({
  names: formatters.map(({ name }) => name),
  grouped: formatNumber("1000", standard),
  percent: formatPercent("0.005", standard),
});
output.dataset.ready = "true";
