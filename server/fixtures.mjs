import sharp from "sharp";
import path from "node:path";
import { mkdir, access } from "node:fs/promises";
import { ASSETS } from "./store.mjs";
import { ffmpeg, ingestAsset } from "./media.mjs";

const fixtures = [
  {
    id: "fixture-orbit",
    name: "01 · Orbit study",
    color: "#e69b60",
    accent: "#f8dcc0",
    bg: "#253d46",
    focalX: 0.22,
    tags: ["abstract", "warm", "off-center"],
  },
  {
    id: "fixture-arch",
    name: "02 · Passage of light",
    color: "#b6c5b1",
    accent: "#efba85",
    bg: "#30413b",
    focalX: 0.77,
    tags: ["architecture", "light", "off-center"],
  },
  {
    id: "fixture-dunes",
    name: "03 · Quiet geometry",
    color: "#c3c9da",
    accent: "#f4eedc",
    bg: "#434451",
    focalX: 0.25,
    tags: ["landscape", "minimal", "off-center"],
  },
];

export async function createFixtures() {
  const assets = [];
  for (const [i, item] of fixtures.entries()) {
    const dir = path.join(ASSETS, item.id);
    await mkdir(dir, { recursive: true });
    const image = path.join(dir, "source.png"),
      file = path.join(dir, "source.mp4");
    const x = item.focalX * 1280;
    const artwork =
      i === 0
        ? `<circle cx="${x}" cy="330" r="155" fill="url(#orb)"/><ellipse cx="${x}" cy="535" rx="200" ry="22" fill="#000" opacity=".16"/><ellipse cx="${x}" cy="330" rx="225" ry="42" fill="none" stroke="${item.accent}" stroke-width="4" transform="rotate(-28 ${x} 330)"/>`
        : i === 1
          ? `<path d="M${x - 145} 610V260a145 145 0 01290 0v350Z" fill="${item.color}"/><path d="M${x - 90} 610V270a90 90 0 01180 0v340Z" fill="${item.bg}"/><path d="M${x - 90} 610L${x + 170} 720H${x + 450}L${x + 90} 610Z" fill="${item.accent}" opacity=".6"/><circle cx="${x}" cy="295" r="55" fill="${item.accent}"/>`
          : `<circle cx="${x}" cy="240" r="90" fill="${item.accent}"/><path d="M-80 720L${x} 370 850 720Z" fill="${item.color}"/><path d="M${x} 370L${x + 30} 720H850Z" fill="#858ca2"/><path d="M450 720L1000 420 1380 720Z" fill="#666a80"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${item.bg}"/><stop offset="1" stop-color="#192b2d"/></linearGradient><radialGradient id="orb" cx=".3" cy=".2"><stop stop-color="${item.accent}"/><stop offset="1" stop-color="${item.color}"/></radialGradient><filter id="noise"><feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".09"/></feComponentTransfer><feBlend in="SourceGraphic" mode="soft-light"/></filter></defs><rect width="1280" height="720" fill="url(#sky)"/><path d="M0 550H1280V720H0Z" fill="${item.bg}"/>${artwork}<rect width="1280" height="720" filter="url(#noise)" opacity=".3"/></svg>`;
    try {
      await access(file);
    } catch {
      await sharp(Buffer.from(svg)).png().toFile(image);
      await ffmpeg([
        "-loop",
        "1",
        "-i",
        image,
        "-t",
        "10",
        "-vf",
        "zoompan=z='1+0.00008*on':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=240:s=1280x720:fps=24",
        "-frames:v",
        "240",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "25",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        file,
      ]);
    }
    assets.push(
      await ingestAsset({
        ...item,
        file,
        kind: "fixture",
        fixture: { focalX: item.focalX },
        attribution: {
          title: "Cutroom original procedural test artwork",
          creator: "Cutroom",
          license: "CC0-1.0",
          note: "Synthetic fixture, not user footage. Generated locally with SVG and FFmpeg.",
        },
      }),
    );
  }
  return assets;
}
